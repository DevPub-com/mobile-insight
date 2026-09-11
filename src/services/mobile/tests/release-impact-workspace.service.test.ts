import { describe, expect, it } from "vitest";

import type {
  AppInfo,
  AppRelease,
  AppReview,
  DashboardData,
  DailyMetric,
  Platform,
} from "@/domain/types";
import { buildReleaseImpactWorkspace } from "../tabs/release-impact.service";

const app: AppInfo = {
  id: "app",
  code: "app",
  name: "테스트 앱",
  androidPackageName: "com.test",
  iosAppId: "1",
  iosBundleId: "com.test",
};

const release: AppRelease = {
  id: "release",
  appId: app.id,
  platform: "android",
  version: "2.0.0",
  releasedAt: "2026-01-08T00:00:00.000Z",
};

const day = (offset: number) => {
  const value = new Date("2026-01-08T00:00:00.000Z");
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

const metrics: DailyMetric[] = Array.from({ length: 15 }, (_, index) => {
  const offset = index - 7;
  return (["android", "ios"] as Platform[]).map((platform) => ({
    appId: app.id,
    platform,
    date: day(offset),
    downloads:
      offset < 0
        ? platform === "android"
          ? 20
          : 10
        : offset > 0
          ? platform === "android"
            ? 40
            : 20
          : 35,
    rating:
      offset < 0
        ? platform === "android"
          ? 4
          : 4.2
        : platform === "android"
          ? 4.4
          : 4.5,
    ratingCount: 10,
    reviewCount: 1,
    active1DayUsers: null,
    active7DayUsers: null,
    active28DayUsers: null,
    sessions: null,
  }));
}).flat();

const reviews: AppReview[] = [
  [-3, 1, "로그인이 느려요"],
  [-2, 5, "UI가 좋아요"],
  [1, 1, "로그인 오류가 있어요"],
  [2, 5, "로그인 속도가 빨라졌어요"],
  [3, 5, "로그인이 편해졌어요"],
  [4, 4, "UI 메뉴가 쉬워요"],
].map(([offset, rating, content], index) => ({
  id: `review-${index}`,
  appId: app.id,
  platform: index % 2 ? "ios" : "android",
  externalId: `external-${index}`,
  rating: Number(rating),
  title: null,
  content: String(content),
  author: null,
  version: "2.0.0",
  reviewedAt: `${day(Number(offset))}T12:00:00.000Z`,
}));

const data: DashboardData = {
  apps: [app],
  app,
  metrics,
  reviews,
  releases: [release],
  metricObservations: [
    {
      appId: app.id,
      platform: "android",
      date: day(-2),
      metricKey: "user_perceived_crash_rate_28d",
      value: 0.31,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(-1),
      metricKey: "user_perceived_crash_rate_28d",
      value: 0.3,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(1),
      metricKey: "user_perceived_crash_rate_28d",
      value: 0.28,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(2),
      metricKey: "user_perceived_crash_rate_28d",
      value: 0.27,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(-1),
      metricKey: "user_perceived_anr_rate_28d",
      value: 0.08,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(1),
      metricKey: "user_perceived_anr_rate_28d",
      value: 0.09,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
    {
      appId: app.id,
      platform: "android",
      date: day(2),
      metricKey: "user_perceived_anr_rate_28d",
      value: 0.1,
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-01-16T00:00:00.000Z",
    },
  ],
  syncRuns: [],
  source: "demo",
};

const previous = { ...release, id: "previous", version: "1.0.0", releasedAt: `${day(-7)}T00:00:00Z` };
const next = { ...release, id: "next", version: "3.0.0", releasedAt: `${day(8)}T00:00:00Z` };
const actual = { ...data, releases: [release, previous, next], source: "database" as const };

describe("buildReleaseImpactWorkspace", () => {
  it("compares adjacent release periods and isolates the selected OS", () => {
    const view = buildReleaseImpactWorkspace(actual, release, day(10));
    expect(view.windows).toEqual({
      before: { from: day(-7), to: day(-1) },
      after: { from: day(0), to: day(7) },
    });
    expect(view.downloads).toMatchObject({ before: 140, after: 315, change: 175, changePercent: 125 });
    expect(view.ratings.ios.before).toBeNull();
    expect(view.newReviews).toMatchObject({ before: 1, after: 2 });
    expect(view.stability.crashRate).toMatchObject({ before: 0.3, after: 0.27, changePoints: -0.03 });
    expect(view.daily).toHaveLength(15);
    expect(view.platforms).toEqual(["android"]);
  });

  it("includes today for the latest version even when collection lags", () => {
    const view = buildReleaseImpactWorkspace({ ...actual, releases: [previous, release] }, release, day(10));
    expect(view.windows.after).toEqual({ from: day(0), to: day(10) });
    expect(view.coverage.expectedDays).toBe(11);
    expect(view.downloads.changePercent).toBeNull();
    expect(view.daily.at(-1)?.downloads).toBeNull();
  });

  it("does not invent a comparison period without a previous release", () => {
    const view = buildReleaseImpactWorkspace(data, release, day(2));
    expect(view.coverage.expectedBeforeDays).toBe(0);
    expect(view.downloads.before).toBeNull();
    expect(view.newReviews.before).toBeNull();
  });

  it("does not report truncated reviews as complete counts", () => {
    const view = buildReleaseImpactWorkspace({ ...actual, reviewDataTruncated: true }, release, day(10));
    expect(view.newReviews.after).toBeNull();
    expect(view.negativeReviews.after).toBeNull();
  });

  it("ignores another OS release when choosing period boundaries", () => {
    const other = { ...next, id: "ios", platform: "ios" as const, releasedAt: `${day(2)}T00:00:00Z` };
    const view = buildReleaseImpactWorkspace({ ...actual, releases: [...actual.releases, other] }, release, day(10));
    expect(view.windows.after.to).toBe(day(7));
  });
});
