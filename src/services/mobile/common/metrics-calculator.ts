import type {
  DailyMetric,
  DashboardData,
  MetricQuality,
  Platform,
} from "@/domain/types";
import { isoDate } from "@/lib/date";

export type Period = "7d" | "28d" | "30d" | "3m" | "6m" | "1y";
export type ReviewPeriod = "all" | "7d" | "30d" | "3m";
export type ReviewRatingGroup = "all" | "negative" | "neutral" | "positive";

export const periodDays: Record<Period, number> = {
  "7d": 7,
  "28d": 28,
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export function periodStart(period: Period, endDate: string): string {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - (periodDays[period] - 1));
  return isoDate(date);
}

export const qualityPriority: Record<MetricQuality, number> = {
  exact: 0,
  derived: 1,
  estimated: 2,
  unavailable: 3,
};

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function latestDate(data: DashboardData): string {
  const dates = data.metrics.map((metric) => metric.date);
  return dates.length
    ? dates.reduce((max, date) => (date > max ? date : max), "")
    : isoDate(new Date());
}

export function metricQualityForPeriod(
  data: DashboardData,
  period: Period,
  metricKeys: string[],
  platform?: Platform,
): MetricQuality {
  if (data.source === "demo") return "derived";
  const endDate = latestDate(data);
  const startDate = periodStart(period, endDate);
  const observations = (data.metricObservations ?? []).filter(
    (item) =>
      metricKeys.includes(item.metricKey) &&
      (!platform || item.platform === platform) &&
      item.date >= startDate &&
      item.date <= endDate,
  );
  if (!observations.length) return "unavailable";
  const worst = observations.reduce<MetricQuality>(
    (quality, item) =>
      qualityPriority[item.quality] > qualityPriority[quality]
        ? item.quality
        : quality,
    "exact",
  );
  if (worst !== "exact") return worst;

  const observedDates = new Set(observations.map((item) => item.date));
  for (let cursor = startDate; cursor <= endDate; cursor = shiftDate(cursor, 1)) {
    if (!observedDates.has(cursor)) return "derived";
  }
  return "exact";
}

export function reviewQualityForPeriod(
  data: DashboardData,
  period: Period,
): MetricQuality {
  if (data.source === "demo" || data.reviewDataTruncated) return "derived";
  const endDate = latestDate(data);
  const startDate = periodStart(period, endDate);
  const reviews = data.reviews.filter((review) => {
    const date = review.reviewedAt.slice(0, 10);
    return date >= startDate && date <= endDate;
  });
  if (!reviews.length) return "unavailable";
  if (reviews.some((review) => review.quality === "estimated")) return "estimated";
  if (reviews.some((review) => review.quality === "derived")) return "derived";
  return "exact";
}

export function percentChange(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function downloadValue(data: DashboardData, metric: DailyMetric): number | null {
  if (data.metricObservations === undefined) return metric.downloads;
  const metricKey =
    metric.platform === "android" ? "daily_user_installs" : "total_downloads";
  return (
    data.metricObservations.find(
      (observation) =>
        observation.platform === metric.platform &&
        observation.date === metric.date &&
        observation.metricKey === metricKey,
    )?.value ?? null
  );
}

export function sumDownloads(
  data: DashboardData,
  metrics: DailyMetric[],
): number | null {
  const values = metrics
    .map((metric) => downloadValue(data, metric))
    .filter((value): value is number => value !== null);
  return values.length
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

export function combineConnectedDownloads(
  data: DashboardData,
  android: number | null,
  ios: number | null,
): number | null {
  if (android === null && ios === null) {
    return null;
  }
  return (android ?? 0) + (ios ?? 0);
}

export function latestActive28DayUsers(
  metrics: DailyMetric[],
  platform: Platform,
): number | null {
  return (
    metrics
      .filter(
        (metric) =>
          metric.platform === platform && metric.active28DayUsers !== null,
      )
      .at(-1)?.active28DayUsers ?? null
  );
}

export function ratingPoints(data: DashboardData) {
  if (data.ratingSnapshots !== undefined) {
    return data.ratingSnapshots.map((snapshot) => ({
      platform: snapshot.platform,
      date: snapshot.date,
      rating: snapshot.averageRating,
    }));
  }
  return data.metrics.map((metric) => ({
    platform: metric.platform,
    date: metric.date,
    rating: metric.rating,
  }));
}

export function latestRating(
  data: DashboardData,
  platform: Platform,
): number | null {
  return (
    ratingPoints(data)
      .filter(
        (metric) => metric.platform === platform && metric.rating !== null,
      )
      .at(-1)?.rating ?? null
  );
}

export function latestRatingAt(
  data: DashboardData,
  platform: Platform,
  onOrBefore: string,
): number | null {
  return (
    ratingPoints(data)
      .filter(
        (metric) =>
          metric.platform === platform &&
          metric.date <= onOrBefore &&
          metric.rating !== null,
      )
      .at(-1)?.rating ?? null
  );
}

export function latestRatingBetween(
  data: DashboardData,
  platform: Platform,
  from: string,
  to: string,
): number | null {
  return (
    ratingPoints(data)
      .filter(
        (point) =>
          point.platform === platform &&
          point.date >= from &&
          point.date <= to &&
          point.rating !== null,
      )
      .sort((left, right) => left.date.localeCompare(right.date))
      .at(-1)?.rating ?? null
  );
}

export function ratingChangeForPeriod(
  currentMetrics: Array<{
    platform: Platform;
    date: string;
    rating: number | null;
  }>,
  platform: Platform,
  currentRating: number | null,
  previousRating: number | null,
): number | null {
  if (currentRating === null) return null;
  const visibleRatings = currentMetrics
    .filter(
      (metric) => metric.platform === platform && metric.rating !== null,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const baseline =
    previousRating ??
    (visibleRatings.length >= 2 ? visibleRatings[0].rating : null);
  return baseline === null
    ? null
    : Number((currentRating - baseline).toFixed(2));
}
