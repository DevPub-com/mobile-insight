import { describe, expect, it } from "vitest";

import type { DashboardData, Platform } from "@/domain/types";

import {
  buildActiveUserSummary,
  buildActiveUserTrend,
  buildDownloadPeriodChange,
  buildInstallLifecycle,
  buildOverview,
  buildPeriodSummary,
  buildRatingTrend,
  buildRatingDistribution,
  buildReleaseImpact,
  selectLatestMatureRelease,
  buildVocKeywords,
  periodStart,
  reviewMatchesRatingGroup,
  reviewMatchesPeriod,
  metricQualityForPeriod,
  reviewQualityForPeriod,
} from "../index";

describe("store lifecycle views", () => {
  it("keeps missing download totals unavailable instead of fabricating zero", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [],
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };
    expect(buildPeriodSummary(data, "28d").downloads).toBeNull();
    expect(buildOverview(data).downloads30d).toBeNull();
  });

  it("combines available platform downloads into the total", () => {
    const connectedApp = {
      ...app,
      androidPackageName: "com.example.app",
      iosAppId: "12345",
    };
    const data: DashboardData = {
      apps: [connectedApp],
      app: connectedApp,
      metrics: [platformMetrics("android", "2026-08-30", 10)[13]],
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };
    expect(buildPeriodSummary(data, "28d").downloads).toBe(10);
  });

  it("returns the evidence-backed partial sum without filling missing dates with zero", () => {
    const connectedApp = {
      ...app,
      androidPackageName: "com.example.app",
      iosAppId: "12345",
    };
    const data: DashboardData = {
      apps: [connectedApp],
      app: connectedApp,
      metrics: [
        { ...platformMetrics("android", "2026-08-30", 10)[13], date: "2026-08-30" },
        { ...platformMetrics("ios", "2026-08-30", 4)[13], date: "2026-08-30" },
        { ...platformMetrics("ios", "2026-08-30", 0)[13], date: "2026-08-29" },
      ],
      metricObservations: [
        { appId: app.id, platform: "android", date: "2026-08-30", metricKey: "daily_user_installs", value: 10, source: "google_play_gcs", quality: "exact", observedAt: "2026-09-01T00:00:00Z" },
        { appId: app.id, platform: "ios", date: "2026-08-30", metricKey: "total_downloads", value: 4, source: "app_store_analytics", quality: "exact", observedAt: "2026-09-01T00:00:00Z" },
      ],
      reviews: [], releases: [], syncRuns: [], source: "database",
    };

    expect(buildPeriodSummary(data, "28d").downloads).toBe(14);
    expect(buildPeriodSummary(data, "28d").iosDownloads).toBe(4);
    expect(metricQualityForPeriod(data, "28d", ["total_downloads"], "ios")).toBe("derived");
  });

  it("uses an inclusive 28-day window for dashboard KPI data", () => {
    expect(periodStart("28d", "2026-08-31")).toBe("2026-08-04");
  });

  it("builds daily install, uninstall, and net values without inventing missing iOS data", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [
        {
          ...platformMetrics("android", "2026-08-30", 10)[13],
          date: "2026-08-30",
          installs: 150,
          uninstalls: 35,
        },
        {
          ...platformMetrics("ios", "2026-08-30", 10)[13],
          date: "2026-08-30",
          installs: null,
          uninstalls: null,
        },
      ],
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };

    expect(buildInstallLifecycle(data, "7d")).toEqual({
      totals: { installs: 150, uninstalls: 35, net: 115 },
      coverage: { android: true, ios: false },
      trend: [
        { date: "2026-08-30", installs: 150, uninstalls: 35, net: 115 },
      ],
    });
  });

  it("counts VOC keywords only from negative reviews", () => {
    const keywords = buildVocKeywords([
      { id: "1", appId: app.id, platform: "android", externalId: "1", rating: 1, title: null, content: "로그인이 느려요", author: null, version: null, reviewedAt: "2026-08-30T00:00:00Z" },
      { id: "2", appId: app.id, platform: "ios", externalId: "2", rating: 5, title: null, content: "로그인이 빨라요", author: null, version: null, reviewedAt: "2026-08-30T00:00:00Z" },
    ]);

    expect(keywords.slice(0, 2)).toEqual([
      { label: "로그인", count: 1 },
      { label: "속도", count: 1 },
    ]);
  });
});

describe("rating KPI fallbacks", () => {
  it("compares the first and last visible rating when the previous period is unavailable", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [
        {
          ...platformMetrics("ios", "2026-08-30", 10)[12],
          date: "2026-08-29",
          rating: 5,
        },
        {
          ...platformMetrics("ios", "2026-08-30", 10)[13],
          date: "2026-08-30",
          rating: 5,
        },
      ],
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };

    expect(buildPeriodSummary(data, "7d").iosRatingChange).toBe(0);
  });

  it("ignores daily metric ratings when the production snapshot source has no evidence", () => {
    const data: DashboardData = {
      apps: [app], app,
      metrics: [{ ...platformMetrics("ios", "2026-08-30", 1)[13], date: "2026-08-30", rating: 5 }],
      ratingSnapshots: [],
      reviews: [], releases: [], syncRuns: [], source: "database",
    };

    expect(buildPeriodSummary(data, "7d").iosRating).toBeNull();
    expect(buildRatingTrend(data, "7d")).toEqual([]);
  });

  it("does not present a stale snapshot from outside the selected period as current", () => {
    const data: DashboardData = {
      apps: [app], app,
      metrics: [{ ...platformMetrics("android", "2026-08-30", 1)[13], date: "2026-08-30", rating: 5 }],
      ratingSnapshots: [{ appId: app.id, platform: "android", territory: "ALL", date: "2026-03-02", averageRating: 4.2, ratingCount: 100, source: "google_play_gcs", quality: "exact", observedAt: "2026-03-03T00:00:00Z" }],
      reviews: [], releases: [], syncRuns: [], source: "database",
    };

    expect(buildPeriodSummary(data, "28d").androidRating).toBeNull();
  });
});

describe("period review quality", () => {
  it("does not mark old reviews as exact for a period with no reviews", () => {
    const data: DashboardData = {
      apps: [app], app,
      metrics: [{ ...platformMetrics("android", "2026-08-30", 1)[13], date: "2026-08-30" }],
      reviews: [{ id: "old", appId: app.id, platform: "android", externalId: "old", rating: 1, title: null, content: "old", author: null, version: null, reviewedAt: "2025-06-01T00:00:00Z", quality: "exact" }],
      releases: [], syncRuns: [], source: "database",
    };

    expect(reviewQualityForPeriod(data, "28d")).toBe("unavailable");
  });
});

const app = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "kis",
  name: "한국투자 앱",
  androidPackageName: null,
  iosAppId: null,
  iosBundleId: null,
};

function platformMetrics(
  platform: Platform,
  releasedAt: string,
  downloads: number,
) {
  const release = new Date(`${releasedAt}T00:00:00.000Z`);
  return Array.from({ length: 14 }, (_, index) => {
    const offset = index < 7 ? index - 7 : index - 6;
    const date = new Date(release);
    date.setUTCDate(date.getUTCDate() + offset);
    return {
      appId: app.id,
      platform,
      date: date.toISOString().slice(0, 10),
      downloads,
      rating: 4.5,
      ratingCount: 100,
      reviewCount: 1,
      active1DayUsers: null,
      active7DayUsers: null,
      active28DayUsers: null,
      sessions: null,
    };
  });
}

describe("buildReleaseImpact", () => {
  it("defaults to the latest release whose seven-day after window has elapsed", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [
        ...platformMetrics("ios", "2026-08-20", 100),
        {
          ...platformMetrics("android", "2026-08-31", 10)[0],
          date: "2026-08-31",
        },
      ].sort((a, b) => a.date.localeCompare(b.date)),
      reviews: [],
      releases: [
        {
          id: "observed-today",
          appId: app.id,
          platform: "android",
          version: "2.0.0",
          releasedAt: "2026-08-31T00:00:00.000Z",
          releaseDateEstimated: true,
        },
        {
          id: "mature",
          appId: app.id,
          platform: "ios",
          version: "1.9.0",
          releasedAt: "2026-08-20T00:00:00.000Z",
          releaseDateEstimated: true,
        },
      ],
      syncRuns: [],
      source: "database",
    };

    expect(selectLatestMatureRelease(data)?.id).toBe("mature");
  });

  it("uses the selected platform release date and only that platform's metrics", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [
        ...platformMetrics("android", "2026-08-10", 100),
        ...platformMetrics("ios", "2026-08-12", 1_000),
      ].sort((a, b) => a.date.localeCompare(b.date)),
      reviews: [],
      releases: [
        {
          id: "a",
          appId: app.id,
          platform: "android",
          version: "1.0.0",
          releasedAt: "2026-08-10T00:00:00.000Z",
        },
        {
          id: "i",
          appId: app.id,
          platform: "ios",
          version: "1.0.0",
          releasedAt: "2026-08-12T00:00:00.000Z",
        },
      ],
      syncRuns: [],
      source: "demo",
    };

    const impact = buildReleaseImpact(data, "1.0.0", "android");

    expect(impact?.windows.before.to).toBe("2026-08-09");
    expect(impact?.downloads).toMatchObject({
      before: 700,
      after: 700,
      changePercent: 0,
    });
  });

  it("uses first-time iOS downloads for the new-download release metric", () => {
    const metrics = platformMetrics("ios", "2026-08-12", 100);
    const data: DashboardData = {
      apps: [app],
      app,
      metrics,
      metricObservations: metrics.flatMap((metric) => [
        {
          appId: app.id,
          platform: "ios" as const,
          date: metric.date,
          metricKey: "total_downloads",
          value: 100,
          source: "app_store_analytics" as const,
          quality: "exact" as const,
          observedAt: `${metric.date}T23:00:00.000Z`,
        },
        {
          appId: app.id,
          platform: "ios" as const,
          date: metric.date,
          metricKey: "first_time_downloads",
          value: 40,
          source: "app_store_analytics" as const,
          quality: "exact" as const,
          observedAt: `${metric.date}T23:00:00.000Z`,
        },
      ]),
      reviews: [],
      releases: [
        {
          id: "i",
          appId: app.id,
          platform: "ios",
          version: "1.0.0",
          releasedAt: "2026-08-12T00:00:00.000Z",
        },
      ],
      syncRuns: [],
      source: "database",
    };

    expect(buildReleaseImpact(data, "1.0.0", "ios")?.downloads).toMatchObject({
      before: 280,
      after: 280,
    });
  });
});

describe("active user dashboard views", () => {
  const data: DashboardData = {
    apps: [app],
    app,
    metrics: [
      {
        ...platformMetrics("android", "2026-08-30", 10)[13],
        date: "2026-08-29",
        active28DayUsers: 288,
      },
      {
        ...platformMetrics("ios", "2026-08-30", 5)[13],
        date: "2026-08-29",
        active28DayUsers: 14,
      },
    ],
    reviews: [],
    releases: [],
    syncRuns: [],
    source: "database",
  };

  it("uses the latest per-platform 28-day active users", () => {
    expect(buildActiveUserSummary(data)).toEqual({
      total: 302,
      android: 288,
      ios: 14,
    });
    expect(buildOverview(data)).toMatchObject({
      active28DayUsers: 302,
      androidActive28DayUsers: 288,
      iosActive28DayUsers: 14,
    });
  });

  it("builds a platform-separated 28-day active user trend", () => {
    expect(buildActiveUserTrend(data, "30d")).toEqual([
      { date: "2026-08-29", android: 288, ios: 14, total: 302 },
    ]);
  });
});

describe("buildOverview real-data changes", () => {
  const metric = (
    date: string,
    platform: Platform,
    downloads: number,
    rating: number,
  ) => ({
    appId: app.id,
    platform,
    date,
    downloads,
    rating,
    ratingCount: 100,
    reviewCount: 1,
    active1DayUsers: null,
    active7DayUsers: null,
    active28DayUsers: null,
    sessions: null,
  });

  it("compares the selected download period with the preceding period", () => {
    const metrics = Array.from({ length: 14 }, (_, index) =>
      metric(
        `2026-08-${String(17 + index).padStart(2, "0")}`,
        "android",
        index < 7 ? 10 : 20,
        5,
      ),
    );
    const data: DashboardData = {
      apps: [app],
      app,
      metrics,
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };

    expect(buildDownloadPeriodChange(data, "7d")).toBe(100);
  });
  const review = (id: string, reviewedAt: string, rating: number) => ({
    id,
    appId: app.id,
    platform: "android" as const,
    externalId: id,
    rating,
    title: null,
    content: id,
    author: null,
    version: null,
    reviewedAt: `${reviewedAt}T00:00:00.000Z`,
  });

  it("compares current 30 days with the immediately preceding 30 days", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [
        metric("2026-07-02", "android", 100, 4),
        metric("2026-07-02", "ios", 50, 4),
        metric("2026-07-31", "android", 100, 4),
        metric("2026-07-31", "ios", 50, 4),
        metric("2026-08-01", "android", 200, 5),
        metric("2026-08-01", "ios", 100, 4.5),
        metric("2026-08-30", "android", 200, 5),
        metric("2026-08-30", "ios", 100, 4.5),
      ],
      reviews: [
        review("previous-negative-1", "2026-07-02", 1),
        review("previous-negative-2", "2026-07-03", 2),
        review("previous-positive-1", "2026-07-04", 5),
        review("previous-positive-2", "2026-07-05", 5),
        review("current-negative", "2026-08-01", 1),
        review("current-positive-1", "2026-08-02", 5),
        review("current-positive-2", "2026-08-03", 5),
        review("current-positive-3", "2026-08-04", 5),
      ],
      releases: [],
      syncRuns: [],
      source: "database",
    };

    expect(buildOverview(data)).toMatchObject({
      downloads30d: 600,
      downloads30dChangePercent: 100,
      androidRatingChangePercent: 25,
      iosRatingChangePercent: 12.5,
      negativeReviewRate: 25,
      negativeReviewRateChangePoints: -25,
    });
  });

  it("returns null changes when a prior comparison value does not exist", () => {
    const data: DashboardData = {
      apps: [app],
      app,
      metrics: [metric("2026-08-30", "android", 145, 5)],
      reviews: [],
      releases: [],
      syncRuns: [],
      source: "database",
    };

    expect(buildOverview(data)).toMatchObject({
      downloads30d: 145,
      downloads30dChangePercent: null,
      androidRatingChangePercent: null,
      iosRatingChangePercent: null,
      negativeReviewRate: null,
      negativeReviewRateChangePoints: null,
    });
  });
});

describe("reviewMatchesPeriod", () => {
  it("keeps historical reviews when the all period is selected", () => {
    expect(
      reviewMatchesPeriod("2025-06-27T00:00:00.000Z", "all", "2026-08-30"),
    ).toBe(true);
  });

  it("applies the selected rolling review period", () => {
    expect(
      reviewMatchesPeriod("2026-08-01T00:00:00.000Z", "30d", "2026-08-30"),
    ).toBe(true);
    expect(
      reviewMatchesPeriod("2026-07-31T23:59:59.000Z", "30d", "2026-08-30"),
    ).toBe(false);
  });
});

describe("reviewMatchesRatingGroup", () => {
  it("groups negative, neutral, and positive review scores", () => {
    expect(reviewMatchesRatingGroup(1, "negative")).toBe(true);
    expect(reviewMatchesRatingGroup(2, "negative")).toBe(true);
    expect(reviewMatchesRatingGroup(3, "neutral")).toBe(true);
    expect(reviewMatchesRatingGroup(4, "positive")).toBe(true);
    expect(reviewMatchesRatingGroup(5, "positive")).toBe(true);
    expect(reviewMatchesRatingGroup(3, "positive")).toBe(false);
    expect(reviewMatchesRatingGroup(1, "all")).toBe(true);
  });
});

describe("review dashboard summary", () => {
  const metric = (date: string, platform: Platform, rating: number) => ({
    appId: app.id,
    platform,
    date,
    downloads: null,
    rating,
    ratingCount: 100,
    reviewCount: 1,
    active1DayUsers: null,
    active7DayUsers: null,
    active28DayUsers: null,
    sessions: null,
  });
  const review = (
    id: string,
    reviewedAt: string,
    rating: number,
    platform: Platform,
  ) => ({
    id,
    appId: app.id,
    platform,
    externalId: id,
    rating,
    title: null,
    content: id,
    author: null,
    version: null,
    reviewedAt: `${reviewedAt}T00:00:00.000Z`,
  });
  const data: DashboardData = {
    apps: [app],
    app,
    metrics: [
      metric("2026-08-01", "android", 4.3),
      metric("2026-08-01", "ios", 4.5),
      metric("2026-08-30", "android", 4.4),
      metric("2026-08-30", "ios", 4.6),
    ],
    reviews: [
      review("previous", "2026-08-20", 2, "android"),
      review("android-five", "2026-08-24", 5, "android"),
      review("android-one", "2026-08-25", 1, "android"),
      review("ios-five", "2026-08-26", 5, "ios"),
    ],
    releases: [],
    syncRuns: [],
    source: "database",
  };

  it("counts reviews in the selected period and compares the preceding period", () => {
    expect(buildPeriodSummary(data, "7d")).toMatchObject({
      reviewCount: 3,
      reviewCountChange: 2,
    });
  });

  it("builds a five-to-one star distribution for each platform", () => {
    expect(buildRatingDistribution(data.reviews)).toEqual([
      {
        platform: "android",
        total: 3,
        rows: [
          { score: 5, count: 1, percent: 33.3 },
          { score: 4, count: 0, percent: 0 },
          { score: 3, count: 0, percent: 0 },
          { score: 2, count: 1, percent: 33.3 },
          { score: 1, count: 1, percent: 33.3 },
        ],
      },
      {
        platform: "ios",
        total: 1,
        rows: [
          { score: 5, count: 1, percent: 100 },
          { score: 4, count: 0, percent: 0 },
          { score: 3, count: 0, percent: 0 },
          { score: 2, count: 0, percent: 0 },
          { score: 1, count: 0, percent: 0 },
        ],
      },
    ]);
  });
});
