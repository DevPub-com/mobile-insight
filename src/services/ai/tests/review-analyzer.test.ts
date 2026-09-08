import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { analyzeReviewsBatch } from "../review-analyzer.service";
import type { AppReview } from "@/domain/types";

describe("Review Analyzer Service", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it("handles empty review list", async () => {
    const results = await analyzeReviewsBatch([]);
    expect(results.size).toBe(0);
  });

  it("analyzes reviews using Gemini API response", async () => {
    const mockReviews: AppReview[] = [
      {
        id: "rev-1",
        appId: "app-1",
        platform: "android",
        externalId: "ext-1",
        rating: 1,
        title: "오류 발생",
        content: "로그인할 때 지문 인식이 안 되고 앱이 튕겨요",
        author: "사용자A",
        version: "2.4.0",
        reviewedAt: "2026-09-01T00:00:00Z",
      },
    ];

    const mockAiResult = {
      results: [
        {
          externalId: "ext-1",
          sentiment: "negative",
          topics: ["지문인식_오류", "앱_종료"],
          summary: "로그인 지문 인식 시 앱 충돌 발생",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockAiResult) }],
            },
          },
        ],
      }),
    } as Response);

    const analysisMap = await analyzeReviewsBatch(mockReviews);
    expect(analysisMap.get("ext-1")).toEqual({
      externalId: "ext-1",
      sentiment: "negative",
      topics: ["지문인식_오류", "앱_종료"],
      summary: "로그인 지문 인식 시 앱 충돌 발생",
    });
  });

  it("falls back to heuristic analysis when AI call fails", async () => {
    delete process.env.GEMINI_API_KEY;

    const mockReviews: AppReview[] = [
      {
        id: "rev-2",
        appId: "app-1",
        platform: "ios",
        externalId: "ext-2",
        rating: 1,
        title: "로그인",
        content: "로그인이 안 돼요 접속 오류입니다",
        author: "사용자B",
        version: "2.4.0",
        reviewedAt: "2026-09-01T00:00:00Z",
      },
    ];

    const analysisMap = await analyzeReviewsBatch(mockReviews);
    const result = analysisMap.get("ext-2");
    expect(result).toBeDefined();
    expect(result?.sentiment).toBe("negative");
    expect(result?.topics).toContain("로그인");
  });
});
