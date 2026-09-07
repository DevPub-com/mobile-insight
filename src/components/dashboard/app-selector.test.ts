import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { appIconEndpoint } from "./app-selector";

const source = readFileSync(new URL("./app-selector.tsx", import.meta.url), "utf8");

describe("app selector icons", () => {
  it("builds a local icon endpoint from the App Store id", () => {
    expect(
      appIconEndpoint({
        id: "app-id",
        code: "kis",
        name: "한국투자 앱",
        androidPackageName: "com.truefriend.neosmartarenewal",
        iosAppId: "1621986905",
        iosBundleId: "com.truefriend.neosmartirenewal",
      }),
    ).toBe("/api/apps/icon?iosAppId=1621986905");
  });

  it("uses the real icon image instead of the APP text label", () => {
    expect(source).toContain('className="app-selector__icon-image"');
    expect(source).not.toContain('className="app-selector__label">APP');
  });
});
