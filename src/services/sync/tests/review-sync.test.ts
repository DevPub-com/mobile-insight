import { describe, expect, it } from "vitest";

import type { AppReview } from "@/domain/types";
import { toReviewInsertValue } from "@/services/sync/review-sync";

const review: AppReview = {
  id: "review-1",
  appId: "11111111-1111-4111-8111-111111111111",
  platform: "android",
  externalId: "review-1",
  rating: 5,
  title: null,
  content: "좋아요",
  author: "사용자",
  version: "2.27.00",
  territory: "KR",
  device: "star2qltechn",
  deviceMetadata: {
    productName: "Galaxy S24 Ultra",
    manufacturer: "Samsung",
    deviceClass: "phone",
  },
  androidOsVersion: 35,
  appVersionCode: 22700,
  reviewerLanguage: "ko",
  thumbsUpCount: 3,
  thumbsDownCount: 0,
  reviewedAt: "2026-09-08T00:00:00.000Z",
};

describe("review sync mapping", () => {
  it("omits removed review storage columns", () => {
    const value = toReviewInsertValue({ ...review, territory: "KOR", source: "app_store_reviews", quality: "exact", observedAt: "2026-09-12T00:00:00Z", description: "metadata" });
    for (const field of ["territory", "source", "quality", "observedAt", "description", "appVersionCode", "reviewerLanguage"]) {
      expect(value).not.toHaveProperty(field);
    }
  });
  it("preserves device and review metadata for database storage", () => {
    expect(toReviewInsertValue(review)).toEqual(
      expect.objectContaining({
        device: "star2qltechn",
        deviceMetadata: expect.objectContaining({
          productName: "Galaxy S24 Ultra",
          manufacturer: "Samsung",
        }),
        androidOsVersion: 35,
        thumbsUpCount: 3,
        thumbsDownCount: 0,
      }),
    );
  });

  it("adds optional AI analysis without changing source metadata", () => {
    expect(
      toReviewInsertValue(review, {
        sentiment: "positive",
        topics: ["성능"],
        topicPaths: [
          { major: "품질", middle: "성능", minor: "속도" },
        ],
        taxonomyVersion: 1,
        summary: "빠르다는 평가",
      }),
    ).toEqual(
      expect.objectContaining({
        device: "star2qltechn",
        aiSentiment: "positive",
        aiTopics: ["성능"],
        aiTopicPaths: [
          { major: "품질", middle: "성능", minor: "속도" },
        ],
      }),
    );
  });

  it("does not persist fallback paths without a taxonomy version", () => {
    expect(toReviewInsertValue(review, {
      sentiment: "positive",
      topics: ["기타"],
      topicPaths: [{ major: "기타", middle: null, minor: null }],
      taxonomyVersion: null,
      summary: "좋아요",
    })).toEqual(expect.objectContaining({
      aiTopicPaths: null,
    }));
  });
});


it("persists the Apple version supplied by its version review endpoint", () => {
  expect(toReviewInsertValue({ ...review, platform: "ios", version: "3.2.1" }))
    .toMatchObject({ platform: "ios", externalId: review.externalId, version: "3.2.1" });
});
