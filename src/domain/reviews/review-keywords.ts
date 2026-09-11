import type { AppReview, ReviewSentiment } from "@/domain/types";
import { VOC_GROUPS, contentMatchesTerms } from "@/services/mobile/common/voc-keywords";

export const keywordGradeLabel: Record<ReviewSentiment, string> = {
  negative: "불만", neutral: "개선", positive: "만족",
};

export function reviewKeywords(review: AppReview) {
  const topics = review.aiTopics?.length ? review.aiTopics : VOC_GROUPS
    .filter(({ terms }) => contentMatchesTerms(review.content, terms)).map(({ label }) => label);
  return [...new Set(topics.map((topic) => topic.trim()).filter(Boolean))].map((label) => {
    // Explicit topic language takes precedence over the review's overall sentiment.
    const grade: ReviewSentiment = /오류|불만|불가|실패|깨짐|튕김|부재|불편|버그/.test(label)
      ? "negative" : /요청|개선|추가|제안/.test(label) ? "neutral"
      : /만족|호평|편리|칭찬|추천/.test(label) ? "positive"
      : review.aiSentiment ?? (review.rating <= 2 ? "negative" : review.rating >= 4 ? "positive" : "neutral");
    return { label, grade };
  });
}

export function summarizeReviewKeywords(reviews: AppReview[]) {
  const groups = new Map<string, { label: string; grade: ReviewSentiment; count: number; review: AppReview }>();
  for (const review of new Map(reviews.map((review) => [review.id, review])).values()) {
    for (const { label, grade } of reviewKeywords(review)) {
      const key = `${grade}:${label}`;
      const group = groups.get(key);
      if (group) {
        group.count++;
        if (review.reviewedAt > group.review.reviewedAt) group.review = review;
      } else groups.set(key, { label, grade, count: 1, review });
    }
  }
  const gradeOrder = { positive: 0, neutral: 1, negative: 2 };
  return [...groups.values()].sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade] || b.count - a.count || a.label.localeCompare(b.label, "ko"));
}
