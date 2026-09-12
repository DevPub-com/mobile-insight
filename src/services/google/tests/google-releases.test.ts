import { describe, expect, it } from "vitest";

import {
  fetchGoogleReleaseData,
  mergeGoogleReleaseSources,
  normalizeGoogleReleaseSummaries,
  normalizeGoogleReleases,
} from "../google-releases";

describe("normalizeGoogleReleases", () => {
  it("excludes test tracks and production drafts before storage", () => {
    const releases = normalizeGoogleReleases("app", [
      {track: "internal", releases: [{name: "test", status: "completed"}]},
      {track: "production", releases: [{name: "draft", status: "draft"}, {name: "live", status: "inProgress"}]},
    ]);
    expect(releases.map(release => release.version)).toEqual(["live"]);
    const summaries = normalizeGoogleReleaseSummaries("app", [
      {track: "production", releaseName: "pending", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_APPROVED_NOT_PUBLISHED"},
      {track: "beta", releaseName: "test", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED"},
      {track: "production", releaseName: "live", releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED"},
    ]);
    expect(summaries.map(release => release.version)).toEqual(["live"]);
  });
  it.each([
    ["26091008 (2.27.05)", "2.27.05"],
    [" 26091008 ( 2.27.05 ) ", "2.27.05"],
    ["2.27.05", "2.27.05"],
    ["September (production)", "September (production)"],
    [undefined, "26091008"],
  ])("normalizes %s consistently in active and historical releases", (name, version) => {
    const active = normalizeGoogleReleases("app-1", [{
      track: "production",
      releases: [{ status: "completed", name, versionCodes: ["26091008"] }],
    }]);
    const historical = normalizeGoogleReleaseSummaries("app-1", [{
      releaseName: name,
      releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED",
      activeArtifacts: [{ versionCode: 26091008 }],
    }]);
    for (const releases of [active, historical]) {
      expect(releases[0]).toMatchObject({ version, buildNumber: "26091008" });
    }
  });

  it("maps the production track release and marks its first-observed date as estimated", () => {
    const releases = normalizeGoogleReleases(
      "app-1",
      [
        {
          track: "production",
          releases: [
            {
              name: "1.6.1",
              versionCodes: ["16100"],
              status: "completed",
              releaseNotes: [
                { language: "en-US", text: "Stability improvements" },
                { language: "ko-KR", text: "안정성을 개선했습니다." },
              ],
            },
          ],
        },
      ],
      new Date("2026-08-31T13:00:00Z"),
    );

    expect(releases).toEqual([
      expect.objectContaining({
        platform: "android",
        version: "1.6.1",
        releasedAt: "2026-08-31T13:00:00.000Z",
        status: "completed",
        track: "production",
        releaseNotes: "안정성을 개선했습니다.",
        releaseDateSource: "first_observed_at",
        releaseDateEstimated: true,
        buildNumber: "16100",
      }),
    ]);
  });

  it("maps non-obsolete release summaries returned outside the active edit", () => {
    const releases = normalizeGoogleReleaseSummaries(
      "app-1",
      [{
        releaseName: "1.5.0",
        track: "production",
        activeArtifacts: [{ versionCode: 15000 }],
        releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED",
      }],
      new Date("2026-08-31T13:00:00Z"),
    );

    expect(releases).toEqual([
      expect.objectContaining({
        version: "1.5.0",
        buildNumber: "15000",
        track: "production",
        status: "RELEASE_LIFECYCLE_STATE_PUBLISHED",
      }),
    ]);
  });

  it("keeps historical releases while enriching active releases with notes", () => {
    const historical = normalizeGoogleReleaseSummaries(
      "app-1",
      [
        { releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED", releaseName: "1.5.0", track: "production", activeArtifacts: [{ versionCode: 15000 }] },
        { releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED", releaseName: "1.6.1", track: "production", activeArtifacts: [{ versionCode: 16100 }] },
      ],
      new Date("2026-08-31T13:00:00Z"),
    );
    const active = normalizeGoogleReleases(
      "app-1",
      [{ track: "production", releases: [{
        name: "1.6.1",
        status: "completed",
        versionCodes: ["16100"],
        releaseNotes: [{ language: "ko-KR", text: "안정성 개선" }],
      }] }],
      new Date("2026-08-31T13:00:00Z"),
    );

    expect(mergeGoogleReleaseSources(historical, active)).toEqual([
      expect.objectContaining({ version: "1.5.0", buildNumber: "15000" }),
      expect.objectContaining({ version: "1.6.1", releaseNotes: "안정성 개선" }),
    ]);
  });

  it("reads Play tracks through a temporary edit and deletes the edit", async () => {
    const calls: Array<{ method?: string; url: string }> = [];
    const request = async <T>({ method, url }: { method?: string; url: string }) => {
      calls.push({ method, url });
      if (method === "POST") return { data: { id: "edit-1" } as T };
      if (method === "DELETE") return { data: {} as T };
      if (url.includes("/countryAvailability/production")) {
        return {
          data: {
            countries: [{ countryCode: "KR" }, { countryCode: "US" }],
            restOfWorld: false,
          } as T,
        };
      }
      if (url.includes("/tracks/production/releases")) {
        return { data: { releases: [{
          releaseName: "1.5.0",
          track: "production",
          activeArtifacts: [{ versionCode: 15000 }],
          releaseLifecycleState: "RELEASE_LIFECYCLE_STATE_PUBLISHED",
        }] } as T };
      }
      return {
        data: {
          tracks: [
            {
              track: "production",
              releases: [{ name: "1.6.1", versionCodes: ["16100"], status: "completed" }],
            },
            {
              track: "internal",
              releases: [{ name: "1.7.0-internal", versionCodes: ["17000"], status: "completed" }],
            },
            {
              track: "wear:production",
              releases: [{ name: "1.2.0", versionCodes: ["12000"], status: "completed" }],
            },
            {
              track: "tv:production",
              releases: [{ name: "2.0.0", versionCodes: ["20000"], status: "completed" }],
            },
          ],
        } as T,
      };
    };

    const result = await fetchGoogleReleaseData(
      { id: "app-1", packageName: "com.example.app" },
      request,
      new Date("2026-08-31T13:00:00Z"),
    );

    expect(result.releases.map((release) => release.version)).toEqual(["1.5.0", "1.6.1"]);
    expect(result.distribution).toEqual({
      appId: "app-1",
      platform: "android",
      countryCodes: ["KR", "US"],
      restOfWorld: false,
      deviceTypes: ["phone_tablet", "wear", "tv"],
      source: "google_play_api",
      quality: "exact",
      observedAt: "2026-08-31T13:00:00.000Z",
    });
    expect(result).not.toHaveProperty("observedReleases");
    expect(calls.some((call) => call.url.includes("/tracks/production/releases"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/tracks/internal/releases"))).toBe(false);
    expect(calls.some((call) => call.url.includes("/countryAvailability/production"))).toBe(true);
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("keeps release data when country availability is unavailable", async () => {
    const request = async <T>({ method, url }: { method?: string; url: string }) => {
      if (method === "POST") return { data: { id: "edit-1" } as T };
      if (method === "DELETE") return { data: {} as T };
      if (url.includes("/countryAvailability/production")) {
        throw new Error("country endpoint denied");
      }
      if (url.includes("/tracks/production/releases")) {
        return { data: { releases: [] } as T };
      }
      return {
        data: {
          tracks: [{
            track: "production",
            releases: [{ name: "1.6.1", versionCodes: ["16100"], status: "completed" }],
          }],
        } as T,
      };
    };

    const result = await fetchGoogleReleaseData(
      { id: "app-1", packageName: "com.example.app" },
      request,
      new Date("2026-08-31T13:00:00Z"),
    );

    expect(result.releases).toHaveLength(1);
    expect(result.distribution).toBeNull();
    expect(result.distributionError).toContain("country endpoint denied");
  });
});
