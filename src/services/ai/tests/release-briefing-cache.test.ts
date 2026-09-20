import { expect, it, vi } from "vitest";
import { shareReleaseBriefing, releaseBriefingFingerprint } from "../release-briefing-cache";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";
import { demoDashboardData } from "@/data/demo";
import type { ReleaseImpactAiBriefing } from "@/domain/types";

it("shares concurrent generation and retries after failures", async () => {
  const generate = vi.fn(async (): Promise<ReleaseImpactAiBriefing> => { throw new Error("temporary failure"); });
  const first = shareReleaseBriefing("same-app-release", generate);
  const second = shareReleaseBriefing("same-app-release", generate);
  expect(first).toBe(second);
  await expect(first).rejects.toThrow("temporary failure");
  expect(generate).toHaveBeenCalledTimes(1);
  await expect(shareReleaseBriefing("same-app-release", generate)).rejects.toThrow("temporary failure");
  expect(generate).toHaveBeenCalledTimes(2);
});

it("changes the fingerprint when analysis data changes", () => {
  const view = buildReleaseImpactWorkspace(demoDashboardData, demoDashboardData.releases[0]);
  const hash = releaseBriefingFingerprint(view);
  expect(releaseBriefingFingerprint(structuredClone(view))).toBe(hash);
  expect(releaseBriefingFingerprint({ ...view, downloads: { ...view.downloads, after: 987654 } })).not.toBe(hash);
  expect(releaseBriefingFingerprint({ ...view, windows: { ...view.windows, after: { ...view.windows.after, to: "2099-01-01" } } })).not.toBe(hash);
});
