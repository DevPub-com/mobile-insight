import { describe, expect, it } from "vitest";

import {
  fetchGoogleReleaseData,
  mergeGoogleReleaseSources,
  normalizeGoogleReleaseSummaries,
  normalizeGoogleReleases,
} from "../google-releases";

describe("normalizeGoogleReleases", () => {
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
        { releaseName: "1.5.0", track: "production", activeArtifacts: [{ versionCode: 15000 }] },
        { releaseName: "1.6.1", track: "production", activeArtifacts: [{ versionCode: 16100 }] },
      ],
      new Date("2026-08-31T13:00:00Z"),
    );
    const active = normalizeGoogleReleases(
      "app-1",
      [{ track: "production", releases: [{
        name: "1.6.1",
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
    expect(result).not.toHaveProperty("observedReleases");
    expect(calls.some((call) => call.url.includes("/tracks/production/releases"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/tracks/internal/releases"))).toBe(false);
    expect(calls.at(-1)?.method).toBe("DELETE");
  });
});
