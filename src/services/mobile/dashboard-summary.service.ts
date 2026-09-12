import { displayReleaseVersion } from "./common/release-version";
import { latestNegativeReviews } from "@/domain/reviews/review.service";
import type {
  AppRelease,
  DashboardData,
  MetricQuality,
  Platform,
} from "@/domain/types";

import {
  availableMetricDateRange,
  dateRangeDays,
  latestDate,
  latestActive28DayUsers,
  metricQualityForRange,
  periodDateRange,
  previousDateRange,
  reviewQualityForRange,
  type MetricDateRange,
  type Period,
} from "./common/metrics-calculator";
import {
  buildDateRangeSummary,
  buildDownloadTrendForRange,
} from "./tabs/downloads.service";
import { buildRatingTrendForRange } from "./tabs/overview.service";
import { buildReleaseImpact } from "./tabs/release-impact.service";

import { buildCrashHistory } from "./crash-history.service";

const platforms: Platform[] = ["android", "ios"];

function periodWindow(range: MetricDateRange, value: Period | "custom") {
  const previous = previousDateRange(range);
  return {
    value,
    ...(value === "custom" ? { days: dateRangeDays(range) } : {}),
    ...range,
    previousStartDate: previous.startDate,
    previousEndDate: previous.endDate,
  };
}

function worstQuality(values: MetricQuality[]): MetricQuality {
  if (!values.length) return "unavailable";
  const priority: Record<MetricQuality, number> = {
    exact: 0,
    derived: 1,
    estimated: 2,
    unavailable: 3,
  };
  return values.reduce(
    (worst, value) => (priority[value] > priority[worst] ? value : worst),
    "exact",
  );
}

function ratingQuality(
  data: DashboardData,
  range: MetricDateRange,
  platform: Platform,
): MetricQuality {
  if (data.source === "demo") return "derived";
  const snapshots = (data.ratingSnapshots ?? []).filter(
    (item) =>
      item.platform === platform &&
      item.date >= range.startDate &&
      item.date <= range.endDate,
  );
  return snapshots.length
    ? worstQuality(snapshots.map((item) => item.quality ?? "derived"))
    : "unavailable";
}

function platformNegativeReview(
  data: DashboardData,
  platform: Platform,
  window: ReturnType<typeof periodWindow>,
) {
  const rate = (from: string, to: string) => {
    const reviews = data.reviews.filter((review) => {
      const date = review.reviewedAt.slice(0, 10);
      return review.platform === platform && date >= from && date <= to;
    });
    return reviews.length
      ? Number(
          (
            (reviews.filter((review) => review.rating <= 2).length /
              reviews.length) *
            100
          ).toFixed(1),
        )
      : null;
  };
  const value = rate(window.startDate, window.endDate);
  const previous = rate(window.previousStartDate, window.previousEndDate);
  const selectedReviews = data.reviews.filter((review) => {
    const date = review.reviewedAt.slice(0, 10);
    return (
      review.platform === platform &&
      date >= window.startDate &&
      date <= window.endDate
    );
  });
  const reviewsByDate = selectedReviews.reduce((groups, review) => {
    const reviewDate = review.reviewedAt.slice(0, 10);
    const group = groups.get(reviewDate) ?? [];
    group.push(review);
    groups.set(reviewDate, group);
    return groups;
  }, new Map<string, typeof selectedReviews>());
  const sparkline = [...reviewsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, reviews]) =>
      Number(
        (
          (reviews.filter((review) => review.rating <= 2).length /
            reviews.length) *
          100
        ).toFixed(1),
      ),
    );
  return {
    value,
    changePoints:
      value === null || previous === null
        ? null
        : Number((value - previous).toFixed(1)),
    unit: "percent" as const,
    sparkline,
    quality:
      value === null
        ? ("unavailable" as const)
        : reviewQualityForRange(data, window),
  };
}

function sortedReleases(data: DashboardData): AppRelease[] {
  return [...data.releases].sort((left, right) =>
    right.releasedAt.localeCompare(left.releasedAt),
  );
}

function difference(
  before: number | null,
  after: number | null,
  decimals: number,
) {
  if (before === null || after === null) return null;
  return Number(
    (
      Number(after.toFixed(decimals)) - Number(before.toFixed(decimals))
    ).toFixed(decimals),
  );
}

function stabilityRate(
  data: DashboardData,
  metricKey: string,
  range: MetricDateRange,
) {
  const observations = (data.metricObservations ?? [])
    .filter(
      (item) =>
        item.platform === "android" &&
        item.metricKey === metricKey &&
        item.value !== null,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const currentRows = observations.filter(
    (item) => item.date >= range.startDate && item.date <= range.endDate,
  );
  const previous = previousDateRange(range);
  const previousValue = observations
    .filter(
      (item) =>
        item.date >= previous.startDate && item.date <= previous.endDate,
    )
    .at(-1)?.value ?? null;
  const current = currentRows.at(-1);
  const value = current?.value ?? null;
  return {
    value,
    changePoints: difference(previousValue, value, 3),
    sparkline: currentRows.flatMap((item) =>
      item.value === null ? [] : [item.value],
    ),
    quality: current?.quality ?? ("unavailable" as const),
    asOfDate: current?.date ?? null,
    observedAt: current?.observedAt ?? null,
  };
}

export function buildDashboardSummary(data: DashboardData, period: Period) {
  return buildDashboardSummaryForRange(
    data,
    periodDateRange(period, latestDate(data)),
    period,
  );
}

export function buildDashboardSummaryForRange(
  data: DashboardData,
  range: MetricDateRange,
  value: Period | "custom" = "custom",
) {
  const window = periodWindow(range, value);
  const periodSummary = buildDateRangeSummary(data, range);
  const downloads = buildDownloadTrendForRange(data, range);
  const ratings = buildRatingTrendForRange(data, range);
  const releases = sortedReleases(data);
  const reviewQuality = reviewQualityForRange(data, range);
  const activeUserMetrics = data.metrics.filter(
    (item) => item.date >= range.startDate && item.date <= range.endDate,
  );
  const androidActive28DayUsers = latestActive28DayUsers(
    activeUserMetrics,
    "android",
  );
  const iosActive28DayUsers = latestActive28DayUsers(activeUserMetrics, "ios");
  const hasActive28DayUsers =
    androidActive28DayUsers !== null || iosActive28DayUsers !== null;
  const connectedDownloadPlatforms = platforms.filter((platform) =>
    platform === "android"
      ? Boolean(data.app.androidPackageName)
      : Boolean(data.app.iosAppId || data.app.iosBundleId),
  );
  const downloadQualities = connectedDownloadPlatforms.map((platform) =>
    metricQualityForRange(
      data,
      range,
      [platform === "android" ? "daily_user_installs" : "total_downloads"],
      platform,
    ),
  );

  const crashIssues = Object.fromEntries(
    platforms.map((platform) => {
      const value = data.crashIssues?.find(
        (item) => item.platform === platform,
      );
      return [
        platform,
        {
          value: value?.current ?? null,
          change: value?.change ?? null,
          changePercent: value?.changePercent ?? null,
          sparkline: value?.sparkline ?? [],
          quality:
            value?.quality ??
            (value
              ? data.source === "demo"
                ? "derived"
                : "exact"
              : "unavailable"),
        },
      ];
    }),
  ) as Record<
    Platform,
    {
      value: number | null;
      change: number | null;
      changePercent: number | null;
      sparkline: number[];
      quality: MetricQuality;
    }
  >;

  type ReleaseImpact = NonNullable<ReturnType<typeof buildReleaseImpact>>;
  type ReleasePlatformSummary = {
    release: AppRelease | null;
    rating: {
      before: number | null;
      after: number | null;
      change: number | null;
    };
    negativeReviews: {
      before: number | null;
      after: number | null;
      changePoints: number | null;
    };
    reviewCount: {
      before: number | null;
      after: number | null;
      change: number | null;
      changePercent: number | null;
    };
    downloads: {
      before: number | null;
      after: number | null;
      change: number | null;
      changePercent: number | null;
    };
    sparklines: { rating: number[]; negativeReviews: number[]; reviewCount: number[]; downloads: number[] };
    crashIssues: (typeof crashIssues)[Platform];
    crashReports: ReturnType<typeof buildCrashHistory>["android"] & { sparkline: number[] };
    windows: ReleaseImpact["windows"] | null;
    coverage: ReleaseImpact["coverage"] | null;
  };
  const releasePlatforms = Object.fromEntries(
    platforms.map((platform) => {
      const release =
        releases.find((item) => item.platform === platform) ?? null;
      const dataThrough = latestDate(data);
      const releaseDate = release?.releasedAt.slice(0, 10) ?? null;
      const releaseWindowDays =
        releaseDate !== null && releaseDate <= dataThrough
          ? dateRangeDays({ startDate: releaseDate, endDate: dataThrough })
          : null;
      const impact = release && releaseWindowDays
        ? buildReleaseImpact(
            data,
            release.version,
            platform,
            releaseWindowDays,
            releaseWindowDays,
            true,
          )
        : null;
      const releaseRange = { startDate: releaseDate ?? dataThrough, endDate: dataThrough };
      const reports = buildCrashHistory({ ...data, metricObservations: (data.metricObservations ?? [])
        .filter(row => row.metricKey === `crash_report_count:version:${release?.version}`)
        .map(row => ({ ...row, metricKey: "crash_report_count" })) }, releaseRange);
      const dailyImpact = reports.trend.map(point => {
        const reviews = data.reviews.filter(row => row.platform === platform && row.version != null && release != null && displayReleaseVersion(platform, row.version) === displayReleaseVersion(platform, release.version) && row.reviewedAt.slice(0, 10) === point.date);
        return { date: point.date, reviews };
      });
      const collectedDownloads = data.metrics.filter((metric) =>
        metric.platform === platform && metric.date >= releaseRange.startDate && metric.date <= releaseRange.endDate,
      ).flatMap((metric) => metric.downloads === null ? [] : [metric.downloads]);
      const downloadAfter = impact?.downloads.after ?? (collectedDownloads.length
        ? collectedDownloads.reduce((sum, count) => sum + count, 0) : null);
      const comparisonWindowComplete =
        impact !== null && latestDate(data) >= impact.windows.after.to;
      const downloadCoverageComplete =
        impact !== null &&
        impact.coverage.downloads.before ===
          impact.coverage.downloads.expectedBefore &&
        impact.coverage.downloads.after ===
          impact.coverage.downloads.expectedAfter;
      return [
        platform,
        {
          release,
          rating: {
            before: impact?.rating.before ?? null,
            after: impact?.rating.after ?? null,
            change: impact
              ? difference(impact.rating.before, impact.rating.after, 2)
              : null,
          },
          negativeReviews: {
            before: impact?.negativeReviews.before ?? null,
            after: impact?.negativeReviews.after ?? null,
            changePoints: impact?.negativeReviews.changePoints ?? null,
          },
          reviewCount: {
            before: impact?.newReviews.before ?? null,
            after: impact?.newReviews.after ? impact.newReviews.after : null,
            change: impact && impact.newReviews.after > 0 && impact.newReviews.before > 0 && comparisonWindowComplete
              ? impact.newReviews.after - impact.newReviews.before
              : null,
            changePercent: comparisonWindowComplete
              ? (impact?.newReviews.changePercent ?? null)
              : null,
          },
          downloads: {
            before: impact?.downloads.before ?? null,
            after: downloadAfter,
            change: impact && comparisonWindowComplete && downloadCoverageComplete
              ? difference(impact.downloads.before, impact.downloads.after, 0)
              : null,
            changePercent:
              comparisonWindowComplete && downloadCoverageComplete
                ? (impact?.downloads.changePercent ?? null)
                : null,
          },
          sparklines: {
            rating: dailyImpact.flatMap(({reviews}) => reviews.length ? [reviews.reduce((sum, row) => sum + row.rating, 0) / reviews.length] : []),
            negativeReviews: dailyImpact.flatMap(({reviews}) => reviews.length ? [reviews.filter(row => row.rating <= 2).length / reviews.length * 100] : []),
            reviewCount: dailyImpact.flatMap(({reviews}) => reviews.length ? [reviews.length] : []),
            downloads: collectedDownloads,
          },
          crashIssues: crashIssues[platform],
          crashReports: { ...reports[platform], sparkline: reports.trend.flatMap((point) => point[platform] === null ? [] : [point[platform]]) },
          windows: impact?.windows ?? null,
          coverage: impact?.coverage ?? null,
        },
      ];
    }),
  ) as Record<Platform, ReleasePlatformSummary>;

  return {
    app: data.app,
    availableDateRange: availableMetricDateRange(data),
    period: window,
    kpis: {
      downloads: {
        value: periodSummary.downloads,
        changePercent: periodSummary.downloadChangePercent,
        unit: "count" as const,
        quality: worstQuality(downloadQualities),
        sparkline: downloads.map((item) => item.total),
      },
      ratings: {
        android: {
          value: periodSummary.androidRating,
          change: periodSummary.androidRatingChange,
          unit: "score" as const,
          quality: ratingQuality(data, range, "android"),
          sparkline: ratings.flatMap((item) =>
            item.android === null ? [] : [item.android],
          ),
        },
        ios: {
          value: periodSummary.iosRating,
          change: periodSummary.iosRatingChange,
          unit: "score" as const,
          quality: ratingQuality(data, range, "ios"),
          sparkline: ratings.flatMap((item) =>
            item.ios === null ? [] : [item.ios],
          ),
        },
      },
      negativeReviews: {
        android: platformNegativeReview(data, "android", window),
        ios: platformNegativeReview(data, "ios", window),
      },
      monthlyActiveUsers: {
        // Platform groups are not safe to sum because one GA4 user can use both.
        value: null,
        android: androidActive28DayUsers,
        ios: iosActive28DayUsers,
        quality:
          hasActive28DayUsers ? "exact" as const : "unavailable" as const,
      },
      stability: {
        crashRate: stabilityRate(
          data,
          "user_perceived_crash_rate_28d",
          range,
        ),
        anrRate: stabilityRate(
          data,
          "user_perceived_anr_rate_28d",
          range,
        ),
      },
      crashIssues,
    },
    charts: { downloads, ratings },
    negativeReviewsTop10: latestNegativeReviews(
      data.reviews.filter((review) => {
        const reviewedAt = review.reviewedAt.slice(0, 10);
        return reviewedAt >= window.startDate && reviewedAt <= window.endDate;
      }),
      10,
    ),
    latestReleaseImpact: {
      release: releases[0] ?? null,
      platforms: releasePlatforms,
    },
    dataQuality: {
      downloads: worstQuality(downloadQualities),
      ratings: worstQuality(
        platforms.map((platform) => ratingQuality(data, range, platform)),
      ),
      reviews: reviewQuality,
      crashIssues: worstQuality(
        platforms.map((platform) => crashIssues[platform].quality),
      ),
      reviewDataTruncated: data.reviewDataTruncated ?? false,
    },
  };
}

export type DashboardSummary = ReturnType<typeof buildDashboardSummary>;
