import { describe, expect, it } from "vitest";
import { buildOsDownloadShare, buildModelInstallRanking } from "../tabs/download-breakdown.service";

describe("OS download share", () => {
  it("calculates shares of the selected download totals", () => {
    expect(buildOsDownloadShare(30, 70).map((row) => row.share)).toEqual([30, 70]);
  });
  it("does not confuse missing data with zero", () => {
    expect(buildOsDownloadShare(30, null).map((row) => row.share)).toEqual([null, null]);
    expect(buildOsDownloadShare(30, 0).map((row) => row.share)).toEqual([100, 0]);
    expect(buildOsDownloadShare(0, 0).map((row) => row.share)).toEqual([null, null]);
  });
});


describe("model install ranking", () => {
  const row = (model: string, installs: number) => ({ model, installs, downloads: null, platform: "android" as const, days: 1 });
  it("combines codes belonging to the same marketed model before ranking", () => {
    const ranked = buildModelInstallRanking([row("h8q", 100), row("m1s", 60), row("m1q", 50)]);
    expect(ranked).toEqual([
      { model: "Galaxy S26 (m1q, m1s)", installs: 110 },
      { model: "Galaxy Z Fold8 (h8q)", installs: 100 },
    ]);
  });
  it("keeps ambiguous codes separate and excludes unknown or zero counts", () => {
    const ranked = buildModelInstallRanking([row("a02q", 3), row("2036", 2), row("unknown", 100), row("m1s", 0)]);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((item) => item.installs)).toEqual([3, 2]);
  });
});
