import { describe, expect, it } from "vitest";

import { fetchAppleAppReviews, toAppleAppReviews, toAppleVersionReviews } from "../apple-reviews";

describe("Apple version review normalization", () => {
  it("attaches the enclosing App Store version to every review", () => {
    expect(
      toAppleVersionReviews("app-1", "1.2.3", [
        {
          id: "review-1",
          attributes: {
            rating: 5,
            title: "좋아요",
            body: "잘 사용하고 있습니다.",
            reviewerNickname: "사용자",
            createdDate: "2026-08-20T10:00:00Z",
          },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        externalId: "review-1",
        version: "1.2.3",
        author: "사용자",
      }),
    ]);
  });
});

describe("fetchAppleAppReviews", () => {
  it("follows every app-level customer review page", async () => {
    const paths: string[] = [];
    const reviews = await fetchAppleAppReviews("app-1", "12345", async (path) => {
      paths.push(path);
      return path === "/page-2"
        ? { data: [{ id: "review-2", attributes: { rating: 4, body: "좋아요", territory: "USA", createdDate: "2026-08-21T00:00:00Z" } }] }
        : { data: [{ id: "review-1", attributes: { rating: 5, body: "좋아요", territory: "KOR", createdDate: "2026-08-20T00:00:00Z" } }], links: { next: "/page-2" } };
    }, "2026-08-31T00:00:00.000Z");

    expect(paths[0]).toContain("/v1/apps/12345/customerReviews");
    expect(paths).toEqual([expect.stringContaining("/v1/apps/12345/customerReviews"), "/page-2"]);
    expect(reviews.map((review) => review.externalId)).toEqual(["review-1", "review-2"]);
  });
});

describe("Apple app review normalization", () => {
  it("preserves territory and records review provenance", () => {
    const [review] = toAppleAppReviews("app-1", [
      {
        id: "review-2",
        attributes: {
          rating: 2,
          body: "느립니다.",
          territory: "KOR",
          createdDate: "2026-08-21T10:00:00Z",
        },
      },
    ], "2026-08-31T00:00:00.000Z");

    expect(review).toMatchObject({
      externalId: "review-2",
      version: null,
      territory: "KOR",
      source: "app_store_reviews",
      quality: "exact",
      observedAt: "2026-08-31T00:00:00.000Z",
    });
  });
});
