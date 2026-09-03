import { describe, expect, it } from "vitest";

import type { AppReview } from "@/domain/types";

import {
  calculateNegativeReviewRate,
  latestNegativeReviews,
  reviewAuthorLabel,
  reviewTimeLabel,
} from "./review.service";

const review = (
  id: string,
  rating: number,
  reviewedAt: string,
): AppReview => ({
  id,
  appId: "app",
  platform: "android",
  externalId: id,
  rating,
  title: null,
  content: id,
  author: `${id} 작성자`,
  version: "1.0.0",
  reviewedAt,
});

describe("calculateNegativeReviewRate", () => {
  it("returns the percentage of one and two star reviews", () => {
    expect(calculateNegativeReviewRate([1, 2, 5, 4, 1])).toBe(60);
  });

  it("returns null when there are no reviews", () => {
    expect(calculateNegativeReviewRate([])).toBeNull();
  });

  it("uses a clear fallback when an exported review has no author", () => {
    expect(reviewAuthorLabel(null)).toBe("이름 미제공");
    expect(reviewAuthorLabel("사용자")).toBe("사용자");
  });

  it("selects only the five latest one and two star reviews without mutating input", () => {
    const reviews = [
      review("oldest", 1, "2026-08-01T00:00:00Z"),
      review("positive", 5, "2026-08-31T00:00:00Z"),
      review("fourth", 2, "2026-08-27T00:00:00Z"),
      review("latest", 1, "2026-08-30T00:00:00Z"),
      review("third", 1, "2026-08-28T00:00:00Z"),
      review("second", 2, "2026-08-29T00:00:00Z"),
      review("fifth", 1, "2026-08-26T00:00:00Z"),
    ];

    expect(latestNegativeReviews(reviews).map((item) => item.id)).toEqual([
      "latest",
      "second",
      "third",
      "fourth",
      "fifth",
    ]);
    expect(reviews[0]?.id).toBe("oldest");
  });

  it("uses relative time through two days and an absolute date afterward", () => {
    const now = new Date("2026-08-31T12:00:00Z");

    expect(reviewTimeLabel("2026-08-31T11:59:40Z", now)).toBe("방금 전");
    expect(reviewTimeLabel("2026-08-31T11:42:00Z", now)).toBe("18분 전");
    expect(reviewTimeLabel("2026-08-31T10:30:00Z", now)).toBe("1시간 전");
    expect(reviewTimeLabel("2026-08-30T11:00:00Z", now)).toBe("1일 전");
    expect(reviewTimeLabel("2026-08-29T11:00:00Z", now)).toBe("2일 전");
    expect(reviewTimeLabel("2026-08-28T11:00:00Z", now)).toBe("2026.08.28");
  });
});
