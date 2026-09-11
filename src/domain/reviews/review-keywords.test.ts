import { describe, expect, it } from "vitest";
import type { AppReview } from "@/domain/types";
import { reviewKeywords, summarizeReviewKeywords, keywordChartRows, matchesKeyword } from "./review-keywords";

const review = (id: string, topics: string[], extra: Partial<AppReview> = {}) => ({
  id, aiTopics: topics, rating: 2, content: "로그인 오류", reviewedAt: "2026-09-01", ...extra,
}) as AppReview;

describe("review keywords", () => {
  it("stacks identical keywords across sentiments and reranks the selected sentiment", () => {
    const groups = summarizeReviewKeywords([
      review("1", ["로그인", "로그인"], { rating: 5 }),
      review("2", ["로그인"]), review("3", ["속도"]),
      review("4", ["속도"]), review("5", ["로그인"], { rating: 3 }),
    ]);
    expect(keywordChartRows(groups, "all")[0]).toEqual({ label: "로그인", total: 3, positive: 1, neutral: 1, negative: 1 });
    expect(keywordChartRows(groups, "negative").map(({ label, total }) => [label, total])).toEqual([["속도", 2], ["로그인", 1]]);
    expect(keywordChartRows([], "all")).toEqual([]);
  });
  it("opens reviews matching the exact keyword and its topic sentiment, regardless of star rating", () => {
    const item = review("1", ["로그인_오류", "사용성_만족"], { rating: 5 });
    expect(matchesKeyword(item, { label: "로그인_오류", grade: "negative" })).toBe(true);
    expect(matchesKeyword(item, { label: "로그인_오류", grade: "positive" })).toBe(false);
    expect(matchesKeyword(item, { label: "로그인", grade: "all" })).toBe(false);
    expect(matchesKeyword(item, null)).toBe(true);
  });
  it("classifies individual topics before falling back to overall sentiment", () => {
    expect(reviewKeywords(review("1", ["로그인_오류", "기능_추가", "사용성_만족", "UI"], { aiSentiment: "positive" })).map((item) => item.grade))
      .toEqual(["negative", "neutral", "positive", "positive"]);
  });
  it("counts each review once per keyword and separates opposing sentiments", () => {
    const first = review("1", ["로그인", "로그인"]);
    const groups = summarizeReviewKeywords([first, first, review("2", ["로그인"], { reviewedAt: "2026-09-02" }), review("3", ["로그인"], { rating: 5 })]);
    expect(groups.map(({ grade, count }) => ({ grade, count }))).toEqual([{ grade: "positive", count: 1 }, { grade: "negative", count: 2 }]);
    expect(groups[1].review.id).toBe("2");
    expect(summarizeReviewKeywords([])).toEqual([]);
  });
  it("uses content keywords when analysis is absent", () => {
    expect(reviewKeywords(review("1", []))).toContainEqual({ label: "로그인", grade: "negative" });
  });
  it("orders satisfaction, improvements, and complaints before frequency", () => {
    const groups = summarizeReviewKeywords([
      review("1", ["로그인 오류"]),
      review("2", ["로그인 오류"]),
      review("3", ["기능 개선"]),
      review("4", ["사용성 만족"]),
    ]);
    expect(groups.map(({ grade }) => grade)).toEqual(["positive", "neutral", "negative"]);
  });
});


describe("keyword synonym grouping", () => {
  it("groups launch errors across reviews and counts each review once", () => {
    const items = [review("1", ["앱실행_오류", "앱 실행 불가", "어플 구동 실패"]),
      review("2", ["앱 실행시 튕김"]), review("3", ["로그인 실패"])];
    const groups = summarizeReviewKeywords(items);
    expect(groups.find((group) => group.label === "앱실행_오류")?.count).toBe(2);
    expect(groups.find((group) => group.label === "로그인_오류")?.count).toBe(1);
    expect(matchesKeyword(items[1], { label: "앱실행_오류", grade: "negative" })).toBe(true);
    expect(matchesKeyword(items[0], { label: "앱 실행 불가", grade: "all" })).toBe(true);
  });
  it("preserves distinct features and positive or improvement topics", () => {
    const labels = reviewKeywords(review("1", ["앱 실행 만족", "앱 실행 개선", "주문 오류", "지문인증 오류"])).map((item) => item.label);
    expect(labels).toEqual(["앱_실행_만족", "앱_실행_개선", "주문_오류", "지문인증_오류"]);
  });
  it("combines latency and notification synonyms", () => {
    expect(reviewKeywords(review("1", ["로딩 지연", "응답 느림", "푸시 미수신", "알림 안옴"])))
      .toEqual([{ label: "속도_지연", grade: "negative" }, { label: "알림_미수신", grade: "negative" }]);
  });
});
