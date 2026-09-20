import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoDashboardData } from "@/data/demo";
import { loadReleaseImpactData } from "@/services/mobile/dashboard.service";
import { loadFirebaseStability } from "@/services/firebase/release-stability";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";
import { GET } from "./route";
vi.mock("@/services/mobile/dashboard.service", () => ({
  loadReleaseImpactData: vi.fn(),
}));
vi.mock("@/services/firebase/release-stability", () => ({
  loadFirebaseStability: vi.fn(),
}));
vi.mock("@/services/mobile/tabs/release-impact.service", async importOriginal => {
  const actual = await importOriginal<typeof import("@/services/mobile/tabs/release-impact.service")>();
  return { ...actual, buildReleaseImpactWorkspace: vi.fn(actual.buildReleaseImpactWorkspace) };
});
describe("stored release impact read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the original review/download values without requiring Firebase", async () => {
    vi.mocked(loadReleaseImpactData).mockResolvedValue(demoDashboardData);
    const release = demoDashboardData.releases[0];
    const query = new URLSearchParams({
      platform: release.platform,
      version: release.version,
      stored: "true",
    });
    const response = await GET(new Request(`https://example.test/api/dashboard/kis/release-impact?${query}`), { params: Promise.resolve({ appId: "kis" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: buildReleaseImpactWorkspace(demoDashboardData, release),
    });
    expect(loadFirebaseStability).not.toHaveBeenCalled();
  });

  it("shares one in-flight dashboard read between stored and Firebase requests", async () => {
    let resolveData!: (data: typeof demoDashboardData) => void;
    vi.mocked(loadReleaseImpactData).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveData = resolve;
        }),
    );
    vi.mocked(loadFirebaseStability).mockImplementation(async (_appCode, workspace) => workspace);
    const release = demoDashboardData.releases[0];
    const query = new URLSearchParams({
      platform: release.platform,
      version: release.version,
    });
    const context = { params: Promise.resolve({ appId: "kis" }) };

    const stored = GET(new Request(`https://example.test/api/dashboard/kis/release-impact?${query}&stored=true`), context);
    const firebase = GET(new Request(`https://example.test/api/dashboard/kis/release-impact?${query}`), context);
    await vi.waitFor(() => expect(loadReleaseImpactData).toHaveBeenCalledTimes(1));
    resolveData(demoDashboardData);

    const responses = await Promise.all([stored, firebase]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(loadReleaseImpactData).toHaveBeenCalledTimes(1);
    expect(loadFirebaseStability).toHaveBeenCalledTimes(1);
    expect(buildReleaseImpactWorkspace).toHaveBeenCalledTimes(1);
  });
});
