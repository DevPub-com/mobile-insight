import { importPKCS8, SignJWT } from "jose";

import { getStoreCredentialProfile } from "@/config/store-config";
import type { AppInfo, AppReview } from "@/domain/types";

import type {
  AppleCredentials,
  AppleIncludedResource,
  AppleLookupResponse,
  AppleReviewResponse,
  AppleVersionResponse,
  AppleVersions,
} from "@/domain/models/apple.model";
import { fetchAppleReviewsWithVersions, toAppleRatingReport } from "../apple-reviews";
import {
  StoreConfigurationError,
  type StoreAdapter,
  type StoreSyncPayload,
  type StoreSyncType,
} from "@/services/mobile/common/store-adapter";
import { normalizeAppleReleases } from "../apple-releases";
import {
  fetchAppleDownloadAnalytics,
  fetchAppleInstallAnalyticsReport,
} from "../apple-installs";
import { isoDate } from "@/lib/date";
import { fetchAppleCrashCounts } from "../apple-crashes";
import { getEnvironmentVariable } from "@/lib/env";

async function createToken(credentials: AppleCredentials): Promise<string> {
  const key = await importPKCS8(credentials.privateKey.replaceAll("\\n", "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: credentials.keyId, typ: "JWT" })
    .setIssuer(credentials.issuerId)
    .setAudience("appstoreconnect-v1")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(key);
}

async function appleJson<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`;
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });
  if (!response.ok) throw new Error(`App Store Connect ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export class AppStoreAdapter implements StoreAdapter {
  readonly platform = "ios" as const;
  readonly syncTypes = ["downloads", "installs", "ratings", "reviews", "releases", "stability"] as const;

  private credentialsFor(app: AppInfo): AppleCredentials {
    const profile = getStoreCredentialProfile(app.code)?.apple;
    if (!profile || !app.iosAppId) throw new StoreConfigurationError(this.platform, app.code);

    const credentials: AppleCredentials = {
      issuerId: getEnvironmentVariable(profile.issuerIdEnv) ?? "",
      keyId: getEnvironmentVariable(profile.keyIdEnv) ?? "",
      privateKey: getEnvironmentVariable(profile.privateKeyEnv) ?? "",
      vendorNumber: getEnvironmentVariable(profile.vendorNumberEnv) ?? "",
    };
    if (Object.values(credentials).some((value) => !value)) {
      throw new StoreConfigurationError(this.platform, app.code);
    }
    return credentials;
  }

  async sync(
    app: AppInfo,
    syncTypes?: readonly StoreSyncType[],
  ): Promise<StoreSyncPayload> {
    const credentials = this.credentialsFor(app);
    const token = await createToken(credentials);
    const errors: string[] = [];
    const appleApi = <T>(path: string, init?: RequestInit) =>
      appleJson<T>(path, token, init);
    const shouldSync = (type: StoreSyncType) =>
      !syncTypes || syncTypes.includes(type);

    const downloadsPromise =
      shouldSync("downloads")
        ? fetchAppleDownloadAnalytics(app.id, app.iosAppId!, appleApi)
        : null;
    const versionsPromise =
      shouldSync("releases") || shouldSync("reviews") ? this.fetchVersions(app, token) : null;
    const [
      downloadsResult,
      installsResult,
      ratingResult,
      reviewsResult,
      releasesResult,
      crashesResult,
    ] = await Promise.allSettled([
      downloadsPromise ?? Promise.resolve({ metrics: [], observations: [] }),
      shouldSync("installs")
        ? fetchAppleInstallAnalyticsReport(app.id, app.iosAppId!, appleApi)
        : Promise.resolve({ metrics: [], observations: [] }),
      shouldSync("ratings") ? this.fetchRating(app) : Promise.resolve(null),
      shouldSync("reviews")
        ? versionsPromise!.then((versions) => this.fetchReviews(app, token, versions))
        : Promise.resolve([]),
      shouldSync("releases") && versionsPromise
        ? versionsPromise.then((versions) =>
            normalizeAppleReleases(app.id, versions.data, versions.included),
          )
        : Promise.resolve([]),
      shouldSync("stability")
        ? fetchAppleCrashCounts(app.id, app.iosAppId!, appleApi)
        : Promise.resolve([]),
    ]);

    if (downloadsResult.status === "rejected") {
      errors.push(`downloads: ${downloadsResult.reason}`);
    }
    if (installsResult.status === "rejected") {
      errors.push(`installs: ${installsResult.reason}`);
    }
    if (ratingResult.status === "rejected") {
      errors.push(`ratings: ${ratingResult.reason}`);
    }
    if (reviewsResult.status === "rejected") {
      errors.push(`reviews: ${reviewsResult.reason}`);
    }
    if (releasesResult.status === "rejected") {
      errors.push(`releases: ${releasesResult.reason}`);
    }
    if (crashesResult.status === "rejected") {
      errors.push(`stability: ${crashesResult.reason}`);
    }

    const metrics = downloadsResult.status === "fulfilled" ? [...downloadsResult.value.metrics] : [];
    if (installsResult.status === "fulfilled") {
      for (const lifecycle of installsResult.value.metrics) {
        const existing = metrics.find((metric) => metric.date === lifecycle.date);
        if (existing) {
          existing.installs = lifecycle.installs;
          existing.uninstalls = lifecycle.uninstalls;
        } else {
          metrics.push(lifecycle);
        }
      }
    }
    if (ratingResult.status === "fulfilled" && ratingResult.value) {
      const existing = metrics.find((metric) => metric.date === ratingResult.value?.metric.date);
      if (existing) {
        existing.rating = ratingResult.value.metric.rating;
        existing.ratingCount = ratingResult.value.metric.ratingCount;
      } else {
        metrics.push(ratingResult.value.metric);
      }
    }

    const releases = releasesResult.status === "fulfilled" ? releasesResult.value : [];
    return {
      metrics,
      reviews: reviewsResult.status === "fulfilled" ? reviewsResult.value : [],
      releases,
      observations: [
        ...(downloadsResult.status === "fulfilled" ? downloadsResult.value.observations : []),
        ...(installsResult.status === "fulfilled" ? installsResult.value.observations : []),
        ...(crashesResult.status === "fulfilled" ? crashesResult.value : []),
      ],
      ratingSnapshots:
        ratingResult.status === "fulfilled" && ratingResult.value
          ? [ratingResult.value.snapshot]
          : [],
      errors,
    };
  }

  async *backfill(app: AppInfo): AsyncGenerator<StoreSyncPayload> {
    const credentials = this.credentialsFor(app);
    const token = await createToken(credentials);
    const deferredErrors: string[] = [];

    try {
      const versions = await this.fetchVersions(app, token);
      const [reviews, releases] = await Promise.all([
        this.fetchReviews(app, token, versions),
        Promise.resolve(
          normalizeAppleReleases(app.id, versions.data, versions.included),
        ),
      ]);
      yield {
        metrics: [],
        reviews,
        releases,
        errors: [],
      };
    } catch (error) {
      deferredErrors.push(
        `versions/reviews: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const downloads = await fetchAppleDownloadAnalytics(
        app.id,
        app.iosAppId!,
        (path, init) => appleJson(path, token, init),
        { accessType: "ONE_TIME_SNAPSHOT", maxInstances: null },
      );
      yield { ...downloads, reviews: [], releases: [], errors: [] };
    } catch (error) {
      deferredErrors.push(
        `downloads: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    try {
      const lifecycle = await fetchAppleInstallAnalyticsReport(
        app.id,
        app.iosAppId!,
        (path, init) => appleJson(path, token, init),
        { accessType: "ONE_TIME_SNAPSHOT", maxInstances: null },
      );
      yield { ...lifecycle, reviews: [], releases: [], errors: [] };
    } catch (error) {
      deferredErrors.push(
        `installations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (deferredErrors.length) throw new Error(deferredErrors.join(" | "));
  }

  private async fetchRating(app: AppInfo) {
    const query = new URLSearchParams({ id: app.iosAppId!, country: "kr" });
    const response = await fetch(`https://itunes.apple.com/lookup?${query}`);
    if (!response.ok) throw new Error(`App Store lookup ${response.status}: ${await response.text()}`);
    const payload = (await response.json()) as AppleLookupResponse;
    if (payload.resultCount < 1 || !payload.results[0]) return null;
    return toAppleRatingReport(
      app.id,
      isoDate(new Date()),
      "KOR",
      payload.results[0],
    );
  }

  private async fetchVersions(
    app: AppInfo,
    token: string,
  ): Promise<AppleVersions> {
    const versions: AppleVersionResponse["data"] = [];
    const included: AppleIncludedResource[] = [];
    let next: string | undefined =
      `/v1/apps/${encodeURIComponent(app.iosAppId!)}/appStoreVersions?limit=200&include=appStoreVersionLocalizations,build,appStoreVersionPhasedRelease&fields[appStoreVersions]=platform,versionString,earliestReleaseDate,createdDate,appStoreState,releaseType,appStoreVersionLocalizations,build,appStoreVersionPhasedRelease&fields[appStoreVersionLocalizations]=locale,whatsNew&fields[builds]=version&fields[appStoreVersionPhasedReleases]=phasedReleaseState,startDate,totalPauseDuration,currentDayNumber&limit[appStoreVersionLocalizations]=50`;
    while (next) {
      const response: AppleVersionResponse = await appleJson<AppleVersionResponse>(next, token);
      versions.push(...response.data);
      included.push(...(response.included ?? []));
      next = response.links?.next;
    }
    return { data: versions, included };
  }

  private async fetchReviews(
    app: AppInfo,
    token: string,
    versions: AppleVersions,
  ): Promise<AppReview[]> {
    return fetchAppleReviewsWithVersions(
      app.id,
      app.iosAppId!,
      versions.data,
      (path) => appleJson<AppleReviewResponse>(path, token),
    );
  }
}
