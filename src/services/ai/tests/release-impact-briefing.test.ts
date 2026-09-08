import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateReleaseImpactBriefing } from "../release-impact-briefing.service";
import type { ReleaseImpactWorkspaceView } from "../../mobile/tabs/release-impact.service";

describe("Release Impact Briefing Service", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  const mockView: ReleaseImpactWorkspaceView = {
    release: {
      id: "release-1",
      appId: "application-1",
      platform: "android",
      version: "2.4.0",
      releasedAt: "2026-08-25T00:00:00Z",
    },
    releasedAt: "2026-08-25T00:00:00Z",
    windows: {
      before: { from: "2026-08-18", to: "2026-08-24" },
      after: { from: "2026-08-25", to: "2026-08-31" },
    },
    downloads: {
      before: 1000,
      after: 1200,
      change: 200,
      changePercent: 20,
    },
    ratings: {
      android: { before: 4.2, after: 4.5, change: 0.3, changePercent: 7.1 },
      ios: { before: null, after: null, change: null, changePercent: null },
    },
    negativeReviews: {
      before: 10,
      after: 5,
      change: -5,
      changePercent: -50,
    },
    newReviews: {
      before: 20,
      after: 15,
      change: -5,
      changePercent: -25,
    },
    stability: {
      crashRate: {
        before: null,
        after: null,
        changePoints: null,
        beforeAsOfDate: null,
        afterAsOfDate: null,
        coverage: { before: 0, after: 0, expected: 7 },
      },
      anrRate: {
        before: null,
        after: null,
        changePoints: null,
        beforeAsOfDate: null,
        afterAsOfDate: null,
        coverage: { before: 0, after: 0, expected: 7 },
      },
    },
    daily: [],
    insights: [],
    voc: [{ label: "로그인", before: 5, after: 1, changePercent: -80 }],
    representativeReviews: [],
    platforms: ["android"],
    coverage: {
      beforeDays: 7,
      afterDays: 7,
      expectedDays: 7,
    },
  };

  it("generates briefing with Gemini API", async () => {
    const mockAiResponse = {
      headline: "v2.4.0 배포 후 다운로드 20% 증가 및 평점 개선",
      summary: "v2.4.0 배포 후 안정성이 개선되었으며 다운로드와 평점이 동반 상승했습니다.",
      riskLevel: "low",
      keyChanges: ["다운로드 20% 증가", "Android 평점 +0.3점 상승"],
      recommendations: ["현재 버전 유지 관리"],
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

    const briefing = await generateReleaseImpactBriefing(mockView);
    expect(briefing.headline).toContain("v2.4.0");
    expect(briefing.riskLevel).toBe("low");
    expect(briefing.keyChanges).toHaveLength(2);
  });

  it("generates fallback briefing when API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const briefing = await generateReleaseImpactBriefing(mockView);
    expect(briefing.headline).toContain("2.4.0");
    expect(briefing.riskLevel).toBe("low");
    expect(briefing.keyChanges.length).toBeGreaterThan(0);
  });
});
