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

describe("buildReleaseImpactWorkspace", () => {
  it("uses one shared seven-day window for cross-platform release metrics", () => {
    const view = buildReleaseImpactWorkspace(data, release);

    expect(view.windows).toEqual({
      before: { from: "2026-01-01", to: "2026-01-07" },
      after: { from: "2026-01-09", to: "2026-01-15" },
    });
    expect(view.downloads).toMatchObject({
      before: 210,
      after: 420,
      change: 210,
      changePercent: 100,
    });
    expect(view.ratings.android).toMatchObject({
      before: 4,
      after: 4.4,
      change: 0.4,
    });
    expect(view.ratings.ios).toMatchObject({
      before: 4.2,
      after: 4.5,
      change: 0.3,
    });
    expect(view.negativeReviews).toMatchObject({
      before: 50,
      after: 25,
      change: -25,
    });
    expect(view.newReviews).toMatchObject({
      before: 2,
      after: 4,
      change: 2,
      changePercent: 100,
    });
    expect(view.voc.find((item) => item.label === "로그인")).toMatchObject({
      before: 1,
      after: 3,
      changePercent: 200,
    });
    expect(view.stability.crashRate).toEqual({
      before: 0.3,
      after: 0.27,
      changePoints: -0.03,
      beforeAsOfDate: day(-1),
      afterAsOfDate: day(2),
      coverage: { before: 2, after: 2, expected: 7 },
    });
    expect(view.stability.anrRate).toEqual({
      before: 0.08,
      after: 0.1,
      changePoints: 0.02,
      beforeAsOfDate: day(-1),
      afterAsOfDate: day(2),
      coverage: { before: 1, after: 2, expected: 7 },
    });
    expect(view.daily).toHaveLength(15);
  });

  it("does not present a partial after window as a conclusive download rate", () => {
    const partialData = {
      ...data,
      metrics: metrics.filter((item) => item.date <= day(2)),
    };

    const view = buildReleaseImpactWorkspace(partialData, release);

    expect(view.coverage).toEqual({
      beforeDays: 7,
      afterDays: 2,
      expectedDays: 7,
    });
    expect(view.downloads.changePercent).toBeNull();
    expect(view.insights[0]).toMatchObject({
      tone: "warn",
      title: "다운로드 비교 기간 미완료",
    });
  });
});
