import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getDb } from "@/db";
import { loadFirebaseStability } from "@/services/firebase/release-stability";
import { getDashboardData } from "@/db/dashboard.repository";
import { upsertAiInsightsCache } from "@/db/upsert";
import { generateReleaseImpactBriefing } from "@/services/ai/release-impact-briefing.service";
vi.mock("@/services/firebase/release-stability", () => ({loadFirebaseStability: vi.fn(async (_code, view) => ({...view, crashReports:{...view.crashReports,after:123}}))}));
const cacheRows = vi.hoisted(() => ({ rows: [] as { payload: Record<string, unknown> }[] }));
vi.mock("@/services/ai/release-impact-briefing.service", () => ({ generateReleaseImpactBriefing: vi.fn() }));

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(cacheRows.rows)),
        innerJoin: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(cacheRows.rows)) })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
  })),
}));

vi.mock("@/db/upsert", () => ({
  upsertAiInsightsCache: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/db/dashboard.repository", () => {
  const data = {
      apps: [],
      app: {
        id: "app-1",
        code: "kis",
        name: "한국투자",
        androidPackageName: "com.truefriend.kis",
        iosAppId: "123456",
        iosBundleId: "com.truefriend.kis",
      },
      metrics: [
        {
          appId: "app-1",
          platform: "android",
          date: "2026-08-25",
          downloads: 100,
          rating: 4.5,
          ratingCount: 10,
          reviewCount: 2,
          active1DayUsers: 1000,
          active7DayUsers: 5000,
          active28DayUsers: 20000,
          sessions: 3000,
        },
      ],
      reviews: [],
      releases: [
        {
          id: "rel-1",
          appId: "app-1",
          platform: "android",
          version: "2.4.0",
          releasedAt: "2026-08-25T00:00:00Z",
        },
      ],
      syncRuns: [],
      source: "demo" as const,
    };
  return {
    getDashboardData: vi.fn(() => Promise.resolve(data)),
    getReleaseImpactData: vi.fn(() => Promise.resolve(data)),
  };
});

describe("AI Briefing API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheRows.rows = [];
  });

  it.each([undefined, "null", "https://other.test"])("rejects an absent or untrusted origin before any work: %s", async (origin) => {
    const response = await POST(new Request("http://localhost/api/ai/briefing", {
      method: "POST",
      headers: origin ? { Origin: origin } : {},
      body: "invalid JSON must not be parsed",
    }));
    expect(response.status).toBe(403);
    expect(getDb).not.toHaveBeenCalled();
    expect(getDashboardData).not.toHaveBeenCalled();
    expect(loadFirebaseStability).not.toHaveBeenCalled();
    expect(generateReleaseImpactBriefing).not.toHaveBeenCalled();
    expect(upsertAiInsightsCache).not.toHaveBeenCalled();
  });

  it("handles dashboard executive briefing request", async () => {
    const request = new Request("http://localhost/api/ai/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({
        appCode: "kis",
        type: "dashboard_executive",
        periodLabel: "30일",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data).toBeDefined();
    expect(json.data.headline).toContain("한국투자");
  });

  it("returns stored release text without loading metrics or generating AI", async () => {
    cacheRows.rows = [{ payload: { headline: "Saved analysis" } }];
    vi.mocked(getDashboardData).mockClear();
    vi.mocked(generateReleaseImpactBriefing).mockClear();
    const response = await POST(new Request("http://localhost/api/ai/briefing", {
      method: "POST", headers: { Origin: "http://localhost" }, body: JSON.stringify({appCode: "kis", type: "release_impact", releaseId: "rel-1", cacheOnly: true}),
    }));
    expect(await response.json()).toEqual({data: {headline: "Saved analysis"}, cached: true});
    expect(getDashboardData).not.toHaveBeenCalled();
    expect(generateReleaseImpactBriefing).not.toHaveBeenCalled();
    cacheRows.rows = [];
  });

  it("handles release impact briefing request", async () => {
    const briefing = {headline: "Fresh", summary: "Summary", riskLevel: "low" as const, keyChanges: [], recommendations: [], analyzedAt: "2026-09-14"};
    vi.mocked(generateReleaseImpactBriefing).mockResolvedValue(briefing);
    const request = new Request("http://localhost/api/ai/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: JSON.stringify({
        appCode: "kis",
        type: "release_impact",
        releaseId: "rel-1",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data).toEqual(briefing);
    expect(generateReleaseImpactBriefing).toHaveBeenCalledWith(expect.objectContaining({crashReports:expect.objectContaining({after:123})}));
    expect(upsertAiInsightsCache).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({cacheKey: "release:firebase-v1:rel-1", insightType: "release_impact", payload: {...briefing, _inputHash: expect.any(String), _expiresAt: expect.any(Number)}})]);
  });

  it("reuses unchanged analysis, invalidates changed metrics and honors explicit refresh", async () => {
    const briefing = {headline: "Fresh", summary: "Summary", riskLevel: "low" as const, keyChanges: [], recommendations: [], analyzedAt: "2026-09-14"};
    vi.mocked(generateReleaseImpactBriefing).mockResolvedValue(briefing);
    const request = (refresh = false) => POST(new Request("http://localhost/api/ai/briefing", {
      method: "POST", headers: { Origin: "http://localhost" },
      body: JSON.stringify({ appCode: "kis", type: "release_impact", releaseId: "rel-1", refresh }),
    }));
    await request();
    cacheRows.rows = [{ payload: vi.mocked(upsertAiInsightsCache).mock.calls.at(-1)![1][0].payload }];
    expect(await (await request()).json()).toEqual({ data: briefing, cached: true });
    expect(generateReleaseImpactBriefing).toHaveBeenCalledTimes(1);
    await request(true);
    expect(generateReleaseImpactBriefing).toHaveBeenCalledTimes(2);
    vi.mocked(loadFirebaseStability).mockImplementationOnce(async (_code, view) => ({ ...view, crashReports: { ...view.crashReports, after: 999 } }));
    expect((await (await request()).json()).cached).toBe(false);
    expect(generateReleaseImpactBriefing).toHaveBeenCalledTimes(3);
    cacheRows.rows[0].payload._expiresAt = 0;
    expect((await (await request()).json()).cached).toBe(false);
    expect(generateReleaseImpactBriefing).toHaveBeenCalledTimes(4);
  });
});
