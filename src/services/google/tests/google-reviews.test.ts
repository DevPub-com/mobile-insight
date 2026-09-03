import { describe, expect, it } from "vitest";

import {
  googleReviewIdFromLink,
  mergeGoogleReviewMetadata,
  parseGoogleReviewRows,
  selectReportNames,
  selectNewestReportNames,
} from "../google-reviews";

const app = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "wtc",
  name: "WTC",
  androidPackageName: "com.example.wtc",
  iosAppId: null,
  iosBundleId: null,
};

describe("Google Play exported reviews", () => {
  it("maps an exported monthly review row", () => {
    const [review] = parseGoogleReviewRows(app, [
      {
        "Package Name": "com.example.wtc",
        "App Version Name": "2.4.0",
        "App Version Code": "240",
        "Reviewer Language": "ko",
        Device: "star2qltechn",
        "Review Submit Millis Since Epoch": "1788000000000",
        "Review Last Update Millis Since Epoch": "1788000060000",
        "Star Rating": "4",
        "Review Title": "좋아요",
        "Review Text": "빠르고 편합니다.",
        "Review Link": "https://play.google.com/console/reviews?reviewId=review-123",
      },
    ]);

    expect(review).toMatchObject({
      appId: app.id,
      platform: "android",
      externalId: "review-123",
      rating: 4,
      title: "좋아요",
      content: "빠르고 편합니다.",
      version: "2.4.0",
      device: "star2qltechn",
      appVersionCode: 240,
      reviewerLanguage: "ko",
      source: "google_play_gcs",
      quality: "exact",
      reviewedAt: new Date(1788000060000).toISOString(),
    });
  });

  it("rejects rows for another package or without usable review content", () => {
    expect(
      parseGoogleReviewRows(app, [
        {
          "Package Name": "com.other.app",
          "Review Last Update Millis Since Epoch": "1788000060000",
          "Star Rating": "5",
          "Review Text": "다른 앱",
        },
        {
          "Package Name": "com.example.wtc",
          "Review Last Update Millis Since Epoch": "1788000060000",
          "Star Rating": "5",
          "Review Text": "",
        },
      ]),
    ).toEqual([]);
  });

  it("selects only the newest monthly file for regular sync", () => {
    expect(
      selectNewestReportNames([
        "stats/installs/installs_com.example.wtc_202606_country.csv",
        "stats/installs/installs_com.example.wtc_202608_country.csv",
        "stats/installs/installs_com.example.wtc_202607_country.csv",
      ]),
    ).toEqual(["stats/installs/installs_com.example.wtc_202608_country.csv"]);
  });

  it("selects every overview month for backfill without mixing dimensions", () => {
    const names = [
      "stats/ratings/ratings_com.example.wtc_202606_country.csv",
      "stats/ratings/ratings_com.example.wtc_202606_overview.csv",
      "stats/ratings/ratings_com.example.wtc_202607_overview.csv",
    ];

    expect(selectReportNames(names, "_overview.csv", "all")).toEqual([
      "stats/ratings/ratings_com.example.wtc_202606_overview.csv",
      "stats/ratings/ratings_com.example.wtc_202607_overview.csv",
    ]);
    expect(selectReportNames(names, "_overview.csv", "newest")).toEqual([
      "stats/ratings/ratings_com.example.wtc_202607_overview.csv",
    ]);
  });

  it("extracts review IDs from current and legacy Play Console links", () => {
    expect(
      googleReviewIdFromLink("https://play.google.com/console/reviews?reviewId=review-123"),
    ).toBe("review-123");
    expect(
      googleReviewIdFromLink(
        "https://play.google.com/apps/publish/?dev_acc=1#ReviewPlace:id=legacy-456",
      ),
    ).toBe("legacy-456");
  });

  it("adds API author metadata without replacing exported review content", () => {
    const [exported] = parseGoogleReviewRows(app, [
      {
        "Package Name": "com.example.wtc",
        "Review Submit Millis Since Epoch": "1788000000000",
        "Star Rating": "4",
        "Review Text": "CSV 원문",
        "Review Link": "https://play.google.com/console/reviews?reviewId=review-123",
      },
    ]);

    expect(
      mergeGoogleReviewMetadata(exported, {
        ...exported,
        content: "API 번역문",
        author: "작성자",
        version: "2.5.0",
      }),
    ).toMatchObject({ content: "CSV 원문", author: "작성자", version: "2.5.0" });
  });

  it("keeps the fallback ID stable when an exported review is edited", () => {
    const base = {
      "Package Name": "com.example.wtc",
      "App Version Code": "10",
      "Reviewer Language": "ko",
      Device: "phone",
      "Review Submit Millis Since Epoch": "1788000000000",
      "Star Rating": "3",
    };
    const reviews = parseGoogleReviewRows(app, [
      { ...base, "Review Text": "첫 번째 내용" },
      { ...base, "Review Text": "두 번째 내용" },
    ]);

    expect(reviews).toHaveLength(2);
    expect(reviews[0].externalId).toBe(reviews[1].externalId);
  });
});
