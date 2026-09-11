import { createHash } from "node:crypto";

import type { GoogleReviewCsvRow } from "@/domain/models/google.model";
import type {
  AppInfo,
  AppReview,
  DailyMetric,
  MetricObservation,
  RatingSnapshot,
} from "@/domain/types";
import { parseNumber } from "@/lib/number";

export type { GoogleReviewCsvRow } from "@/domain/models/google.model";

export function googleReviewIdFromLink(
  link: string | undefined,
): string | null {
  if (!link?.trim()) {
    return null;
  }
  try {
    const url = new URL(link.trim());
    const queryId = url.searchParams.get("reviewId");
    if (queryId) {
      return queryId;
    }
    const legacyId = /(?:^|[#&])ReviewPlace:id=([^&]+)/.exec(url.hash)?.[1];
    return legacyId ? decodeURIComponent(legacyId) : null;
  } catch {
    return null;
  }
}

function reviewExternalId(row: GoogleReviewCsvRow): string {
  const reviewId = googleReviewIdFromLink(row["Review Link"]);
  if (reviewId) {
    return reviewId;
  }
  return createHash("sha256")
    .update(
      [
        row["Package Name"],
        row["Review Submit Millis Since Epoch"],
        row["Reviewer Language"],
        row.Device,
        row["App Version Code"],
      ].join("\u0000"),
    )
    .digest("hex");
}

export function mergeGoogleReviewMetadata(
  exported: AppReview,
  apiReview: AppReview,
): AppReview {
  return {
    ...exported,
    author: apiReview.author ?? exported.author,
    version: apiReview.version ?? exported.version,
    device: apiReview.device ?? exported.device,
    deviceMetadata: apiReview.deviceMetadata ?? exported.deviceMetadata,
    androidOsVersion: apiReview.androidOsVersion ?? exported.androidOsVersion,
    appVersionCode: apiReview.appVersionCode ?? exported.appVersionCode,
    reviewerLanguage: apiReview.reviewerLanguage ?? exported.reviewerLanguage,
    thumbsUpCount: apiReview.thumbsUpCount ?? exported.thumbsUpCount,
    thumbsDownCount: apiReview.thumbsDownCount ?? exported.thumbsDownCount,
  };
}

export function parseGoogleRatingReport(
  app: AppInfo,
  rows: GoogleReviewCsvRow[],
  observedAt: string,
) {
  const metrics: DailyMetric[] = [];
  const observations: MetricObservation[] = [];
  const snapshots: RatingSnapshot[] = [];
  for (const row of rows) {
    const date = row.Date;
    if (!date) continue;
    const daily = parseNumber(row["Daily Average Rating"]);
    const total = parseNumber(row["Total Average Rating"]);
    if (daily !== null) {
      observations.push({
        appId: app.id,
        platform: "android",
        date,
        metricKey: "daily_average_rating",
        value: daily,
        source: "google_play_gcs",
        quality: "exact",
        observedAt,
        description: "해당 날짜에 제출된 평점의 평균",
      });
    }
    if (total === null) continue;
    observations.push({
      appId: app.id,
      platform: "android",
      date,
      metricKey: "overview_rating",
      value: total,
      source: "google_play_gcs",
      quality: "exact",
      observedAt,
      description: "해당 날짜까지의 Google Play 누적 평균 평점",
    });
    metrics.push({
      appId: app.id,
      platform: "android",
      date,
      downloads: null,
      installs: null,
      uninstalls: null,
      crashes: null,
      anrs: null,
      rating: total,
      ratingCount: null,
      reviewCount: null,
      active1DayUsers: null,
      active7DayUsers: null,
      active28DayUsers: null,
      sessions: null,
    });
    snapshots.push({
      appId: app.id,
      platform: "android",
      territory: "GLOBAL",
      date,
      averageRating: total,
      ratingCount: null,
      source: "google_play_gcs",
      quality: "exact",
      observedAt,
      description: "Google Play overview rating report",
    });
  }
  return { metrics, observations, snapshots };
}

export function parseGoogleReviewRows(
  app: AppInfo,
  rows: GoogleReviewCsvRow[],
): AppReview[] {
  return rows.flatMap((row) => {
    if (row["Package Name"]?.trim() !== app.androidPackageName) {
      return [];
    }
    const content = row["Review Text"]?.trim();
    const rating = Number(row["Star Rating"]);
    const timestamp = Number(
      row["Review Last Update Millis Since Epoch"] ||
        row["Review Submit Millis Since Epoch"],
    );
    if (
      !content ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      !Number.isFinite(timestamp) ||
      timestamp <= 0
    ) {
      return [];
    }
    const externalId = reviewExternalId(row);
    return [
      {
        id: externalId,
        appId: app.id,
        platform: "android" as const,
        externalId,
        rating,
        title: row["Review Title"]?.trim() || null,
        content,
        author: null,
        version: row["App Version Name"]?.trim() || null,
        device: row.Device?.trim() || null,
        deviceMetadata: null,
        androidOsVersion: null,
        appVersionCode: parseNumber(row["App Version Code"]),
        reviewerLanguage: row["Reviewer Language"]?.trim() || null,
        thumbsUpCount: null,
        thumbsDownCount: null,
        source: "google_play_gcs",
        quality: "exact",
        observedAt: new Date().toISOString(),
        reviewedAt: new Date(timestamp).toISOString(),
      },
    ];
  });
}

export function selectNewestReportNames(names: string[]): string[] {
  if (!names.length) {
    return [];
  }
  return [names.toSorted().at(-1)!];
}

export function selectReportNames(
  names: string[],
  suffix: string,
  selection: "all" | "newest" | "recent" = "all",
): string[] {
  const matching = names.filter((name) => name.endsWith(suffix)).toSorted();
  // Re-read the previous monthly report too: late data can arrive after rollover.
  if (selection === "recent") return matching.slice(-2);
  return selection === "newest" ? selectNewestReportNames(matching) : matching;
}
