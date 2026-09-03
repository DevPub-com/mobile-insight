import { describe, expect, it } from "vitest";

import { parseGoogleRatingReport } from "../google-reviews";

const app = {
  id: "app-1",
  code: "wtc",
  name: "WTC",
  androidPackageName: "com.worldtc.app",
  iosAppId: null,
  iosBundleId: null,
};

describe("parseGoogleRatingReport", () => {
  it("uses total average rating for the overview trend and keeps daily average separately", () => {
    const report = parseGoogleRatingReport(
      app,
      [{ Date: "2026-03-02", "Daily Average Rating": "4.25", "Total Average Rating": "4.31" }],
      "2026-09-01T01:00:00.000Z",
    );

    expect(report.metrics[0]).toMatchObject({ date: "2026-03-02", rating: 4.31 });
    expect(report.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricKey: "daily_average_rating", value: 4.25 }),
        expect.objectContaining({ metricKey: "overview_rating", value: 4.31 }),
      ]),
    );
    expect(report.snapshots[0]).toMatchObject({
      territory: "GLOBAL",
      averageRating: 4.31,
      source: "google_play_gcs",
      quality: "exact",
    });
  });

  it("does not fabricate a rating when total average is missing", () => {
    const report = parseGoogleRatingReport(
      app,
      [{ Date: "2026-03-02", "Daily Average Rating": "4.25" }],
      "2026-09-01T01:00:00.000Z",
    );

    expect(report.metrics).toEqual([]);
    expect(report.snapshots).toEqual([]);
    expect(report.observations).toEqual([
      expect.objectContaining({ metricKey: "daily_average_rating", value: 4.25 }),
    ]);
  });
});
