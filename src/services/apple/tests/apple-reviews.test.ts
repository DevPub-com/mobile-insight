import { describe, expect, it } from "vitest";

import { fetchAppleAppReviews, fetchAppleReviewsWithVersions, toAppleAppReviews, toAppleVersionReviews } from "../apple-reviews";

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


describe("Apple review version mapping", () => {
  const observedAt = "2026-09-11T00:00:00.000Z";
  const review = (id: string, body = "현재 리뷰") => ({ id, attributes: {
    rating: 4, body, territory: "KOR", createdDate: "2026-09-10T00:00:00Z",
  } });
  const versions = [
    { id: "v1", attributes: { platform: "IOS", versionString: "1.0.0" } },
    { id: "v2", attributes: { platform: "IOS", versionString: "2.0.0" } },
    { id: "mac", attributes: { platform: "MAC_OS", versionString: "9.0.0" } },
  ];

  it("maps explicit version relationships across pages and preserves review metadata", async () => {
    const paths: string[] = [];
    const result = await fetchAppleReviewsWithVersions("app-1", "123", versions, async (path) => {
      paths.push(path);
      if (path.includes("/apps/")) return { data: [review("r1"), review("r2"), review("unmapped")] };
      if (path.includes("/v1/customerReviews")) return { data: [review("r1", "이전 리뷰")], links: { next: "/reviews/page2" } };
      if (path === "/reviews/page2") return { data: [review("historical")] };
      if (path.includes("/v2/customerReviews")) return { data: [review("r2")] };
      throw new Error(`Unexpected path ${path}`);
    }, observedAt);
    expect(result.map(({ externalId, version }) => [externalId, version])).toEqual([
      ["r1", "1.0.0"], ["r2", "2.0.0"], ["unmapped", null], ["historical", "1.0.0"],
    ]);
    expect(result[0]).toMatchObject({ content: "현재 리뷰", territory: "KOR", source: "app_store_reviews", quality: "exact", observedAt });
    expect(result[3]).toMatchObject({ territory: "KOR", source: "app_store_reviews", observedAt });
    expect(paths).toContain("/reviews/page2");
    expect(paths.some((path) => path.includes("/mac/"))).toBe(false);
  });

  it("leaves ambiguous version relationships unassigned", async () => {
    const result = await fetchAppleReviewsWithVersions("app-1", "123", versions,
      async () => ({ data: [review("same")] }), observedAt);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBeNull();
  });

  it("reports version lookup failures instead of claiming successful mapping", async () => {
    await expect(fetchAppleReviewsWithVersions("app-1", "123", versions, async (path) => {
      if (path.includes("/apps/")) return { data: [review("r1")] };
      throw new Error("Apple API unavailable");
    }, observedAt)).rejects.toThrow("Apple API unavailable");
  });
});
