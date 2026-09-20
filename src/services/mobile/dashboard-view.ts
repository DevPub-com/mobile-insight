import type { DashboardData, Platform } from "@/domain/types";
import { summarizeReviewKeywords } from "@/domain/reviews/review-keywords";
import { buildReviewRatingSummary } from "@/domain/reviews/review-presentation";
import { buildDashboardSummaryForRange } from "./dashboard-summary.service";
import { buildDateRangeSummary } from "./tabs/downloads.service";
import { buildRatingDistribution } from "./tabs/reviews.service";
import { availableMetricDateRange, latestDate, periodStart, type MetricDateRange } from "./common/metrics-calculator";

export function defaultDashboardRange(data: DashboardData): MetricDateRange {
  const available = availableMetricDateRange(data);
  const endDate = available?.endDate ?? latestDate(data);
  const startDate = periodStart("30d", endDate);
  return { startDate: available && available.startDate > startDate ? available.startDate : startDate, endDate };
}

// Identical calculators serve the initial render and subsequent date-range requests.
export function buildDashboardView(data: DashboardData, range: MetricDateRange) {
  const periodReviews = data.reviews.filter(item => item.reviewedAt.slice(0, 10) >= range.startDate && item.reviewedAt.slice(0, 10) <= range.endDate);
  const platformReviewSummaries = (["android", "ios"] as Platform[]).map(platform => {
    const reviews = periodReviews.filter(review => review.platform === platform);
    const { summary, daily } = buildReviewRatingSummary(reviews);
    return { platform, count: summary.total, average: summary.average,
      counts: daily.map(day => day.count), ratings: daily.map(day => day.sum / day.count) };
  });
  const keywords = summarizeReviewKeywords(periodReviews);
  // Charts need counts only; only the three visible examples need review bodies.
  const vocKeywords = keywords.map(({ label, key, grade, count }) => ({ label, key, grade, count }));
  return { range,
    dashboardSummary: buildDashboardSummaryForRange(data, range),
    periodSummary: buildDateRangeSummary(data, range),
    platformReviewSummaries,
    reviewRatingSummary: buildReviewRatingSummary(periodReviews),
    ratingDistribution: buildRatingDistribution(periodReviews),
    vocKeywords,
    notableReviews: keywords.filter(item => item.count >= 2).slice(0, 3),
  };
}
export type DashboardView = ReturnType<typeof buildDashboardView>;
