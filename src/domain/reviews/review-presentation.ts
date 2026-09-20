import type { AppReview } from "@/domain/types";
import { summarizeReviewRatings } from "./review.service";

export function buildReviewRatingSummary(reviews: AppReview[]) {
  const summary = summarizeReviewRatings(reviews.map(review => review.rating));
  const daily = new Map<string, { sum: number; count: number }>();
  for (const review of reviews) {
    const day = review.reviewedAt.slice(0, 10);
    const point = daily.get(day) ?? { sum: 0, count: 0 };
    point.sum += review.rating;
    point.count++;
    daily.set(day, point);
  }
  return { summary, daily: [...daily].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })) };
}
