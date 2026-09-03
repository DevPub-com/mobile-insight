import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { normalizeAppleReleases } from "../apple-releases";

describe("normalizeAppleReleases", () => {
  it("requests localization, build, and release method metadata", () => {
    const adapterSource = readFileSync(
      new URL("../adapter/app-store.adapter.ts", import.meta.url),
      "utf8",
    );
    expect(adapterSource).toContain("appStoreVersionLocalizations,build,appStoreVersionPhasedRelease");
    expect(adapterSource).toContain("releaseType");
    expect(adapterSource).toContain("fields[builds]=version");
  });

  it("joins version, localized release notes, and phased release metadata", () => {
    const releases = normalizeAppleReleases(
      "app-1",
      [
        {
          id: "version-1",
          attributes: {
            platform: "IOS",
            versionString: "6.1.0",
            earliestReleaseDate: "2026-08-20T01:00:00Z",
            appStoreState: "READY_FOR_SALE",
            releaseType: "AFTER_APPROVAL",
          },
          relationships: {
            appStoreVersionLocalizations: { data: [{ id: "loc-ko" }] },
            appStoreVersionPhasedRelease: { data: { id: "phase-1" } },
            build: { data: { id: "build-1" } },
          },
        },
      ],
      [
        {
          type: "appStoreVersionLocalizations",
          id: "loc-ko",
          attributes: { locale: "ko-KR", whatsNew: "로그인 성능을 개선했습니다." },
        },
        {
          type: "builds",
          id: "build-1",
          attributes: { version: "61042" },
        },
        {
          type: "appStoreVersionPhasedReleases",
          id: "phase-1",
          attributes: {
            phasedReleaseState: "ACTIVE",
            currentDayNumber: 3,
            startDate: "2026-08-20",
          },
        },
      ],
      new Date("2026-08-31T00:00:00Z"),
    );

    expect(releases).toEqual([
      expect.objectContaining({
        platform: "ios",
        version: "6.1.0",
        status: "READY_FOR_SALE",
        releaseNotes: "로그인 성능을 개선했습니다.",
        phasedReleaseState: "ACTIVE",
        phasedReleaseDay: 3,
        buildNumber: "61042",
      }),
    ]);
  });

  it("keeps released versions using createdDate when Apple omits earliestReleaseDate", () => {
    const releases = normalizeAppleReleases(
      "app-1",
      [
        {
          id: "version-created",
          attributes: {
            platform: "IOS",
            versionString: "1.6.1",
            earliestReleaseDate: null,
            createdDate: "2026-06-16T14:08:39Z",
            appStoreState: "READY_FOR_SALE",
          },
        },
      ],
      [],
      new Date("2026-08-31T00:00:00Z"),
    );

    expect(releases).toEqual([
      expect.objectContaining({
        version: "1.6.1",
        releasedAt: "2026-06-16T14:08:39.000Z",
        releaseDateSource: "version_created_at",
        releaseDateEstimated: true,
      }),
    ]);
  });
});
