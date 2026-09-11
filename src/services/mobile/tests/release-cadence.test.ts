import { describe, expect, it } from "vitest";
import type { AppRelease, Platform } from "@/domain/types";
import { buildReleaseCadence } from "../tabs/releases.service";

function release(platform: Platform, releasedAt: string, source: AppRelease["releaseDateSource"] = "version_created_at"): AppRelease {
  return { id: `${platform}-${releasedAt}`, appId: "app", platform, version: releasedAt, releasedAt, releaseDateSource: source };
}

describe("buildReleaseCadence", () => {
  it("counts the screenshot releases by OS using today's date, independent of metric lag", () => {
    const result = buildReleaseCadence([
      release("ios", "2026-08-12"),
      release("android", "2026-09-10", "first_observed_at"),
      release("ios", "2026-09-09"),
      release("android", "2026-08-31", "first_observed_at"),
      release("ios", "2026-08-15"),
    ], "2026-09-11");
    expect(result).toEqual({
      recentCount: 4,
      platforms: [
        { platform: "android", recentCount: 2, averageCycleDays: 10 },
        { platform: "ios", recentCount: 2, averageCycleDays: 14 },
      ],
    });
  });

  it("includes first observations and the full reference day, excludes dates outside the recent window", () => {
    const result = buildReleaseCadence([
      release("android", "2026-09-11T23:59:59Z"),
      release("android", "2026-08-13T00:00:00Z"),
      release("android", "2026-08-12T23:59:59Z"),
      release("android", "2026-09-12"),
      release("android", "2026-09-10", "first_observed_at"),
      release("android", "invalid"),
    ], "2026-09-11");
    expect(result.platforms[0]).toEqual({ platform: "android", recentCount: 3, averageCycleDays: 10 });
    expect(result.platforms[1]).toEqual({ platform: "ios", recentCount: 0, averageCycleDays: null });
  });

  it("cannot infer a cadence from a single release", () => {
    expect(buildReleaseCadence([release("ios", "2026-09-09")], "2026-09-11").platforms[1].averageCycleDays).toBeNull();
  });
});
