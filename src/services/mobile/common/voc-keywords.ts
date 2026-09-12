import type { AppReview } from "@/domain/types";
import {
  REVIEW_TOPIC_LABELS,
  type ReviewTopicLabel,
} from "@/domain/reviews/review-taxonomy";

export const VOC_GROUPS = REVIEW_TOPIC_LABELS.map((label) => ({ label }));

export function reviewHasMajorTopic(
  review: AppReview,
  label: ReviewTopicLabel,
): boolean {
  return review.aiTopicPaths?.some((path) => path.major === label) ?? false;
}

export function countVocKeywords(reviews: AppReview[]) {
  const negative = reviews.filter((review) => review.rating <= 2);
  return VOC_GROUPS.map(({ label }) => ({
    label,
    count: negative.filter((review) =>
      reviewHasMajorTopic(review, label),
    ).length,
  })).sort((a, b) => b.count - a.count);
}
