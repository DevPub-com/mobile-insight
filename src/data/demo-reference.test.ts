import { describe, expect, it } from "vitest";

import {
  buildDownloadPeriodChange,
  buildDownloadTrend,
  buildPeriodSummary,
  buildRatingTrend,
  buildReviewRateTrend,
} from "@/services/mobile";
import { demoDashboardData } from "./demo";

describe("Mobile Insight reference demo", () => {
  it("matches the dashboard reference KPI data", () => {
    const summary = buildPeriodSummary(demoDashboardData, "7d");
    const sevenDays = buildDownloadTrend(demoDashboardData, "7d");

    expect(demoDashboardData.app.name).toBe("KB스타뱅킹");
    expect(demoDashboardData.apps).toHaveLength(4);
    expect(demoDashboardData.apps.map((app) => app.name)).toEqual([
      "KB스타뱅킹",
      "KB국민은행 스타뱅킹",
      "KB Pay",
      "스타퀴즈",
    ]);
    expect(
      new Set(demoDashboardData.metrics.map((metric) => metric.date)).size,
    ).toBeGreaterThanOrEqual(30);
    expect(sevenDays.map((point) => point.date)).toEqual([
      "2025-05-04",
      "2025-05-05",
      "2025-05-06",
      "2025-05-07",
      "2025-05-08",
      "2025-05-09",
      "2025-05-10",
    ]);
    expect(sevenDays.reduce((sum, point) => sum + (point.total ?? 0), 0)).toBe(
      128_945,
    );
    expect(buildDownloadPeriodChange(demoDashboardData, "7d")).toBeCloseTo(
      -4.3,
      1,
    );
    expect(summary).toMatchObject({
      downloads: 128_945,
      downloadChangePercent: -4.3,
      androidRating: 4.32,
      androidRatingChange: 0.06,
      iosRating: 4.41,
      iosRatingChange: 0.08,
      negativeReviewRate: 8.7,
      negativeReviewRateChangePoints: -1.6,
    });
    expect(demoDashboardData.releases[0]).toMatchObject({ version: "5.12.0" });
    expect(buildRatingTrend(demoDashboardData, "7d").at(-1)).toEqual({
      date: "2025-05-10",
      android: 4.32,
      ios: 4.41,
    });
    expect(buildReviewRateTrend(demoDashboardData, "7d")).toHaveLength(7);
  });
});
