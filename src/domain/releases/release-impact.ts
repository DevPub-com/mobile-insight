import { calculateNegativeReviewRate } from "@/domain/reviews/review.service";

type MetricPoint = {
  date: string;
  downloads: number | null;
  rating: number | null;
};

type ReviewPoint = {
  reviewedAt: string;
  rating: number;
};

type Comparison = {
  before: number | null;
  after: number | null;
  changePercent: number | null;
};

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

function sum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : present.reduce((total, value) => total + value, 0);
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0
    ? null
    : present.reduce((total, value) => total + value, 0) / present.length;
}

function percentChange(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before === 0) return null;
  return ((after - before) / before) * 100;
}

export function calculateReleaseImpact({
  releasedAt,
  metrics,
  reviews,
  beforeDays,
  afterDays,
  includeReleaseDay = false,
}: {
  releasedAt: string;
  metrics: MetricPoint[];
  reviews: ReviewPoint[];
  beforeDays: number;
  afterDays: number;
  includeReleaseDay?: boolean;
}) {
  const beforeFrom = addDays(releasedAt, -beforeDays);
  const beforeTo = addDays(releasedAt, -1);
  const afterStartOffset = includeReleaseDay ? 0 : 1;
  const afterFrom = addDays(releasedAt, afterStartOffset);
  const afterTo = addDays(releasedAt, afterStartOffset + afterDays - 1);

  const beforeMetrics = metrics.filter((metric) => inRange(metric.date, beforeFrom, beforeTo));
  const afterMetrics = metrics.filter((metric) => inRange(metric.date, afterFrom, afterTo));
  const beforeReviews = reviews.filter((review) => inRange(review.reviewedAt, beforeFrom, beforeTo));
  const afterReviews = reviews.filter((review) => inRange(review.reviewedAt, afterFrom, afterTo));

  const beforeDownloads = sum(beforeMetrics.map((metric) => metric.downloads));
  const afterDownloads = sum(afterMetrics.map((metric) => metric.downloads));
  const beforeDownloadDays = beforeMetrics.filter((metric) => metric.downloads !== null).length;
  const afterDownloadDays = afterMetrics.filter((metric) => metric.downloads !== null).length;
  const beforeRating = average(beforeMetrics.map((metric) => metric.rating));
  const afterRating = average(afterMetrics.map((metric) => metric.rating));
  const beforeNegative = calculateNegativeReviewRate(beforeReviews.map((review) => review.rating));
  const afterNegative = calculateNegativeReviewRate(afterReviews.map((review) => review.rating));

  const downloads: Comparison = {
    before: beforeDownloads,
    after: afterDownloads,
    changePercent:
      beforeDownloadDays === beforeDays && afterDownloadDays === afterDays
        ? percentChange(beforeDownloads, afterDownloads)
        : null,
  };

  return {
    downloads,
    rating: { before: beforeRating, after: afterRating },
    negativeReviews: {
      before: beforeNegative,
      after: afterNegative,
      changePoints:
        beforeNegative === null || afterNegative === null
          ? null
          : afterNegative - beforeNegative,
    },
    newReviews: {
      before: beforeReviews.length,
      after: afterReviews.length,
      changePercent: percentChange(beforeReviews.length, afterReviews.length),
    },
    windows: {
      before: { from: beforeFrom, to: beforeTo },
      after: { from: afterFrom, to: afterTo },
    },
    coverage: {
      downloads: {
        before: beforeDownloadDays,
        after: afterDownloadDays,
        expectedBefore: beforeDays,
        expectedAfter: afterDays,
      },
    },
  };
}
