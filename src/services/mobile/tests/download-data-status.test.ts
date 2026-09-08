import { describe, expect, it } from "vitest";

import type { DashboardData, DailyMetric, Platform } from "@/domain/types";
import {
  buildDownloadTrendForRange,
  downloadDataStatusForRange,
} from "@/services/mobile/tabs/downloads.service";

const metric = (
  date: string,
  platform: Platform,
  downloads: number | null,
): DailyMetric => ({
  appId: "app-1",
  platform,
  date,
  downloads,
  rating: null,
  ratingCount: null,
  reviewCount: null,
  active1DayUsers: null,
  active7DayUsers: null,
  active28DayUsers: null,
  sessions: null,
});

const dashboardData = (metrics: DailyMetric[]): DashboardData => ({
  apps: [],
  app: {
    id: "app-1",
    code: "test",
    name: "Test",
    androidPackageName: "com.example.test",
    iosAppId: "123456789",
    iosBundleId: "com.example.test",
  },
  metrics,
  reviews: [],
  releases: [],
  syncRuns: [],
  source: "database",
});

const range = { startDate: "2026-08-09", endDate: "2026-09-07" };

describe("download data status", () => {
  it("reports missing when the platform has no observed download values", () => {
    const data = dashboardData([
      metric("2026-08-09", "android", 120),
      metric("2026-08-09", "ios", null),
    ]);

    expect(downloadDataStatusForRange(data, "ios", range)).toBe("missing");
  });

  it("reports delayed when observed data stops before the selected end date", () => {
    const data = dashboardData([
      metric("2026-08-09", "android", 120),
      metric("2026-08-22", "android", 98),
    ]);

    expect(downloadDataStatusForRange(data, "android", range)).toBe(
      "delayed",
    );
  });

  it("treats an explicitly observed zero as available data", () => {
    const data = dashboardData([
      metric("2026-08-09", "android", 120),
      metric("2026-09-07", "android", 0),
    ]);

    expect(downloadDataStatusForRange(data, "android", range)).toBe(
      "available",
    );
  });

  it("keeps missing dates null instead of drawing them as zero downloads", () => {
    const data = dashboardData([
      metric("2026-08-09", "android", 120),
      metric("2026-08-09", "ios", 20),
    ]);

    expect(
      buildDownloadTrendForRange(data, {
        startDate: "2026-08-09",
        endDate: "2026-08-10",
      }),
    ).toEqual([
      { date: "2026-08-09", android: 120, ios: 20, total: 140 },
      { date: "2026-08-10", android: null, ios: null, total: null },
    ]);
  });
});
