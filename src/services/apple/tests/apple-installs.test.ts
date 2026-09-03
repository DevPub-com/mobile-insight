import { describe, expect, it } from "vitest";

import {
  fetchAppleDownloadAnalytics,
  fetchAppleInstallAnalytics,
  parseAppleDownloadRows,
  parseAppleInstallReport,
  parseAppleInstallRows,
} from "../apple-installs";

describe("parseAppleInstallRows", () => {
  it("aggregates opt-in install and delete counts for the selected app", () => {
    const metrics = parseAppleInstallRows("app-1", "12345", [
      { Date: "2026-08-29", "App Apple Identifier": "12345", Event: "Install", Counts: "100" },
      { Date: "2026-08-29", "App Apple Identifier": "12345", Event: "Delete", Counts: "20" },
      { Date: "2026-08-29", "App Apple Identifier": "99999", Event: "Install", Counts: "500" },
    ]);

    expect(metrics).toEqual([
      expect.objectContaining({
        platform: "ios",
        date: "2026-08-29",
        installs: 100,
        uninstalls: 20,
        downloads: null,
      }),
    ]);
  });
});

describe("parseAppleInstallReport", () => {
  it("marks opt-in usage metrics as estimated", () => {
    const result = parseAppleInstallReport("app-1", "12345", [
      { Date: "2026-08-29", "App Apple Identifier": "12345", Event: "Install", Counts: "100" },
    ], "2026-08-31T00:00:00.000Z");
    expect(result.observations).toEqual([
      expect.objectContaining({ metricKey: "installs", quality: "estimated", source: "app_store_analytics" }),
    ]);
  });
});

describe("fetchAppleInstallAnalytics", () => {
  it("creates a one-time snapshot request when historical reports do not exist", async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const appleJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
      calls.push({ path, init });
      if (init?.method === "POST") return { data: { id: "snapshot" } } as T;
      return { data: [] } as T;
    };

    await expect(
      fetchAppleInstallAnalytics("app-1", "12345", appleJson, {
        accessType: "ONE_TIME_SNAPSHOT",
        maxInstances: null,
      }),
    ).rejects.toThrow("1~2일");

    expect(JSON.parse(String(calls.at(-1)?.init?.body))).toMatchObject({
      data: { attributes: { accessType: "ONE_TIME_SNAPSHOT" } },
    });
  });
});

describe("parseAppleDownloadRows", () => {
  it("keeps first-time downloads, redownloads, and updates separate", () => {
    const result = parseAppleDownloadRows(
      "app-1",
      "12345",
      [
        { Date: "2026-08-29", "App Apple Identifier": "12345", "Download Type": "First-time Download", Counts: "100" },
        { Date: "2026-08-29", "App Apple Identifier": "12345", "Download Type": "Redownload", Counts: "20" },
        { Date: "2026-08-29", "App Apple Identifier": "12345", "Download Type": "Manual update", Counts: "7" },
        { Date: "2026-08-29", "App Apple Identifier": "12345", "Download Type": "Auto-update", Counts: "30" },
        { Date: "2026-08-29", "App Apple Identifier": "99999", "Download Type": "First-time Download", Counts: "500" },
      ],
      "2026-08-31T00:00:00.000Z",
    );

    expect(result.metrics).toEqual([
      expect.objectContaining({ date: "2026-08-29", downloads: 120 }),
    ]);
    expect(result.observations).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricKey: "first_time_downloads", value: 100, source: "app_store_analytics", quality: "exact" }),
      expect.objectContaining({ metricKey: "redownloads", value: 20 }),
      expect.objectContaining({ metricKey: "updates", value: 37 }),
      expect.objectContaining({ metricKey: "total_downloads", value: 120 }),
    ]));
  });

  it("does not create a zero metric when no download rows exist", () => {
    const result = parseAppleDownloadRows("app-1", "12345", [], "2026-08-31T00:00:00.000Z");
    expect(result.metrics).toEqual([]);
    expect(result.observations).toEqual([]);
  });
});

describe("fetchAppleDownloadAnalytics", () => {
  it("requests the Standard report rather than privacy-thresholded Detailed data", async () => {
    const paths: string[] = [];
    const appleJson = async <T>(path: string): Promise<T> => {
      paths.push(path);
      if (path.includes("analyticsReportRequests?")) {
        return { data: [{ id: "request-1", attributes: { accessType: "ONGOING" } }] } as T;
      }
      if (path.includes("/reports?")) {
        return { data: [
          { id: "detailed", attributes: { name: "App Downloads Detailed", category: "COMMERCE" } },
          { id: "standard", attributes: { name: "App Downloads Standard", category: "COMMERCE" } },
        ] } as T;
      }
      return { data: [] } as T;
    };
    await fetchAppleDownloadAnalytics("app-1", "12345", appleJson);
    expect(paths.some((path) => path.includes("/analyticsReports/standard/instances"))).toBe(true);
    expect(paths.some((path) => path.includes("/analyticsReports/detailed/instances"))).toBe(false);
  });
});
