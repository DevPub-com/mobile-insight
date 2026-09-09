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

const candidateModels: readonly string[] = [
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-flash-latest",
];

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

  const timeoutMs = options.timeoutMilliseconds ?? 15000;

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

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        logger.warn("gemini_model_request_failed", {
          model,
          status: response.status,
          error: errorText,
        });
        continue;
      }

      const json = (await response.json()) as GeminiApiResponse;
      if (json.error) {
        logger.warn("gemini_model_response_error", {
          model,
          code: json.error.code,
          message: json.error.message,
        });
        continue;
      }

      const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        logger.warn("gemini_empty_response", {
          model,
          candidateCount: json.candidates?.length ?? 0,
        });
        continue;
      }

      try {
        const parsed = JSON.parse(candidateText) as T;
        return parsed;
      } catch (parseError) {
        logger.error("gemini_json_parse_failed", {
          model,
          raw: candidateText,
          error: parseError instanceof Error ? parseError.message : "Unknown",
        });
        continue;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logger.warn("gemini_model_request_timeout", {
          model,
          timeoutMilliseconds: timeoutMs,
        });
        continue;
      }
      logger.warn("gemini_model_request_exception", {
        model,
        error: error instanceof Error ? error.message : "Unknown",
      });
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  logger.error("gemini_all_models_failed", {
    triedModels: candidateModels.join(", "),
  });
  return null;
}
