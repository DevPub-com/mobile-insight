import { describe, expect, it } from "vitest";

import {
  fetchPaginatedGa4Report,
  normalizeGa4DeviceReport,
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

  it("uses the GA4 property time zone at the local midnight boundary", () => {
    expect(
      rollingDateRange(new Date("2026-09-07T15:30:00.000Z"), 2, "Asia/Seoul"),
    ).toEqual({
      startDate: "2026-09-06",
      endDate: "2026-09-07",
    });
  });
});

describe("normalizeGa4DeviceReport", () => {
  it("maps device brand and model active users by date and platform", () => {
    expect(
      normalizeGa4DeviceReport(appId, {
        rows: [
          {
            dimensionValues: [
              { value: "20260907" },
              { value: "Android" },
              { value: "Samsung" },
              { value: "SM-S928N" },
            ],
            metricValues: [{ value: "120" }],
          },
          {
            dimensionValues: [
              { value: "20260907" },
              { value: "iOS" },
              { value: "Apple" },
              { value: "iPhone 17,1" },
            ],
            metricValues: [{ value: "40" }],
          },
        ],
      }),
    ).toEqual([
      {
        appId,
        platform: "android",
        date: "2026-09-07",
        deviceBrand: "Samsung",
        deviceModel: "SM-S928N",
        activeUsers: 120,
      },
      {
        appId,
        platform: "ios",
        date: "2026-09-07",
        deviceBrand: "Apple",
        deviceModel: "iPhone 17,1",
        activeUsers: 40,
      },
    ]);
  });

  it("keeps unknown buckets but drops invalid platform, date, and metrics", () => {
    expect(
      normalizeGa4DeviceReport(appId, {
        rows: [
          {
            dimensionValues: [
              { value: "20260907" },
              { value: "Android" },
              { value: " " },
              {},
            ],
            metricValues: [{ value: "3" }],
          },
          {
            dimensionValues: [
              { value: "20260907" },
              { value: "web" },
              { value: "Google" },
              { value: "Pixel" },
            ],
            metricValues: [{ value: "2" }],
          },
          {
            dimensionValues: [
              { value: "bad" },
              { value: "Android" },
              { value: "Google" },
              { value: "Pixel" },
            ],
            metricValues: [{ value: "2" }],
          },
          {
            dimensionValues: [
              { value: "20260907" },
              { value: "Android" },
              { value: "Google" },
              { value: "Pixel" },
            ],
            metricValues: [{ value: "-1" }],
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        deviceBrand: "(empty)",
        deviceModel: "(empty)",
        activeUsers: 3,
      }),
    ]);
  });

  it("keeps blank labels separate from GA4's literal not-set bucket", () => {
    const rows = [" ", "(not set)"].map((brand, index) => ({
      dimensionValues: [
        { value: "20260907" },
        { value: "Android" },
        { value: brand },
        { value: "Model" },
      ],
      metricValues: [{ value: String(index + 1) }],
    }));

    expect(normalizeGa4DeviceReport(appId, { rows })).toHaveLength(2);
  });

  it("paginates until the reported row count is complete", async () => {
    const offsets: string[] = [];
    const request = async <T>(options: { data?: { offset?: string } }) => {
      const offset = options.data?.offset ?? "0";
      offsets.push(offset);
      return {
        data: {
          rowCount: 3,
          rows: offset === "0"
            ? [{ dimensionValues: [], metricValues: [] }, { dimensionValues: [], metricValues: [] }]
            : [{ dimensionValues: [], metricValues: [] }],
        } as T,
      };
    };

    const result = await fetchPaginatedGa4Report(
      request,
      "https://example.test:runReport",
      { dimensions: [], metrics: [] },
      2,
    );

    expect(offsets).toEqual(["0", "2"]);
    expect(result.rows).toHaveLength(3);
  });

  it("rejects a paginated report when GA4 marks any page as incomplete", async () => {
    const request = async <T>() => ({
      data: {
        rowCount: 1,
        rows: [{ dimensionValues: [], metricValues: [] }],
        metadata: { dataLossFromOtherRow: true },
      } as T,
    });

    await expect(
      fetchPaginatedGa4Report(
        request,
        "https://example.test:runReport",
        { dimensions: [], metrics: [] },
        2,
      ),
    ).rejects.toThrow("incomplete");
  });

  it("retries transient GA4 failures and preserves the request options", async () => {
    let attempts = 0;
    const request = async <T>() => {
      attempts += 1;
      if (attempts === 1) {
        throw { response: { status: 503, headers: {} } };
      }
      return { data: { rowCount: 0, rows: [], metadata: { timeZone: "Asia/Seoul" } } as T };
    };

    await fetchPaginatedGa4Report(
      request,
      "https://example.test:runReport",
      { dimensions: [], metrics: [] },
      2,
      async () => undefined,
    );

    expect(attempts).toBe(2);
  });
});
