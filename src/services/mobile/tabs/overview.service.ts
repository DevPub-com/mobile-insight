import { calculateNegativeReviewRate } from "@/domain/reviews/review.service";
import type { DashboardData, Platform } from "@/domain/types";
import {
  combineConnectedDownloads,
  downloadValue,
  latestActive28DayUsers,
  latestDate,
  latestRating,
  latestRatingAt,
  percentChange,
  periodDateRange,
  periodStart,
  ratingPoints,
  shiftDate,
  sumDownloads,
  type Period,
  type MetricDateRange,
} from "../common/metrics-calculator";

export function buildActiveUserSummary(data: DashboardData) {
  const android = latestActive28DayUsers(data.metrics, "android");
  const ios = latestActive28DayUsers(data.metrics, "ios");
  return {
    total:
      android === null && ios === null ? null : (android ?? 0) + (ios ?? 0),
    android,
    ios,
  };
}

export function buildOverview(data: DashboardData) {
  const endDate = latestDate(data);
  const start30d = periodStart("30d", endDate);
  const previousEnd = shiftDate(start30d, -1);
  const previousStart = periodStart("30d", previousEnd);
  const recentMetrics = data.metrics.filter(
    (metric) => metric.date >= start30d && metric.date <= endDate,
  );
  const previousMetrics = data.metrics.filter(
    (metric) => metric.date >= previousStart && metric.date <= previousEnd,
  );
  const recentReviews = data.reviews.filter((review) => {
    const reviewedAt = review.reviewedAt.slice(0, 10);
    return reviewedAt >= start30d && reviewedAt <= endDate;
  });
  const previousReviews = data.reviews.filter((review) => {
    const reviewedAt = review.reviewedAt.slice(0, 10);
    return reviewedAt >= previousStart && reviewedAt <= previousEnd;
  });
  const platformTotals = (platform: Platform) => {
    const values = data.metrics
      .filter((metric) => metric.platform === platform)
      .map((metric) => downloadValue(data, metric))
      .filter((value): value is number => value !== null);
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const androidDownloads = platformTotals("android");
  const iosDownloads = platformTotals("ios");
  const totalDownloads = combineConnectedDownloads(
    data,
    androidDownloads,
    iosDownloads,
  );
  const currentDownloads30d = combineConnectedDownloads(
    data,
    sumDownloads(
      data,
      recentMetrics.filter((item) => item.platform === "android"),
    ),
    sumDownloads(
      data,
      recentMetrics.filter((item) => item.platform === "ios"),
    ),
  );
  const previousDownloads30d = combineConnectedDownloads(
    data,
    sumDownloads(
      data,
      previousMetrics.filter((item) => item.platform === "android"),
    ),
    sumDownloads(
      data,
      previousMetrics.filter((item) => item.platform === "ios"),
    ),
  );
  const downloads30d = currentDownloads30d;
  const androidRating = latestRating(data, "android");
  const iosRating = latestRating(data, "ios");
  const previousAndroidRating = latestRatingAt(data, "android", previousEnd);
  const previousIosRating = latestRatingAt(data, "ios", previousEnd);
  const ratings = [androidRating, iosRating].filter(
    (rating): rating is number => rating !== null,
  );
  const androidActive28DayUsers = latestActive28DayUsers(
    data.metrics,
    "android",
  );
  const iosActive28DayUsers = latestActive28DayUsers(data.metrics, "ios");
  const active28DayUsers =
    androidActive28DayUsers === null && iosActive28DayUsers === null
      ? null
      : (androidActive28DayUsers ?? 0) + (iosActive28DayUsers ?? 0);

  const negativeReviewRate = calculateNegativeReviewRate(
    recentReviews.map((review) => review.rating),
  );
  const previousNegativeReviewRate = calculateNegativeReviewRate(
    previousReviews.map((review) => review.rating),
  );

  return {
    totalDownloads,
    androidDownloads,
    iosDownloads,
    downloads30d,
    downloads30dChangePercent: percentChange(
      currentDownloads30d,
      previousDownloads30d,
    ),
    rating: ratings.length
      ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
      : null,
    androidRating,
    iosRating,
    androidRatingChangePercent: percentChange(
      androidRating,
      previousAndroidRating,
    ),
    iosRatingChangePercent: percentChange(iosRating, previousIosRating),
    newReviews: recentReviews.length,
    negativeReviewRate,
    negativeReviewRateChangePoints:
      negativeReviewRate === null || previousNegativeReviewRate === null
        ? null
        : negativeReviewRate - previousNegativeReviewRate,
    active28DayUsers,
    androidActive28DayUsers,
    iosActive28DayUsers,
    partialActivePlatforms: (["android", "ios"] as Platform[]).filter(
      (platform) => latestActive28DayUsers(data.metrics, platform) === null,
    ),
    partialPlatforms: (["android", "ios"] as Platform[]).filter(
      (platform) =>
        !data.metrics.some((metric) => metric.platform === platform),
    ),
  };
}

export function buildActiveUserTrend(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  const start = periodStart(period, endDate);
  const byDate = new Map<
    string,
    { date: string; android: number | null; ios: number | null }
  >();
  for (const metric of data.metrics.filter(
    (item) => item.date >= start && item.active28DayUsers !== null,
  )) {
    const row = byDate.get(metric.date) ?? {
      date: metric.date,
      android: null,
      ios: null,
    };
    row[metric.platform] = metric.active28DayUsers;
    byDate.set(metric.date, row);
  }
  return [...byDate.values()].map((row) => ({
    ...row,
    total:
      row.android === null && row.ios === null
        ? null
        : (row.android ?? 0) + (row.ios ?? 0),
  }));
}

export function buildRatingTrend(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  return buildRatingTrendForRange(data, periodDateRange(period, endDate));
}

export function buildRatingTrendForRange(
  data: DashboardData,
  range: MetricDateRange,
) {
  const byDate = new Map<
    string,
    { date: string; android: number | null; ios: number | null }
  >();
  for (const metric of ratingPoints(data).filter(
    (item) => item.date >= range.startDate && item.date <= range.endDate,
  )) {
    const row = byDate.get(metric.date) ?? {
      date: metric.date,
      android: null,
      ios: null,
    };
    row[metric.platform] = metric.rating;
    byDate.set(metric.date, row);
  }
  return [...byDate.values()];
}

export function buildReviewRateTrend(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  return buildReviewRateTrendForRange(data, periodDateRange(period, endDate));
}

export function buildReviewRateTrendForRange(
  data: DashboardData,
  range: MetricDateRange,
) {
  const reviewsByDate = new Map<string, number[]>();

  for (const review of data.reviews) {
    const reviewedAt = review.reviewedAt.slice(0, 10);
    if (reviewedAt < range.startDate || reviewedAt > range.endDate) continue;
    const ratings = reviewsByDate.get(reviewedAt) ?? [];
    ratings.push(review.rating);
    reviewsByDate.set(reviewedAt, ratings);
  }

  const points: Array<{ date: string; rate: number | null }> = [];
  for (
    let cursor = range.startDate;
    cursor <= range.endDate;
    cursor = shiftDate(cursor, 1)
  ) {
    const rate = calculateNegativeReviewRate(reviewsByDate.get(cursor) ?? []);
    points.push({
      date: cursor,
      rate: rate === null ? null : Number(rate.toFixed(1)),
    });
  }
  return points;
}

// Store-displayed Google Play ratings are distinct from GCS Total Average Rating.
export function buildStoreRatingSummary(data: DashboardData) {
  const android = (data.metricObservations ?? [])
    .filter((item) => item.platform === "android" && item.metricKey === "google_play_rating"
      && item.quality !== "unavailable" && item.value !== null && item.value >= 1 && item.value <= 5)
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.observedAt.localeCompare(b.observedAt))
    .at(-1);
  const ios = (data.ratingSnapshots ?? [])
    .filter((item) => item.platform === "ios" && item.quality !== "unavailable"
      && item.averageRating >= 1 && item.averageRating <= 5)
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.observedAt.localeCompare(b.observedAt))
    .at(-1);
  return {
    android: android ? { value: android.value!, date: android.date, source: android.source } : null,
    ios: ios ? { value: ios.averageRating, date: ios.date, source: ios.source } : null,
  };
}
