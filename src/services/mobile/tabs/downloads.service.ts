import { calculateNegativeReviewRate } from "@/domain/reviews/review.service";
import type { DailyMetric, DashboardData, MetricObservation, Platform } from "@/domain/types";
import {
  combineConnectedDownloads,
  downloadValue,
  latestDate,
  latestRatingBetween,
  percentChange,
  periodDateRange,
  periodStart,
  previousDateRange,
  ratingChangeForPeriod,
  ratingPoints,
  shiftDate,
  sumDownloads,
  type Period,
  type MetricDateRange,
} from "../common/metrics-calculator";

export function buildDownloadTrend(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  return buildDownloadTrendForRange(data, periodDateRange(period, endDate));
}

export function buildDownloadTrendForRange(
  data: DashboardData,
  range: MetricDateRange,
) {
  const byDate = new Map<
    string,
    { date: string; android: number | null; ios: number | null }
  >();

  for (
    let cursor = range.startDate;
    cursor <= range.endDate;
    cursor = shiftDate(cursor, 1)
  ) {
    byDate.set(cursor, {
      date: cursor,
      android: null,
      ios: null,
    });
  }

  for (const metric of data.metrics.filter(
    (item) => item.date >= range.startDate && item.date <= range.endDate,
  )) {
    const row = byDate.get(metric.date);
    if (row) {
      row[metric.platform] = downloadValue(data, metric);
    }
  }

  return [...byDate.values()].map((row) => {
    const { android, ios } = row;
    const total =
      android === null && ios === null
        ? null
        : (android ?? 0) + (ios ?? 0);
    return {
      date: row.date,
      android,
      ios,
      total,
    };
  });
}

export type DownloadDataStatus = "available" | "missing" | "delayed";

export function buildFirstOpenTrend(
  observations: MetricObservation[],
  appId: string,
  range: MetricDateRange,
) {
  const rows = new Map<string, { date: string; android: number | null; ios: number | null }>();
  for (let date = range.startDate; date <= range.endDate; date = shiftDate(date, 1)) {
    rows.set(date, { date, android: null, ios: null });
  }
  for (const observation of [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    if (observation.appId !== appId || observation.source !== "firebase" || observation.metricKey !== "first_open" || observation.quality !== "exact" || observation.value === null) continue;
    const row = rows.get(observation.date);
    if (row) row[observation.platform] = observation.value;
  }
  return [...rows.values()].map((row) => ({
    ...row,
    total: row.android === null && row.ios === null ? null : (row.android ?? 0) + (row.ios ?? 0),
  }));
}

export function latestDownloadDate(data: DashboardData, platform: Platform): string | null {
  return data.metrics.reduce<string | null>((latest, metric) => {
    if (metric.appId !== data.app.id || metric.platform !== platform || downloadValue(data, metric) === null) return latest;
    return latest === null || metric.date > latest ? metric.date : latest;
  }, null);
}

export function downloadDataStatusForRange(
  data: DashboardData,
  platform: Platform,
  range: MetricDateRange,
): DownloadDataStatus {
  const observedDates = data.metrics.flatMap((metric) => {
    if (
      metric.platform !== platform ||
      metric.date < range.startDate ||
      metric.date > range.endDate ||
      downloadValue(data, metric) === null
    ) {
      return [];
    }
    return [metric.date];
  });

  if (!observedDates.length) return "missing";
  return observedDates.sort().at(-1)! < range.endDate
    ? "delayed"
    : "available";
}

export function buildDownloadPeriodChange(
  data: DashboardData,
  period: Period,
): number | null {
  const endDate = latestDate(data);
  const currentStart = periodStart(period, endDate);
  const previousEnd = shiftDate(currentStart, -1);
  const previousStart = periodStart(period, previousEnd);
  const current = sumDownloads(
    data,
    data.metrics.filter(
      (metric) => metric.date >= currentStart && metric.date <= endDate,
    ),
  );
  const previous = sumDownloads(
    data,
    data.metrics.filter(
      (metric) => metric.date >= previousStart && metric.date <= previousEnd,
    ),
  );
  return percentChange(current, previous);
}

export function buildInstallLifecycle(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  return buildInstallLifecycleForRange(data, periodDateRange(period, endDate));
}

export function buildInstallLifecycleForRange(
  data: DashboardData,
  range: MetricDateRange,
) {
  const rows = data.metrics.filter(
    (metric) => metric.date >= range.startDate && metric.date <= range.endDate,
  );
  const hasMeasure = (metric: DailyMetric) =>
    metric.installs != null || metric.uninstalls != null;
  const coverage = {
    android: rows.some(
      (metric) => metric.platform === "android" && hasMeasure(metric),
    ),
    ios: rows.some((metric) => metric.platform === "ios" && hasMeasure(metric)),
  };
  const byDate = new Map<
    string,
    {
      installs: number;
      uninstalls: number;
      hasInstalls: boolean;
      hasUninstalls: boolean;
    }
  >();
  for (const metric of rows) {
    if (!hasMeasure(metric)) continue;
    const point = byDate.get(metric.date) ?? {
      installs: 0,
      uninstalls: 0,
      hasInstalls: false,
      hasUninstalls: false,
    };
    if (metric.installs != null) {
      point.installs += metric.installs;
      point.hasInstalls = true;
    }
    if (metric.uninstalls != null) {
      point.uninstalls += metric.uninstalls;
      point.hasUninstalls = true;
    }
    byDate.set(metric.date, point);
  }
  const trend = [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, point]) => ({
      date,
      installs: point.hasInstalls ? point.installs : null,
      uninstalls: point.hasUninstalls ? point.uninstalls : null,
      net:
        point.hasInstalls && point.hasUninstalls
          ? point.installs - point.uninstalls
          : null,
    }));
  const sum = (key: "installs" | "uninstalls") => {
    const values = trend.flatMap((point) =>
      point[key] == null ? [] : [point[key]],
    );
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const installs = sum("installs");
  const uninstalls = sum("uninstalls");
  return {
    totals: {
      installs,
      uninstalls,
      net:
        installs === null || uninstalls === null ? null : installs - uninstalls,
    },
    coverage,
    trend,
  };
}

export function buildPeriodSummary(data: DashboardData, period: Period) {
  const endDate = latestDate(data);
  return buildDateRangeSummary(data, periodDateRange(period, endDate));
}

export function buildDateRangeSummary(
  data: DashboardData,
  range: MetricDateRange,
) {
  const previous = previousDateRange(range);
  const currentStart = range.startDate;
  const endDate = range.endDate;
  const previousStart = previous.startDate;
  const previousEnd = previous.endDate;
  const currentMetrics = data.metrics.filter(
    (metric) => metric.date >= currentStart && metric.date <= endDate,
  );
  const previousMetrics = data.metrics.filter(
    (metric) => metric.date >= previousStart && metric.date <= previousEnd,
  );
  const currentReviews = data.reviews.filter((review) => {
    const reviewedAt = review.reviewedAt.slice(0, 10);
    return reviewedAt >= currentStart && reviewedAt <= endDate;
  });
  const previousReviews = data.reviews.filter((review) => {
    const reviewedAt = review.reviewedAt.slice(0, 10);
    return reviewedAt >= previousStart && reviewedAt <= previousEnd;
  });
  const platformDownloads = (rows: DailyMetric[], platform: Platform) =>
    sumDownloads(
      data,
      rows.filter((metric) => metric.platform === platform),
    );
  const androidDownloads = platformDownloads(currentMetrics, "android");
  const previousAndroidDownloads = platformDownloads(
    previousMetrics,
    "android",
  );
  const iosDownloads = platformDownloads(currentMetrics, "ios");
  const previousIosDownloads = platformDownloads(previousMetrics, "ios");
  const downloads = combineConnectedDownloads(
    data,
    androidDownloads,
    iosDownloads,
  );
  const previousDownloads = combineConnectedDownloads(
    data,
    previousAndroidDownloads,
    previousIosDownloads,
  );
  const androidRating = latestRatingBetween(
    data,
    "android",
    currentStart,
    endDate,
  );
  const iosRating = latestRatingBetween(data, "ios", currentStart, endDate);
  const previousAndroidRating = latestRatingBetween(
    data,
    "android",
    previousStart,
    previousEnd,
  );
  const previousIosRating = latestRatingBetween(
    data,
    "ios",
    previousStart,
    previousEnd,
  );
  const negativeReviewRate = calculateNegativeReviewRate(
    currentReviews.map((review) => review.rating),
  );
  const previousNegativeReviewRate = calculateNegativeReviewRate(
    previousReviews.map((review) => review.rating),
  );

  return {
    downloads,
    downloadChangePercent:
      percentChange(downloads, previousDownloads) === null
        ? null
        : Number(percentChange(downloads, previousDownloads)?.toFixed(1)),
    androidDownloads,
    androidDownloadChangePercent:
      percentChange(androidDownloads, previousAndroidDownloads) === null
        ? null
        : Number(
            percentChange(androidDownloads, previousAndroidDownloads)!.toFixed(
              1,
            ),
          ),
    iosDownloads,
    iosDownloadChangePercent:
      percentChange(iosDownloads, previousIosDownloads) === null
        ? null
        : Number(percentChange(iosDownloads, previousIosDownloads)!.toFixed(1)),
    androidRating,
    androidRatingChange: ratingChangeForPeriod(
      ratingPoints(data).filter(
        (item) => item.date >= currentStart && item.date <= endDate,
      ),
      "android",
      androidRating,
      previousAndroidRating,
    ),
    iosRating,
    iosRatingChange: ratingChangeForPeriod(
      ratingPoints(data).filter(
        (item) => item.date >= currentStart && item.date <= endDate,
      ),
      "ios",
      iosRating,
      previousIosRating,
    ),
    negativeReviewRate:
      negativeReviewRate === null
        ? null
        : Number(negativeReviewRate.toFixed(1)),
    negativeReviewRateChangePoints:
      negativeReviewRate === null || previousNegativeReviewRate === null
        ? null
        : Number((negativeReviewRate - previousNegativeReviewRate).toFixed(1)),
    reviewCount: currentReviews.length,
    reviewCountChange: currentReviews.length - previousReviews.length,
  };
}
