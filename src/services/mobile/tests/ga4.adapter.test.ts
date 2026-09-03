import { describe, expect, it } from "vitest";

import {
  normalizeGa4Report,
  rollingDateRange,
} from "../adapter/ga4.adapter";

const appId = "11111111-1111-4111-8111-111111111111";

describe("normalizeGa4Report", () => {
  it("maps GA4 Android and iOS rows to daily active metrics including engagement", () => {
    expect(
      normalizeGa4Report(appId, {
        rows: [
          {
            dimensionValues: [{ value: "20260829" }, { value: "Android" }],
            metricValues: [
              { value: "12" },
              { value: "41" },
              { value: "288" },
              { value: "35" },
              { value: "10" },
              { value: "25" },
              { value: "64.2" },
              { value: "150" },
            ],
          },
          {
            dimensionValues: [{ value: "20260829" }, { value: "iOS" }],
            metricValues: [
              { value: "3" },
              { value: "8" },
              { value: "14" },
              { value: "5" },
            ],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        appId,
        platform: "android",
        date: "2026-08-29",
        active1DayUsers: 12,
        active7DayUsers: 41,
        active28DayUsers: 288,
        sessions: 35,
        newUsers: 10,
        engagedSessions: 25,
        averageSessionDuration: 64.2,
        screenPageViews: 150,
        downloads: null,
      }),
      expect.objectContaining({
        appId,
        platform: "ios",
        date: "2026-08-29",
        active1DayUsers: 3,
        active7DayUsers: 8,
        active28DayUsers: 14,
        sessions: 5,
        newUsers: null,
        engagedSessions: null,
        averageSessionDuration: null,
        screenPageViews: null,
        downloads: null,
      }),
    ]);
  });

  it("ignores malformed dates, unsupported platforms, and invalid metrics", () => {
    expect(
      normalizeGa4Report(appId, {
        rows: [
          {
            dimensionValues: [{ value: "20260829" }, { value: "web" }],
            metricValues: [{ value: "1" }, { value: "2" }, { value: "3" }, { value: "4" }],
          },
          {
            dimensionValues: [{ value: "bad-date" }, { value: "Android" }],
            metricValues: [{ value: "1" }, { value: "2" }, { value: "3" }, { value: "4" }],
          },
          {
            dimensionValues: [{ value: "20260829" }, { value: "iOS" }],
            metricValues: [{ value: "NaN" }, { value: "2" }, { value: "3" }, { value: "4" }],
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("rollingDateRange", () => {
  it("includes the requested number of calendar days ending yesterday", () => {
    expect(rollingDateRange(new Date("2026-08-30T10:00:00.000Z"), 35)).toEqual({
      startDate: "2026-07-26",
      endDate: "2026-08-29",
    });
  });
});
