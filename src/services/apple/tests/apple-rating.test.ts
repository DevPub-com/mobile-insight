import { describe, expect, it } from "vitest";

import { toAppleRatingMetric, toAppleRatingReport } from "../apple-reviews";

describe("Apple rating normalization", () => {
  it("maps a public App Store aggregate rating to a daily metric", () => {
    expect(
      toAppleRatingMetric(
        "app-1",
        "2026-08-28",
        { averageUserRating: 4.7, userRatingCount: 1200 },
      ),
    ).toMatchObject({ rating: 4.7, ratingCount: 1200, downloads: null });
  });

  it("rejects missing or invalid ratings", () => {
    expect(toAppleRatingMetric("app-1", "2026-08-28", { averageUserRating: 0 })).toBeNull();
  });
});

describe("toAppleRatingReport", () => {
  it("records a territory-scoped daily snapshot", () => {
    const result = toAppleRatingReport(
      "app-1",
      "2026-08-28",
      "KOR",
      { averageUserRating: 4.7, userRatingCount: 1200 },
      "2026-08-28T12:00:00.000Z",
    );
    expect(result?.snapshot).toMatchObject({
      territory: "KOR",
      averageRating: 4.7,
      ratingCount: 1200,
      source: "mobile_insight",
      quality: "derived",
    });
  });
});
