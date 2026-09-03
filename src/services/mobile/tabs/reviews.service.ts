import type { AppReview, Platform } from "@/domain/types";
import {
  periodStart,
  type ReviewPeriod,
  type ReviewRatingGroup,
} from "../common/metrics-calculator";
import { countVocKeywords } from "../common/voc-keywords";

export function reviewMatchesPeriod(
  reviewedAt: string,
  period: ReviewPeriod,
  endDate: string,
): boolean {
  return (
    period === "all" || reviewedAt.slice(0, 10) >= periodStart(period, endDate)
  );
}

export function reviewMatchesRatingGroup(
  rating: number,
  group: ReviewRatingGroup,
): boolean {
  if (group === "all") return true;
  if (group === "negative") return rating <= 2;
  if (group === "neutral") return rating === 3;
  return rating >= 4;
}

export function buildRatingDistribution(reviews: AppReview[]) {
  return (["android", "ios"] as Platform[]).map((platform) => {
    const platformReviews = reviews.filter(
      (review) => review.platform === platform,
    );
    return {
      platform,
      total: platformReviews.length,
      rows: [5, 4, 3, 2, 1].map((score) => {
        const count = platformReviews.filter(
          (review) => review.rating === score,
        ).length;
        return {
          score,
          count,
          percent: platformReviews.length
            ? Number(((count / platformReviews.length) * 100).toFixed(1))
            : 0,
        };
      }),
    };
  });
}

export const buildVocKeywords = countVocKeywords;
