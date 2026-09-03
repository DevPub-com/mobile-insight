import { describe, expect, it } from "vitest";

import { combinePlatformDownloads } from "./metric.service";

describe("combinePlatformDownloads", () => {
  it("adds Android and iOS downloads while preserving missing data", () => {
    expect(combinePlatformDownloads({ android: 820_340, ios: 611_780 })).toEqual({
      total: 1_432_120,
      hasData: true,
    });
    expect(combinePlatformDownloads({ android: 120, ios: null })).toEqual({
      total: 120,
      hasData: true,
    });
    expect(combinePlatformDownloads({ android: null, ios: null })).toEqual({
      total: null,
      hasData: false,
    });
  });
});
