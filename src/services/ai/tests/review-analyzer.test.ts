import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppReview } from "@/domain/types";
import { analyzeReviewsBatch } from "../review-analyzer.service";

function review(externalId: string, content: string, overrides: Partial<AppReview> = {}): AppReview {
  return {
    id: `review-${externalId}`, appId: "app-1", platform: "android", externalId,
    rating: 2, title: null, content, author: null, version: "2.4.0",
    reviewedAt: "2026-09-01T00:00:00Z", ...overrides,
  };
}

function geminiResponse(results: unknown) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ results }) }] } }] }),
  } as Response;
}

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

  it("handles an empty review list", async () => {
    expect((await analyzeReviewsBatch([])).size).toBe(0);
  });

  it("uses the model for short positive reviews and keeps the hierarchy", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(geminiResponse([{
      externalId: "short", sentiment: "positive",
      topicPaths: [{ major: "기타", middle: "일반", minor: "일반 의견" }],
      summary: "전반적인 만족",
    }]));

    const result = (await analyzeReviewsBatch([review("short", "굿", { rating: 5 })])).get("short");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      topics: ["일반 의견"],
      topicPaths: [{ major: "기타", middle: "일반", minor: "일반 의견" }],
      taxonomyVersion: 2,
    });
  });

  it("accepts valid semantic hierarchy from the model without lexical override", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(geminiResponse([{
      externalId: "semantic", sentiment: "negative",
      topicPaths: [
        { major: "시세·차트", middle: "해외 상품", minor: "실시간 시세" },
        { major: "기능 요청", middle: "데이터 제공", minor: null },
      ],
      summary: "해외 시세 조회 및 데이터 제공 요청",
    }]));

    const result = (await analyzeReviewsBatch([
      review("semantic", "해외 상품 정보가 보이지 않고 추가 제공이 필요해요"),
    ])).get("semantic");

    expect(result).toEqual({
      externalId: "semantic", sentiment: "negative",
      topics: ["실시간 시세", "데이터 제공"],
      topicPaths: [
        { major: "시세·차트", middle: "해외 상품", minor: "실시간 시세" },
        { major: "기능 요청", middle: "데이터 제공", minor: null },
      ],
      taxonomyVersion: 2,
      summary: "해외 시세 조회 및 데이터 제공 요청",
    });
  });

  it("cleans model topic labels before returning UI chips", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(geminiResponse([{
      externalId: "clean", sentiment: "negative",
      topicPaths: [{ major: "기타", middle: "  # 위젯  ", minor: " # 설정 " }],
      summary: "위젯 설정 문제",
    }]));

    expect((await analyzeReviewsBatch([review("clean", "위젯 설정이 되지 않아요")]))
      .get("clean")?.topicPaths).toEqual([
      { major: "기타", middle: "위젯", minor: "설정" },
    ]);
  });

  it("does not put word-to-category examples in the system instruction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse([{
      externalId: "prompt", sentiment: "neutral",
      topicPaths: [{ major: "기타", middle: null, minor: null }], summary: "분류 불가",
    }]));
    globalThis.fetch = fetchMock;

    await analyzeReviewsBatch([review("prompt", "분류할 리뷰")]);

    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const systemInstruction = request.systemInstruction.parts[0].text as string;
    expect(systemInstruction).not.toContain("야선");
    expect(systemInstruction).not.toMatch(/\S+\s*(?:은|는|을|를)\s*["']?시세·차트/);
  });

  it("rejects malformed hierarchy and returns a retryable fallback", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(geminiResponse([{
      externalId: "malformed", sentiment: "angry",
      topicPaths: [{ major: "모델이 만든 대분류", middle: 3, minor: "임의" }], summary: 123,
    }]));

    const result = (await analyzeReviewsBatch([
      review("malformed", "무엇인지 알 수 없는 문제입니다", { rating: 1 }),
    ])).get("malformed");

    expect(result).toEqual({
      externalId: "malformed", sentiment: "negative", topics: ["기타"],
      topicPaths: null,
      taxonomyVersion: null, summary: "무엇인지 알 수 없는 문제입니다",
    });
  });

  it("falls back without guessing a topic when Gemini is unavailable", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = (await analyzeReviewsBatch([
      review("fallback", "로그인이 안 되고 앱이 계속 멈춥니다", { rating: 1 }),
    ])).get("fallback");

    expect(result).toMatchObject({
      sentiment: "negative", topics: ["기타"],
      topicPaths: null, taxonomyVersion: null,
    });
  });

  it("ignores unknown review ids", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(geminiResponse([
      {
        externalId: "forged", sentiment: "negative",
        topicPaths: [{ major: "로그인·인증", middle: "인증", minor: null }], summary: "무관",
      },
      {
        externalId: "known", sentiment: "neutral",
        topicPaths: [{ major: "기타", middle: null, minor: null }], summary: "보통",
      },
    ]));

    const result = await analyzeReviewsBatch([review("known", "전반적으로 보통입니다")]);
    expect(result.has("forged")).toBe(false);
    expect(result.get("known")?.taxonomyVersion).toBe(2);
  });

  it("analyzes model input in chunks of at most fifteen reviews", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(Array.from({ length: 15 }, (_, index) => ({
        externalId: `chunk-${index}`, sentiment: "neutral",
        topicPaths: [{ major: "기타", middle: null, minor: null }], summary: "보통",
      }))))
      .mockResolvedValueOnce(geminiResponse([{
        externalId: "chunk-15", sentiment: "neutral",
        topicPaths: [{ major: "기타", middle: null, minor: null }], summary: "보통",
      }]));
    globalThis.fetch = fetchMock;

    const result = await analyzeReviewsBatch(
      Array.from({ length: 16 }, (_, index) => review(`chunk-${index}`, `리뷰 내용 ${index}`)),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(16);
  });
});
