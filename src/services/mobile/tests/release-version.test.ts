import { describe, expect, it } from "vitest";

import {
  classifyVersionChange,
  compareVersionsDescending,
  displayReleaseVersion,
} from "../common/release-version";

it.each([
  ["android", "26091008 (2.27.05)", "2.27.05"],
  ["android", "v26091008 (2.27.05)", "2.27.05"],
  ["android", "2.27.05", "2.27.05"],
  ["ios", "2.28.00", "2.28.00"],
] as const)("formats %s version %s", (platform, version, expected) => {
  expect(displayReleaseVersion(platform, version)).toBe(expected);
});

describe("classifyVersionChange", () => {
  it.each([
    ["2.0.0", "1.9.9", "major"],
    ["1.3.0", "1.2.9", "minor"],
    ["1.2.4", "1.2.3", "patch"],
    ["1.2", "1.1", "minor"],
    ["2026.08.31", null, "unknown"],
  ] as const)("classifies %s after %s as %s", (current, previous, expected) => {
    expect(classifyVersionChange(current, previous)).toBe(expected);
  });
});

describe("compareVersionsDescending", () => {
  it("orders releases deterministically when first-observed timestamps match", () => {
    expect(["1.5.0", "2.0.0", "1.6.1", "1.6.0"].sort(compareVersionsDescending)).toEqual([
      "2.0.0",
      "1.6.1",
      "1.6.0",
      "1.5.0",
    ]);
  });
});
