import type { ReleaseImpactAiBriefing } from "@/domain/types";
import type { ReleaseImpactWorkspaceView } from "../mobile/tabs/release-impact.service";
import { generateStructuredContent } from "./gemini-client";

type GeminiReleaseBriefingResponse = {
  headline: string;
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  keyChanges: string[];
  recommendations: string[];
};

export async function generateReleaseImpactBriefing(
  view: ReleaseImpactWorkspaceView,
): Promise<ReleaseImpactAiBriefing | null> {
  if (view.downloads.change === null && view.negativeReviews.change === null &&
      view.ratings[view.release.platform].change === null) return null;
  const systemInstruction = `너는 B2B 모바일 앱 프로덕트 분석가이자 모바일 엔지니어링 리드다.
제공된 앱 릴리즈 배포 전후(Before vs After) 지표와 사용자 리뷰(VoC) 데이터를 바탕으로 C-Level 및 개발팀을 위한 '릴리즈 임팩트 진단 리포트'를 작성하라.

기간 길이가 서로 다를 수 있으므로 합계 변화만으로 성과 개선을 단정하지 말라. 누락된 데이터로 안정성을 판단하지 말라.
출력 규칙:
1. headline: 배포 결과를 한눈에 파악할 수 있는 임팩트 있는 1문장 요약
2. summary: 배포 전후 주요 성과와 발생한 부작용/리스크를 2~3문장으로 간결하고 전문적으로 설명
3. riskLevel: "low", "medium", "high", "critical" 중 하나 (충돌/부정리뷰 급증 시 high/critical)
4. keyChanges: 주요 지표(다운로드, 평점, 안정성, VoC)의 구체적인 변동 내역 3~4개 항목
5. recommendations: 개발팀 및 운영팀이 즉시 실행해야 할 권장 조치 2~3개 항목
6. 반드시 JSON 포맷 { "headline": "...", "summary": "...", "riskLevel": "...", "keyChanges": [...], "recommendations": [...] } 형태로 반환하라.`;

  const inputPayload = {
    releaseVersion: view.release?.version,
    platform: view.release?.platform,
    releasedAt: view.release?.releasedAt,
    windows: view.windows,
    coverage: view.coverage,
    downloads: view.downloads,
    ratings: view.ratings,
    negativeReviews: view.negativeReviews,
    newReviews: view.newReviews,
    stability: view.stability,
    vocKeywords: view.voc,
    representativeReviews: (view.representativeReviews ?? []).map((review) => ({
      rating: review.rating,
      content: review.content,
      version: review.version,
    })),
  };

  const prompt = `다음 릴리즈 배포 전후 분석 데이터를 검토하고 진단 리포트를 작성하라:\n${JSON.stringify(inputPayload, null, 2)}`;

  const geminiResponse =
    await generateStructuredContent<GeminiReleaseBriefingResponse>(
      prompt,
      systemInstruction,
      { temperature: 0.2, maxOutputTokens: 1500, timeoutMilliseconds: 15000 },
    );

  if (
    geminiResponse?.headline &&
    geminiResponse.summary &&
    geminiResponse.riskLevel &&
    Array.isArray(geminiResponse.keyChanges)
  ) {
    return {
      headline: geminiResponse.headline,
      summary: geminiResponse.summary,
      riskLevel: geminiResponse.riskLevel,
      keyChanges: geminiResponse.keyChanges,
      recommendations: geminiResponse.recommendations || [],
      analyzedAt: new Date().toISOString(),
    };
  }

  return null;
}
