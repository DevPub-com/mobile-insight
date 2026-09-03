import { describe, expect, it } from "vitest";

import { parseBackfillOptions } from "../backfill-options";

describe("parseBackfillOptions", () => {
  it("selects one app and platform for a targeted backfill", () => {
    expect(parseBackfillOptions(["--app=wtc", "--platform=android"])).toEqual({
      appCode: "wtc",
      platform: "android",
    });
  });

  it("rejects unsupported platforms", () => {
    expect(() => parseBackfillOptions(["--platform=web"])).toThrow("Unsupported platform");
  });
});
