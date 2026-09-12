import { expect, it } from "vitest";
import { isProductionRelease } from "../common/production-release";

it.each([
  ["android", "production", "completed", true],
  ["android", "production", "inProgress", true],
  ["android", "production", "halted", true],
  ["android", "production", "RELEASE_LIFECYCLE_STATE_PUBLISHED", true],
  ["android", "internal", "completed", false],
  ["android", "beta", "completed", false],
  ["android", "production", "draft", false],
  ["android", "production", "RELEASE_LIFECYCLE_STATE_APPROVED_NOT_PUBLISHED", false],
  ["android", null, "completed", false],
  ["android", "production", null, false],
  ["ios", "production", "READY_FOR_SALE", true],
  ["ios", "production", "PENDING_DEVELOPER_RELEASE", false],
] as const)("validates %s %s %s before persistence", (platform, track, status, expected) => {
  expect(isProductionRelease({platform, track, status})).toBe(expected);
});
