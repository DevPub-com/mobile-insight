import { expect, it } from "vitest";
import type { AppReview } from "@/domain/types";
import { reviewTopicChips, summarizeReviewKeywords } from "./review-keywords";
const review = (id: string, minor: string | null) => ({ id, rating: 2, content: "리뷰", reviewedAt: "2026-09-12", aiTopicPaths: [{ major: "기타", middle: "일반", minor }] }) as AppReview;
it("renders independent hierarchy chips and counts only minor topics", () => {
  expect(reviewTopicChips(review("1", "위젯")).map(item => item.label)).toEqual(["기타", "일반", "위젯"]);
  const groups = summarizeReviewKeywords([review("1", "위젯"), review("2", "위젯"), review("3", null), review("1", "위젯")]);
  expect(groups).toHaveLength(1);
  expect(groups[0]).toMatchObject({ label: "위젯", count: 2 });
});

it.each([
  ["감사합니다", 5, "감사"],
  ["좋아요", 5, "좋아요"],
  ["최곱니다 고객만족", 5, "최고"],
  ["괜찮아요", 5, "괜찮음"],
  ["정말 별로네", 1, "아쉬움"],
  ["진짜 사용하기 뭐같네요", 1, "불만"],
] as const)("refines a legacy general opinion: %s", (content, rating, expected) => {
  const item = { ...review(content, "일반 의견"), content, rating };
  expect(reviewTopicChips(item).map(({ label }) => label)).toEqual(["기타", "사용자 반응", expected]);
});
