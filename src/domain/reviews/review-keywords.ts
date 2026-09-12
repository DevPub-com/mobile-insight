import { normalizeReviewKeyword } from "./keyword-normalization";
import type { AppReview, ReviewSentiment } from "@/domain/types";

export const keywordGradeLabel: Record<ReviewSentiment, string> = {
  negative: "불만", neutral: "개선", positive: "만족",
};

export type KeywordFilter = "all" | ReviewSentiment;
export type KeywordSelection = { label: string; grade: KeywordFilter; key?: string; level?: "major" | "middle" | "minor" };

export function matchesKeyword(review: AppReview, selection: KeywordSelection | null) {
  return !selection || (selection.level ? reviewTopicChips(review) : reviewKeywords(review)).some(({ label, grade, key }) =>
    (selection.key ? key === selection.key : label === normalizeReviewKeyword(selection.label)) && (selection.grade === "all" || grade === selection.grade));
}

export function keywordChartRows(groups: ReturnType<typeof summarizeReviewKeywords>, filter: KeywordFilter) {
  const rows = new Map<string, { label: string; key: string; total: number; positive: number; neutral: number; negative: number }>();
  for (const group of groups) {
    if (filter !== "all" && group.grade !== filter) continue;
    const row = rows.get(group.key) ?? { label: group.label, key: group.key, total: 0, positive: 0, neutral: 0, negative: 0 };
    row[group.grade] += group.count;
    row.total += group.count;
    rows.set(group.key, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "ko"));
}

export function reviewKeywords(review: AppReview) {
  return reviewTopicChips(review).filter(item => item.level === "minor");
}

export function reviewTopicChips(review: AppReview) {
  const grade: ReviewSentiment = review.aiSentiment ?? (review.rating <= 2 ? "negative" : review.rating >= 4 ? "positive" : "neutral");
  const paths = review.aiTopicPaths?.length ? review.aiTopicPaths : [{ major: "기타", middle: null, minor: null }];
  const chips = paths.flatMap(path => (["major", "middle", "minor"] as const).flatMap((level, index) => {
    const label = path[level];
    if (typeof label !== "string" || !label.trim()) return [];
    const key = JSON.stringify([path.major, path.middle, path.minor].slice(0, index + 1));
    return [{ label, key, level, grade }];
  }));
  return [...new Map(chips.map(chip => [chip.key, chip])).values()];
}

export function summarizeReviewKeywords(reviews: AppReview[]) {
  const groups = new Map<string, { label: string; key: string; grade: ReviewSentiment; count: number; review: AppReview }>();
  for (const review of new Map(reviews.map((review) => [review.id, review])).values()) {
    for (const { label, grade, key: pathKey } of reviewKeywords(review)) {
      const key = `${grade}:${pathKey}`;
      const group = groups.get(key);
      if (group) {
        group.count++;
        if (review.reviewedAt > group.review.reviewedAt) group.review = review;
      } else groups.set(key, { label, key: pathKey, grade, count: 1, review });
    }
  }
  const gradeOrder = { positive: 0, neutral: 1, negative: 2 };
  return [...groups.values()].sort((a, b) => gradeOrder[a.grade] - gradeOrder[b.grade] || b.count - a.count || a.label.localeCompare(b.label, "ko"));
}
