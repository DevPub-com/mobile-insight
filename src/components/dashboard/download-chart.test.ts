import { describe, expect, it } from "vitest";

import type { AppRelease, ReleaseVersionMapping } from "@/domain/types";

import { buildReleaseMarkers } from "./download-chart";

const release = (
  overrides: Partial<AppRelease> & Pick<AppRelease, "id" | "platform" | "version">,
): AppRelease => ({
  appId: "app-1",
  releasedAt: "2026-09-01T00:00:00.000Z",
  ...overrides,
});

const versionMapping = (
  overrides: Partial<ReleaseVersionMapping>,
): ReleaseVersionMapping => ({
  platform: "android",
  appVersionCode: 27,
  version: "5.12.0",
  ...overrides,
});

describe("buildReleaseMarkers", () => {
  it("shows semantic versions with their OS and groups releases on the same date", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [
        release({ id: "android-1", platform: "android", version: "5.12.0" }),
        release({ id: "ios-1", platform: "ios", version: "v5.12.0" }),
      ],
      [],
    );

    expect(markers).toEqual([
      {
        xAxis: 0,
        label: "Android · v5.12.0\niOS · v5.12.0",
      },
    ]);
  });

  it("resolves an Android version code to the semantic review version", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [
        release({
          id: "android-27",
          platform: "android",
          version: "27",
          buildNumber: "27",
        }),
      ],
      [versionMapping({ appVersionCode: 27, version: "5.12.0" })],
    );

    expect(markers[0]?.label).toBe("Android · v5.12.0");
  });

  it("labels an unresolved numeric Android value as a build instead of a version", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [release({ id: "android-27", platform: "android", version: "27" })],
      [],
    );

    expect(markers[0]?.label).toBe("Android · build 27");
  });

  it("keeps build labels when multiple build codes resolve to conflicting versions", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [
        release({
          id: "android-multi",
          platform: "android",
          version: "27",
          buildNumber: "27, 28",
        }),
      ],
      [
        versionMapping({ appVersionCode: 27, version: "5.12.0" }),
        versionMapping({ appVersionCode: 28, version: "5.12.1" }),
      ],
    );

    expect(markers[0]?.label).toBe("Android · build 27");
  });

  it("does not prefix arbitrary store release names with v", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [
        release({
          id: "android-named",
          platform: "android",
          version: "Production release 5.12.0",
        }),
      ],
      [],
    );

    expect(markers[0]?.label).toBe("Android · Production release 5.12.0");
  });

  it("ignores a non-semantic review version mapping", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [release({ id: "android-27", platform: "android", version: "27" })],
      [versionMapping({ version: "Production release 5.12.0" })],
    );

    expect(markers[0]?.label).toBe("Android · build 27");
  });

  it("treats v-prefixed and unprefixed mappings as the same semantic version", () => {
    const markers = buildReleaseMarkers(
      ["2026-09-01"],
      [release({ id: "android-27", platform: "android", version: "27" })],
      [
        versionMapping({ version: "5.12.0" }),
        versionMapping({ version: "v5.12.0" }),
      ],
    );

    expect(markers[0]?.label).toBe("Android · v5.12.0");
  });
});

it("aligns first-open series by date without substituting downloads or filling gaps", async () => {
  const { buildFirstOpenSeries } = await import("./download-chart");
  const series = buildFirstOpenSeries(["2026-09-10", "2026-09-11", "2026-09-12"], [
    { date: "2026-09-11", android: 4641, ios: 1583, total: 6224 },
  ]);
  expect(series.map(({ name, data, lineStyle }) => ({ name, data, type: lineStyle.type }))).toEqual([
    { name: "Android 최초 실행", data: [null, 4641, null], type: "dashed" },
    { name: "iOS 최초 실행", data: [null, 1583, null], type: "dashed" },
  ]);
});
