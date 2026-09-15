import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getDashboardData } from "@/db/dashboard.repository";
import { upsertAiInsightsCache } from "@/db/upsert";
import { generateReleaseImpactBriefing } from "@/services/ai/release-impact-briefing.service";
const cacheRows = vi.hoisted(() => ({ rows: [] as { payload: Record<string, unknown> }[] }));
vi.mock("@/services/ai/release-impact-briefing.service", () => ({ generateReleaseImpactBriefing: vi.fn() }));

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
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

vi.mock("@/db/dashboard.repository", () => ({
  getDashboardData: vi.fn(() =>
    Promise.resolve({
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
      source: "demo",
    }),
  ),
}));

describe("AI Briefing API Route", () => {
  it("handles dashboard executive briefing request", async () => {
    const request = new Request("http://localhost/api/ai/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      method: "POST", body: JSON.stringify({appCode: "kis", type: "release_impact", releaseId: "rel-1", cacheOnly: true}),
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
      headers: { "Content-Type": "application/json" },
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
    expect(upsertAiInsightsCache).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({cacheKey: "release:rel-1", insightType: "release_impact", payload: briefing})]);
  });
});
