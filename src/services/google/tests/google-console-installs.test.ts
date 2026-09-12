import { describe, expect, it } from "vitest";
import { parseConsoleInstallSnapshot } from "../google-console-installs";

const snapshot = {
  packageName: "com.example.app",
  sourceUrl: "https://play.google.com/console/u/5/developers/123/app/456/statistics?metrics=USER_ACQUISITION-NEW-EVENTS-PER_INTERVAL-DAY&dimension=COUNTRY&dimensionValues=OVERALL",
  observedAt: "2026-09-12T01:20:00Z",
  metric: "USER_ACQUISITION-NEW-EVENTS-PER_INTERVAL-DAY",
  dimension: "OVERALL",
  expectedRowCount: 2,
  rows: [{ date: "2026-09-05", value: 1169 }, { date: "2026-09-06", value: 1409 }],
};

describe("Play Console install snapshots", () => {
  it("accepts real daily new-user totals including zero", () => {
    expect(parseConsoleInstallSnapshot({ ...snapshot, rows: [snapshot.rows[0], { date: "2026-09-06", value: 0 }] }).rows).toHaveLength(2);
  });
  it.each([
    { metric: "USER_ACQUISITION-ALL-EVENTS-PER_INTERVAL-DAY" },
    { dimension: "KR" },
    { expectedRowCount: 3 },
    { rows: [snapshot.rows[0], snapshot.rows[0]] },
    { rows: [snapshot.rows[0], { date: "2026-09-07", value: 1 }] },
    { rows: [snapshot.rows[0], { date: "2026-09-06", value: -1 }] },
    { sourceUrl: "https://example.com/" },
    { rows: [snapshot.rows[0], { date: "2026-02-30", value: 1 }] },
  ])("rejects wrong metrics, partial captures and invalid rows: %j", (override) => {
    expect(() => parseConsoleInstallSnapshot({ ...snapshot, ...override })).toThrow();
  });
});
