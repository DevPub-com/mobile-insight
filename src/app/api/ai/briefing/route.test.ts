import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
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

  it("handles release impact briefing request", async () => {
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
    expect(json.data).toBeDefined();
  });
});
