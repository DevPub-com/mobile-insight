import type { AppReview } from "@/domain/types";

export function calculateNegativeReviewRate(ratings: number[]): number | null {
  if (ratings.length === 0) return null;

  const negativeCount = ratings.filter((rating) => rating <= 2).length;
  return (negativeCount / ratings.length) * 100;
}

export function reviewAuthorLabel(author: string | null): string {
  return author?.trim() || "이름 미제공";
}

export function reviewDeviceLabel(
  review: Pick<AppReview, "device" | "deviceMetadata">,
): string | null {
  return review.deviceMetadata?.productName?.trim() || review.device?.trim() || null;
}

export function latestNegativeReviews(
  reviews: AppReview[],
  limit = 5,
): AppReview[] {
  return [...reviews]
    .filter((review) => review.rating <= 2)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, limit);
}

export function reviewTimeLabel(reviewedAt: string, now = new Date()): string {
  const reviewedTime = new Date(reviewedAt).getTime();
  const elapsed = now.getTime() - reviewedTime;
  const absoluteDate = reviewedAt.slice(0, 10).replaceAll("-", ".");

  if (!Number.isFinite(reviewedTime) || elapsed < 0) return absoluteDate;

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 24) return `${hours}시간 전`;

  return absoluteDate;
}
