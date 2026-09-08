import { getGeminiApiKey } from "@/lib/env";
import { logger } from "@/lib/logger";

export type GeminiGenerationOptions = {
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMilliseconds?: number;
};

type GeminiContentPart = {
  text: string;
};

type GeminiCandidate = {
  content?: {
    parts?: GeminiContentPart[];
  };
  finishReason?: string;
};

type GeminiApiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
};

export class GeminiServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.name = "GeminiServiceError";
    this.status = status;
  }
}

export async function generateStructuredContent<T>(
  prompt: string,
  systemInstruction?: string,
  options: GeminiGenerationOptions = {},
): Promise<T | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    logger.warn("gemini_api_key_missing", {
      reason: "GEMINI_API_KEY environment variable is not defined",
    });
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const timeoutMs = options.timeoutMilliseconds ?? 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
    },
    ...(systemInstruction
      ? {
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("gemini_api_request_failed", {
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const json = (await response.json()) as GeminiApiResponse;
    if (json.error) {
      logger.error("gemini_api_response_error", {
        code: json.error.code,
        message: json.error.message,
      });
      return null;
    }

    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      logger.warn("gemini_empty_response", {
        candidateCount: json.candidates?.length ?? 0,
      });
      return null;
    }

    try {
      const parsed = JSON.parse(candidateText) as T;
      return parsed;
    } catch (parseError) {
      logger.error("gemini_json_parse_failed", {
        raw: candidateText,
        error: parseError instanceof Error ? parseError.message : "Unknown",
      });
      return null;
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      logger.error("gemini_request_timeout", { timeoutMilliseconds: timeoutMs });
      return null;
    }
    logger.error("gemini_request_exception", {
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
