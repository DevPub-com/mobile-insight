import { describe, expect, it } from "vitest";

import {
  fetchGoogleVitals,
  normalizeGoogleVitals,
} from "../google-vitals";

const row = (date: string, metric: string, value: string) => ({
  startTime: {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  },
  metrics: [{ metric, decimalValue: { value } }],
});

describe("normalizeGoogleVitals", () => {
  it("stores user-perceived rolling rates as percentage points", () => {
    const observations = normalizeGoogleVitals(
      "app-1",
      [row("2026-09-05", "userPerceivedCrashRate28dUserWeighted", "0.0027")],
      [row("2026-09-05", "userPerceivedAnrRate28dUserWeighted", "0.001")],
      "2026-09-07T12:00:00.000Z",
    );

    expect(observations).toEqual([
      expect.objectContaining({
        date: "2026-09-05",
        metricKey: "user_perceived_crash_rate_28d",
        value: 0.27,
        source: "google_play_api",
        quality: "exact",
      }),
      expect.objectContaining({
        date: "2026-09-05",
        metricKey: "user_perceived_anr_rate_28d",
        value: 0.1,
      }),
    ]);
  });

  it("drops rows without a valid date or requested decimal metric", () => {
    expect(
      normalizeGoogleVitals(
        "app-1",
        [
          row("2026-09-05", "differentMetric", "0.5"),
          { startTime: { year: 2026 }, metrics: [] },
        ],
        [],
        "2026-09-07T12:00:00.000Z",
      ),
    ).toEqual([]);
  });
});

describe("fetchGoogleVitals", () => {
  it("queries crash and ANR daily timelines through the reporting API", async () => {
    const calls: Array<{ url: string; data?: unknown }> = [];
    const request = async <T>(options: { method?: string; url: string; data?: unknown }) => {
      calls.push(options);
      if (!options.url.endsWith(":query")) {
        return {
          data: {
            freshnessInfo: {
              freshnesses: [{
                aggregationPeriod: "DAILY",
                latestEndTime: { year: 2026, month: 9, day: 3 },
              }],
            },
          } as T,
        };
      }
      return { data: { rows: [] } as T };
    };

    await fetchGoogleVitals(
      { id: "app-1", packageName: "com.example.app" },
      request,
      new Date("2026-09-07T12:00:00.000Z"),
      90,
    );

    expect(calls.map((call) => call.url)).toEqual([
      "https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.example.app/crashRateMetricSet",
      "https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.example.app/anrRateMetricSet",
      "https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.example.app/crashRateMetricSet:query",
      "https://playdeveloperreporting.googleapis.com/v1beta1/apps/com.example.app/anrRateMetricSet:query",
    ]);
    expect(calls[2]?.data).toMatchObject({
      timelineSpec: {
        aggregationPeriod: "DAILY",
        startTime: { year: 2026, month: 6, day: 5 },
        endTime: { year: 2026, month: 9, day: 3 },
      },
      metrics: ["userPerceivedCrashRate28dUserWeighted"],
    });
  });
});
