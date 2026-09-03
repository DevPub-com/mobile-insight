import { describe, expect, it } from "vitest";

import {
  parseGoogleInstallMetrics,
  parseGoogleInstallReport,
} from "../google-installs";

const app = {
  id: "app-1",
  code: "kb",
  name: "KB스타뱅킹",
  androidPackageName: "com.kbstar.kbbank",
  iosAppId: null,
  iosBundleId: null,
};

describe("parseGoogleInstallMetrics", () => {
  it("aggregates downloads, device installs, and device uninstalls by date", () => {
    const metrics = parseGoogleInstallMetrics(app, [
      {
        Date: "2026-08-30",
        Country: "KR",
        "Daily User Installs": "1,200",
        "Daily Device Installs": "1,450",
        "Daily Device Uninstalls": "310",
      },
      {
        Date: "2026-08-30",
        Country: "US",
        "Daily User Installs": "20",
        "Daily Device Installs": "24",
        "Daily Device Uninstalls": "5",
      },
    ]);

    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      date: "2026-08-30",
      downloads: 1_220,
      installs: 1_474,
      uninstalls: 315,
    });
  });

  it("keeps a missing CSV measure null instead of turning it into zero", () => {
    const [metric] = parseGoogleInstallMetrics(app, [
      { Date: "2026-08-30", "Daily User Installs": "12" },
    ]);

    expect(metric).toMatchObject({
      downloads: 12,
      installs: null,
      uninstalls: null,
    });
  });

  it("preserves every overview install measure as an exact GCS observation", () => {
    const report = parseGoogleInstallReport(
      app,
      [
        {
          Date: "2026-08-30",
          "Daily User Installs": "120",
          "Daily User Uninstalls": "12",
          "Daily Device Installs": "150",
          "Daily Device Uninstalls": "30",
          "Current User Installs": "5,000",
          "Total User Installs": "8,000",
        },
      ],
      "2026-09-01T01:00:00.000Z",
    );

    expect(report.metrics[0]).toMatchObject({ downloads: 120, installs: 150, uninstalls: 30 });
    expect(report.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: "daily_user_installs", value: 120, quality: "exact" }),
        expect.objectContaining({ metricKey: "daily_user_uninstalls", value: 12 }),
        expect.objectContaining({ metricKey: "current_user_installs", value: 5_000 }),
        expect.objectContaining({ metricKey: "total_user_installs", value: 8_000 }),
      ]),
    );
    expect(report.observations.every((item) => item.source === "google_play_gcs")).toBe(true);
  });
});
