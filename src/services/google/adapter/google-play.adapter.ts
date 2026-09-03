import { Storage } from "@google-cloud/storage";
import { JWT } from "google-auth-library";
import { parse } from "csv-parse/sync";

import { getStoreCredentialProfile } from "@/config/store-config";
import type {
  GoogleReview,
  GoogleReviewCsvRow,
  GoogleReviewResponse,
} from "@/domain/models/google.model";
import type { GoogleServiceAccountCredentials } from "@/domain/models/ga4.model";
import type { AppInfo, AppReview } from "@/domain/types";
import { getEnvironmentVariable } from "@/lib/env";
import {
  StoreConfigurationError,
  type StoreAdapter,
  type StoreSyncPayload,
  type StoreSyncType,
} from "@/services/mobile/common/store-adapter";
import {
  parseGoogleRatingReport,
  parseGoogleReviewRows,
  selectReportNames,
} from "../google-reviews";
import { parseGoogleInstallReport } from "../google-installs";
import { fetchGoogleReleaseData } from "../google-releases";

function decodeReport(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer.subarray(2));
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

async function downloadCsvRows(
  storage: Storage,
  bucketName: string,
  prefix: string,
  suffix: string,
  selection: "all" | "newest" = "all",
): Promise<GoogleReviewCsvRow[]> {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });
  const selectedNames = new Set(
    selectReportNames(files.map((file) => file.name), suffix, selection),
  );
  const selected = files.filter((file) => selectedNames.has(file.name));
  const rows: GoogleReviewCsvRow[] = [];
  for (const file of selected) {
    const [buffer] = await file.download();
    rows.push(
      ...(parse(decodeReport(buffer), {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        trim: true,
      }) as GoogleReviewCsvRow[]),
    );
  }
  return rows;
}

function getUserComment(review: GoogleReview) {
  return review.comments?.find((comment) => comment.userComment)?.userComment;
}

export class GooglePlayAdapter implements StoreAdapter {
  readonly platform = "android" as const;
  readonly syncTypes = [
    "downloads",
    "installs",
    "ratings",
    "reviews",
    "releases",
  ] as const;

  private connectionFor(app: AppInfo) {
    const profile = getStoreCredentialProfile(app.code)?.google;
    if (!profile || !app.androidPackageName) {
      throw new StoreConfigurationError(this.platform, app.code);
    }

    const rawCredentials = getEnvironmentVariable(
      profile.serviceAccountJsonEnv,
    );
    const bucketName = getEnvironmentVariable(profile.bucketNameEnv);
    if (!rawCredentials || !bucketName) {
      throw new StoreConfigurationError(this.platform, app.code);
    }

    const credentials = JSON.parse(
      rawCredentials,
    ) as GoogleServiceAccountCredentials;
    return {
      credentials,
      bucketName,
      storage: new Storage({ credentials, projectId: credentials.project_id }),
    };
  }

  async sync(
    app: AppInfo,
    syncTypes?: readonly StoreSyncType[],
  ): Promise<StoreSyncPayload> {
    const { credentials, bucketName, storage } = this.connectionFor(app);
    const errors: string[] = [];
    const shouldSync = (type: StoreSyncType) =>
      !syncTypes || syncTypes.includes(type);

    const [installResult, ratingResult, reviewResult, releaseResult] =
      await Promise.allSettled([
        shouldSync("downloads") || shouldSync("installs")
          ? downloadCsvRows(
              storage,
              bucketName,
              `stats/installs/installs_${app.androidPackageName}_`,
              "_overview.csv",
              "newest",
            )
          : Promise.resolve([]),
        shouldSync("ratings")
          ? downloadCsvRows(
              storage,
              bucketName,
              `stats/ratings/ratings_${app.androidPackageName}_`,
              "_overview.csv",
              "newest",
            )
          : Promise.resolve([]),
        shouldSync("reviews")
          ? this.fetchReviews(app, credentials)
          : Promise.resolve([]),
        shouldSync("releases")
          ? this.fetchReleases(app, credentials)
          : Promise.resolve({ releases: [] }),
      ]);

    if (installResult.status === "rejected") {
      errors.push(`downloads: ${installResult.reason}`);
      errors.push(`installs: ${installResult.reason}`);
    }
    if (ratingResult.status === "rejected") {
      errors.push(`ratings: ${ratingResult.reason}`);
    }
    if (reviewResult.status === "rejected") {
      errors.push(`reviews: ${reviewResult.reason}`);
    }
    if (releaseResult.status === "rejected") {
      errors.push(`releases: ${releaseResult.reason}`);
    }

    const normalized = this.normalizeReports(
      app,
      installResult.status === "fulfilled" ? installResult.value : [],
      ratingResult.status === "fulfilled" ? ratingResult.value : [],
      new Date().toISOString(),
    );

    const reviews =
      reviewResult.status === "fulfilled" ? reviewResult.value : [];
    const releaseData = releaseResult.status === "fulfilled"
      ? releaseResult.value
      : { releases: [] };
    const releases = releaseData.releases;
    return {
      metrics: normalized.metrics,
      reviews,
      releases,
      errors,
      observations: normalized.observations,
      ratingSnapshots: normalized.ratingSnapshots,
    };
  }

  async *backfill(app: AppInfo): AsyncGenerator<StoreSyncPayload> {
    const { credentials, bucketName, storage } = this.connectionFor(app);
    const releaseData = await this.fetchReleases(app, credentials);
    const releases = releaseData.releases;
    yield {
      metrics: [],
      reviews: [],
      releases,
      errors: [],
    };
    const [installRows, ratingRows, reviewRows] = await Promise.all([
      downloadCsvRows(
        storage,
        bucketName,
        `stats/installs/installs_${app.androidPackageName}_`,
        "_overview.csv",
      ),
      downloadCsvRows(
        storage,
        bucketName,
        `stats/ratings/ratings_${app.androidPackageName}_`,
        "_overview.csv",
      ),
      downloadCsvRows(
        storage,
        bucketName,
        `reviews/reviews_${app.androidPackageName}_`,
        ".csv",
      ),
    ]);
    const reviews = parseGoogleReviewRows(app, reviewRows);
    yield {
      ...this.normalizeReports(app, installRows, ratingRows, new Date().toISOString()),
      reviews,
      releases: [],
      errors: [],
    };
  }

  private normalizeReports(
    app: AppInfo,
    installRows: GoogleReviewCsvRow[],
    ratingRows: GoogleReviewCsvRow[],
    observedAt: string,
  ) {
    const installs = parseGoogleInstallReport(app, installRows, observedAt);
    const ratings = parseGoogleRatingReport(app, ratingRows, observedAt);
    const byDate = new Map(
      installs.metrics.map((metric) => [
        metric.date,
        metric,
      ]),
    );
    for (const rating of ratings.metrics) {
      const current = byDate.get(rating.date);
      if (current) current.rating = rating.rating;
      else byDate.set(rating.date, rating);
    }
    return {
      metrics: [...byDate.values()],
      observations: [...installs.observations, ...ratings.observations],
      ratingSnapshots: ratings.snapshots,
    };
  }

  private async fetchReviews(
    app: AppInfo,
    credentials: GoogleServiceAccountCredentials,
  ): Promise<AppReview[]> {
    const auth = this.reviewAuth(credentials);
    const packageName = encodeURIComponent(app.androidPackageName!);
    const reviews: GoogleReview[] = [];
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ maxResults: "100" });
      if (pageToken) {
        query.set("token", pageToken);
      }
      const response = await auth.request<GoogleReviewResponse>({
        url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/reviews?${query}`,
      });
      reviews.push(...(response.data.reviews ?? []));
      pageToken = response.data.tokenPagination?.nextPageToken;
    } while (pageToken);

    return reviews.flatMap((review) => {
      const normalized = this.toAppReview(app, review);
      return normalized ? [normalized] : [];
    });
  }

  private reviewAuth(credentials: GoogleServiceAccountCredentials): JWT {
    return new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
  }

  private async fetchReleases(
    app: AppInfo,
    credentials: GoogleServiceAccountCredentials,
  ) {
    const auth = this.reviewAuth(credentials);
    return fetchGoogleReleaseData(
      { id: app.id, packageName: app.androidPackageName! },
      (options) => auth.request(options),
    );
  }

  private toAppReview(app: AppInfo, review: GoogleReview): AppReview | null {
    const comment = getUserComment(review);
    if (
      !review.reviewId ||
      !comment?.text ||
      !comment.starRating ||
      !comment.lastModified?.seconds
    ) {
      return null;
    }
    return {
      id: review.reviewId,
      appId: app.id,
      platform: this.platform,
      externalId: review.reviewId,
      rating: comment.starRating,
      title: null,
      content: comment.text,
      author: review.authorName ?? null,
      version: comment.appVersionName ?? null,
      device: comment.device ?? null,
      deviceMetadata: comment.deviceMetadata
        ? {
            productName: comment.deviceMetadata.productName ?? null,
            manufacturer: comment.deviceMetadata.manufacturer ?? null,
            deviceClass: comment.deviceMetadata.deviceClass ?? null,
            ramMb: comment.deviceMetadata.ramMb ?? null,
            screenWidthPx: comment.deviceMetadata.screenWidthPx ?? null,
            screenHeightPx: comment.deviceMetadata.screenHeightPx ?? null,
            nativePlatform: comment.deviceMetadata.nativePlatform ?? null,
            screenDensityDpi: comment.deviceMetadata.screenDensityDpi ?? null,
            glEsVersion: comment.deviceMetadata.glEsVersion ?? null,
            cpuModel: comment.deviceMetadata.cpuModel ?? null,
            cpuMake: comment.deviceMetadata.cpuMake ?? null,
          }
        : null,
      androidOsVersion: comment.androidOsVersion ?? null,
      appVersionCode: comment.appVersionCode ?? null,
      reviewerLanguage: comment.reviewerLanguage ?? null,
      thumbsUpCount: comment.thumbsUpCount ?? null,
      thumbsDownCount: comment.thumbsDownCount ?? null,
      source: "google_play_api",
      quality: "exact",
      observedAt: new Date().toISOString(),
      reviewedAt: new Date(
        Number(comment.lastModified.seconds) * 1000,
      ).toISOString(),
    };
  }
}
