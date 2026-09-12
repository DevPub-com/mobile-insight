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
