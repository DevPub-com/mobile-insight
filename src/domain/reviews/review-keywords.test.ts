import { describe, expect, it } from "vitest";
import type { AppReview } from "@/domain/types";
import { reviewKeywords, summarizeReviewKeywords } from "./review-keywords";

const review = (id: string, topics: string[], extra: Partial<AppReview> = {}) => ({
  id, aiTopics: topics, rating: 2, content: "로그인 오류", reviewedAt: "2026-09-01", ...extra,
}) as AppReview;

describe("review keywords", () => {
  it("classifies individual topics before falling back to overall sentiment", () => {
    expect(reviewKeywords(review("1", ["로그인_오류", "기능_추가", "사용성_만족", "UI"], { aiSentiment: "positive" })).map((item) => item.grade))
      .toEqual(["negative", "neutral", "positive", "positive"]);
  });
  it("counts each review once per keyword and separates opposing sentiments", () => {
    const first = review("1", ["로그인", "로그인"]);
    const groups = summarizeReviewKeywords([first, first, review("2", ["로그인"], { reviewedAt: "2026-09-02" }), review("3", ["로그인"], { rating: 5 })]);
    expect(groups.map(({ grade, count }) => ({ grade, count }))).toEqual([{ grade: "negative", count: 2 }, { grade: "positive", count: 1 }]);
    expect(groups[0].review.id).toBe("2");
    expect(summarizeReviewKeywords([])).toEqual([]);
  });
  it("uses content keywords when analysis is absent", () => {
    expect(reviewKeywords(review("1", []))).toContainEqual({ label: "로그인", grade: "negative" });
  });
});
