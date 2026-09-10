import { describe, expect, it } from "vitest";
import { buildOsDownloadShare } from "../tabs/download-breakdown.service";

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
