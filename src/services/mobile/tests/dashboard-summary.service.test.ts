import { describe, expect, it } from "vitest";

import { demoDashboardData } from "@/data/demo";
import {
  buildDashboardSummary,
  buildDashboardSummaryForRange,
} from "@/services/mobile/dashboard-summary.service";
import { buildReleaseImpact } from "@/services/mobile/tabs/release-impact.service";

describe("dashboard summary API view model", () => {
  it("returns every section required by the reference dashboard", () => {
    const summary = buildDashboardSummary(demoDashboardData, "30d");

    expect(summary.period).toEqual({
      value: "30d",
      startDate: "2025-04-11",
      endDate: "2025-05-10",
      previousStartDate: "2025-03-12",
      previousEndDate: "2025-04-10",
    });
    expect(summary.availableDateRange).toEqual({
      startDate: "2025-04-11",
      endDate: "2025-05-10",
      days: 30,
    });
    expect(summary.kpis.downloads.value).toBe(679_281);
    expect(summary.kpis.ratings.android.value).toBe(4.32);
    expect(summary.kpis.ratings.ios.value).toBe(4.41);
    expect(summary.kpis.crashIssues.android).toMatchObject({
      value: 24,
      change: -42,
      changePercent: -33.3,
      quality: "derived",
    });
    expect(summary.charts.downloads).toHaveLength(30);
    expect(summary.charts.ratings).toHaveLength(30);
    expect(summary.negativeReviewsTop10).toHaveLength(5);
    expect(
      summary.negativeReviewsTop10.every((review) => review.rating <= 2),
    ).toBe(true);
    expect(summary.latestReleaseImpact.platforms.android.release?.version).toBe(
      "5.12.0",
    );
    expect(summary.latestReleaseImpact.platforms.ios.release?.version).toBe(
      "5.12.0",
    );
  });

  it("exposes review counts and downloads from the latest release through the latest data date", () => {
    const summary = buildDashboardSummary(demoDashboardData, "30d");

    for (const platform of ["android", "ios"] as const) {
      const impact = buildReleaseImpact(
        demoDashboardData,
        "5.12.0",
        platform,
        3,
        3,
        true,
      );
      expect(impact).not.toBeNull();
      if (impact === null) throw new Error("Expected release impact");

      expect(summary.latestReleaseImpact.platforms[platform].reviewCount).toEqual({
        before: impact.newReviews.before,
        after: impact.newReviews.after,
        change:
          impact.newReviews.after === null || impact.newReviews.before === null
            ? null
            : impact.newReviews.after - impact.newReviews.before,
        changePercent: impact.newReviews.changePercent,
      });
      expect(summary.latestReleaseImpact.platforms[platform].downloads).toEqual({
        before: impact.downloads.before,
        after: impact.downloads.after,
        change:
          impact.downloads.after === null || impact.downloads.before === null
            ? null
            : impact.downloads.after - impact.downloads.before,
        changePercent: impact.downloads.changePercent,
      });
    }
  });

  it("keeps unavailable crash issue values explicit instead of using crash events", () => {
    const summary = buildDashboardSummary(
      {
        ...demoDashboardData,
        crashIssues: undefined,
        metrics: demoDashboardData.metrics.map((metric) => ({
          ...metric,
          crashes: 999,
        })),
      },
      "30d",
    );

    expect(summary.kpis.crashIssues.android).toEqual({
      value: null,
      change: null,
      changePercent: null,
      sparkline: [],
      quality: "unavailable",
    });
    expect(summary.kpis.crashIssues.ios.value).toBeNull();
  });

  it("builds crash and ANR rate KPIs from Play Reporting observations", () => {
    const summary = buildDashboardSummaryForRange(
      {
        ...demoDashboardData,
        source: "database",
        crashIssues: undefined,
        metricObservations: [
          {
            appId: demoDashboardData.app.id,
            platform: "android",
            date: "2025-04-10",
            metricKey: "user_perceived_crash_rate_28d",
            value: 0.4,
            source: "google_play_api",
            quality: "exact",
            observedAt: "2025-04-11T00:00:00.000Z",
          },
          {
            appId: demoDashboardData.app.id,
            platform: "android",
            date: "2025-04-11",
            metricKey: "user_perceived_crash_rate_28d",
            value: 0.27,
            source: "google_play_api",
            quality: "exact",
            observedAt: "2025-04-12T00:00:00.000Z",
          },
          {
            appId: demoDashboardData.app.id,
            platform: "android",
            date: "2025-04-11",
            metricKey: "user_perceived_anr_rate_28d",
            value: 0.1,
            source: "google_play_api",
            quality: "exact",
            observedAt: "2025-04-12T00:00:00.000Z",
          },
        ],
      },
      { startDate: "2025-04-11", endDate: "2025-05-10" },
    );

    expect(summary.kpis.stability.crashRate).toEqual({
      value: 0.27,
      changePoints: -0.13,
      sparkline: [0.27],
      quality: "exact",
      asOfDate: "2025-04-11",
      observedAt: "2025-04-12T00:00:00.000Z",
    });
    expect(summary.kpis.stability.anrRate).toEqual({
      value: 0.1,
      changePoints: null,
      sparkline: [0.1],
      quality: "exact",
      asOfDate: "2025-04-11",
      observedAt: "2025-04-12T00:00:00.000Z",
    });
    expect(summary.kpis.monthlyActiveUsers.value).toBeNull();
  });

  it("calculates negative review rates independently by platform", () => {
    const summary = buildDashboardSummary(demoDashboardData, "7d");

    expect(summary.kpis.negativeReviews.android.value).not.toBe(
      summary.kpis.negativeReviews.ios.value,
    );
    expect(summary.kpis.negativeReviews.android.unit).toBe("percent");
    expect(summary.kpis.negativeReviews.ios.unit).toBe("percent");
  });

  it("limits dashboard review rows to the selected period", () => {
    const summary = buildDashboardSummary(demoDashboardData, "7d");

    expect(summary.negativeReviewsTop10.length).toBeGreaterThan(0);
    expect(
      summary.negativeReviewsTop10.every(
        (review) => review.reviewedAt.slice(0, 10) >= summary.period.startDate,
      ),
    ).toBe(true);
  });

  it("does not downgrade download quality for a disconnected platform", () => {
    const androidOnly = {
      ...demoDashboardData,
      source: "database" as const,
      app: {
        ...demoDashboardData.app,
        iosAppId: null,
        iosBundleId: null,
      },
      metrics: demoDashboardData.metrics.filter(
        (metric) => metric.platform === "android",
      ),
      metricObservations: demoDashboardData.metrics
        .filter((metric) => metric.platform === "android")
        .map((metric) => ({
          appId: metric.appId,
          platform: metric.platform,
          date: metric.date,
          metricKey: "daily_user_installs",
          value: metric.downloads,
          source: "google_play_gcs" as const,
          quality: "exact" as const,
          observedAt: `${metric.date}T23:00:00.000Z`,
        })),
    };

    expect(
      buildDashboardSummary(androidOnly, "30d").dataQuality.downloads,
    ).toBe("exact");
  });

  it("marks a platform review KPI unavailable when that platform has no reviews", () => {
    const summary = buildDashboardSummary(
      {
        ...demoDashboardData,
        source: "database",
        reviews: demoDashboardData.reviews.filter(
          (review) => review.platform === "android",
        ),
      },
      "30d",
    );

    expect(summary.kpis.negativeReviews.android.quality).toBe("exact");
    expect(summary.kpis.negativeReviews.ios.value).toBeNull();
    expect(summary.kpis.negativeReviews.ios.quality).toBe("unavailable");
  });

  it("builds every dashboard section from an arbitrary inclusive date range", () => {
    const summary = buildDashboardSummaryForRange(demoDashboardData, {
      startDate: "2025-04-20",
      endDate: "2025-04-24",
    });
    const expectedDownloads = demoDashboardData.metrics
      .filter(
        (metric) => metric.date >= "2025-04-20" && metric.date <= "2025-04-24",
      )
      .reduce((total, metric) => total + (metric.downloads ?? 0), 0);

    expect(summary.period).toEqual({
      value: "custom",
      days: 5,
      startDate: "2025-04-20",
      endDate: "2025-04-24",
      previousStartDate: "2025-04-15",
      previousEndDate: "2025-04-19",
    });
    expect(summary.kpis.downloads.value).toBe(expectedDownloads);
    expect(summary.charts.downloads).toHaveLength(5);
    expect(summary.charts.ratings).toHaveLength(5);
    expect(
      summary.negativeReviewsTop10.every((review) => {
        const reviewedAt = review.reviewedAt.slice(0, 10);
        return reviewedAt >= "2025-04-20" && reviewedAt <= "2025-04-24";
      }),
    ).toBe(true);
  });

  it("keeps the latest Android and iOS versions independent", () => {
    const summary = buildDashboardSummary(
      {
        ...demoDashboardData,
        releases: demoDashboardData.releases.map((release) =>
          release.id === "release-i-512"
            ? { ...release, version: "5.13.0" }
            : release,
        ),
      },
      "30d",
    );

    expect(summary.latestReleaseImpact.platforms.android.release?.version).toBe(
      "5.12.0",
    );
    expect(summary.latestReleaseImpact.platforms.ios.release?.version).toBe(
      "5.13.0",
    );
  });

  it("keeps the latest-release window independent from the selected dashboard period", () => {
    const earlyPeriod = buildDashboardSummaryForRange(demoDashboardData, {
      startDate: "2025-04-11",
      endDate: "2025-04-17",
    });
    const latePeriod = buildDashboardSummaryForRange(demoDashboardData, {
      startDate: "2025-05-04",
      endDate: "2025-05-10",
    });

    expect(earlyPeriod.latestReleaseImpact).toEqual(
      latePeriod.latestReleaseImpact,
    );
    expect(
      latePeriod.latestReleaseImpact.platforms.android.windows,
    ).toEqual({
      before: { from: "2025-05-05", to: "2025-05-07" },
      after: { from: "2025-05-08", to: "2025-05-10" },
    });
  });
});
