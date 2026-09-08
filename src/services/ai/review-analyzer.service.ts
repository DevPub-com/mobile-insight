import type { AppReview, ReviewSentiment } from "@/domain/types";
import { generateStructuredContent } from "./gemini-client";
import { VOC_GROUPS, contentMatchesTerms } from "../mobile/common/voc-keywords";

export type AnalyzedReviewResult = {
  externalId: string;
  sentiment: ReviewSentiment;
  topics: string[];
  summary: string;
};

type GeminiReviewBatchResponse = {
  results: Array<{
    externalId: string;
    sentiment: ReviewSentiment;
    topics: string[];
    summary: string;
  }>;
};

function fallbackAnalysisForReview(review: AppReview): AnalyzedReviewResult {
  const sentiment: ReviewSentiment =
    review.rating >= 4 ? "positive" : review.rating <= 2 ? "negative" : "neutral";

  const matchedTopics = VOC_GROUPS.filter((group) =>
    contentMatchesTerms(review.content, group.terms),
  ).map((group) => group.label);

  const fallbackTopics =
    matchedTopics.length > 0
      ? matchedTopics.slice(0, 3)
      : [sentiment === "negative" ? "기타_불만" : "일반_의견"];

  const sanitizedContent = review.content.replace(/\s+/g, " ").trim();
  const summary =
    sanitizedContent.length > 60
      ? `${sanitizedContent.slice(0, 57)}...`
      : sanitizedContent;

  return {
    externalId: review.externalId,
    sentiment,
    topics: fallbackTopics,
    summary,
  };
}

export async function analyzeReviewsBatch(
  reviews: AppReview[],
): Promise<Map<string, AnalyzedReviewResult>> {
  const resultMap = new Map<string, AnalyzedReviewResult>();
  if (reviews.length === 0) {
    return resultMap;
  }

  const reviewsToAnalyzeViaModel: AppReview[] = [];

  for (const review of reviews) {
    const trimmed = review.content.trim();
    if (trimmed.length < 6 && review.rating >= 4) {
      resultMap.set(review.externalId, {
        externalId: review.externalId,
        sentiment: "positive",
        topics: ["단순_호평"],
        summary: trimmed || "서비스 이용 만족",
      });
    } else {
      reviewsToAnalyzeViaModel.push(review);
    }
  }

  if (reviewsToAnalyzeViaModel.length === 0) {
    return resultMap;
  }

  const promptPayload = reviewsToAnalyzeViaModel.map((item) => ({
    externalId: item.externalId,
    platform: item.platform,
    rating: item.rating,
    version: item.version,
    content: item.content,
  }));

  const systemInstruction = `너는 모바일 앱 VOC(Voice of Customer) 전문 분석 AI다.
제공된 사용자 리뷰 목록을 분석하여 각 리뷰의 감성(sentiment), 핵심 토픽 태그 목록(topics), 그리고 한 줄 핵심 요약(summary)을 추출하라.

출력 규칙:
1. sentiment는 "positive", "neutral", "negative" 중 하나여야 한다. (평점 1~2점은 주로 negative, 4~5점은 주로 positive, 3점은 중립/개선요청)
2. topics는 한국어 1~3개의 핵심 단어/태그(예: "지문인증_오류", "로딩_지연", "다크모드_개선") 형태로 작성하라.
3. summary는 핵심 원인이나 요청 사항을 1문장(50자 내외)으로 명확히 요약하라.
4. 반드시 JSON 포맷으로 { "results": [ { "externalId": "...", "sentiment": "...", "topics": ["..."], "summary": "..." } ] } 형태를 엄수하라.`;

  const prompt = `다음 앱 리뷰들을 분석하여 JSON 결과를 반환하라:\n${JSON.stringify(promptPayload, null, 2)}`;

  const geminiResponse =
    await generateStructuredContent<GeminiReviewBatchResponse>(
      prompt,
      systemInstruction,
      { temperature: 0.1, maxOutputTokens: 3000, timeoutMilliseconds: 20000 },
    );

  if (geminiResponse?.results && Array.isArray(geminiResponse.results)) {
    for (const item of geminiResponse.results) {
      if (item.externalId && item.sentiment && Array.isArray(item.topics)) {
        resultMap.set(item.externalId, {
          externalId: item.externalId,
          sentiment: item.sentiment,
          topics: item.topics.map((topic) => topic.replace(/^#/, "").trim()),
          summary: item.summary || "",
        });
      }
    }
  }

  for (const review of reviewsToAnalyzeViaModel) {
    if (!resultMap.has(review.externalId)) {
      resultMap.set(review.externalId, fallbackAnalysisForReview(review));
    }
  }

  return resultMap;
}
