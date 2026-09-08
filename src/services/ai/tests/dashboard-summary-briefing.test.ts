import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateDashboardSummaryBriefing } from "../dashboard-summary-briefing.service";
import type { DashboardData } from "@/domain/types";

describe("Dashboard Summary Briefing Service", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  const mockData: DashboardData = {
    apps: [],
    app: {
      id: "app-1",
      code: "kis",
      name: "한국투자",
      androidPackageName: "com.truefriend.kis",
      iosAppId: "123456",
      iosBundleId: "com.truefriend.kis",
    },
    metrics: [],
    reviews: [],
    releases: [],
    syncRuns: [],
    source: "demo",
  };

  it("generates dashboard briefing using Gemini API", async () => {
    const mockAiResponse = {
      headline: "한국투자 앱 30일간 안정적 다운로드 성장세 지속",
      summary: "최근 30일 다운로드가 8.6% 증가하며 전반적인 지표가 호조를 보이고 있습니다.",
      highlights: [
        {
          category: "growth",
          title: "다운로드 성장세",
          description: "다운로드가 전 기간 대비 8.6% 상승했습니다.",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAiResponse) }],
            },
          },
        ],
      }),
    } as Response);

    const briefing = await generateDashboardSummaryBriefing(
      mockData,
      15000,
      8.6,
      "30일",
    );

    expect(briefing.headline).toContain("한국투자");
    expect(briefing.highlights).toHaveLength(1);
    expect(briefing.highlights[0].category).toBe("growth");
  });

  it("generates fallback briefing when API call fails", async () => {
    delete process.env.GEMINI_API_KEY;

    const briefing = await generateDashboardSummaryBriefing(
      mockData,
      15000,
      8.6,
      "30일",
    );

    expect(briefing.headline).toContain("한국투자");
    expect(briefing.highlights.length).toBeGreaterThan(0);
  });
});
