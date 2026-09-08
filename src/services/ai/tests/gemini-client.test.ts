import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateStructuredContent } from "../gemini-client";

describe("Gemini REST API client", () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns null when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await generateStructuredContent<{ test: string }>("test prompt");
    expect(result).toBeNull();
  });

  it("parses structured json response on successful api call", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ analysis: "success", score: 98 }) }],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await generateStructuredContent<{ analysis: string; score: number }>(
      "test prompt",
    );
    expect(result).toEqual({ analysis: "success", score: 98 });
  });

  it("handles api error response gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as Response);

    const result = await generateStructuredContent<{ test: string }>("test prompt");
    expect(result).toBeNull();
  });
});
