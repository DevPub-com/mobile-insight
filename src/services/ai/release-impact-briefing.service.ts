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

function fallbackReleaseBriefing(
  view: ReleaseImpactWorkspaceView,
): ReleaseImpactAiBriefing {
  const version = view.release?.version ?? "최신 버전";
  const negativeChange = view.negativeReviews?.change ?? null;
  const ratingAndroid = view.ratings?.android?.change ?? null;
  const ratingIos = view.ratings?.ios?.change ?? null;

  let riskLevel: ReleaseImpactAiBriefing["riskLevel"] = "low";
  if (negativeChange !== null && negativeChange > 5) {
    riskLevel = "high";
  } else if (negativeChange !== null && negativeChange > 2) {
    riskLevel = "medium";
  }

  const keyChanges: string[] = [];
  if (ratingAndroid !== null) {
    keyChanges.push(
      `Android 평점 변동: ${ratingAndroid > 0 ? `+${ratingAndroid.toFixed(2)}` : ratingAndroid.toFixed(2)}점`,
    );
  }
  if (ratingIos !== null) {
    keyChanges.push(
      `iOS 평점 변동: ${ratingIos > 0 ? `+${ratingIos.toFixed(2)}` : ratingIos.toFixed(2)}점`,
    );
  }
  if (negativeChange !== null) {
    keyChanges.push(
      `부정 리뷰 비율: ${negativeChange > 0 ? `+${negativeChange.toFixed(1)}%p 증가` : `${negativeChange.toFixed(1)}%p 감소`}`,
    );
  }
  if (view.voc && view.voc.length > 0) {
    const topVoc = view.voc[0];
    keyChanges.push(`주요 언급 VoC 키워드: '${topVoc.label}' (배포 후 ${topVoc.after}건)`);
  }

  const recommendations: string[] = [
    "최근 배포 버전 관련 사용자 피드백 모니터링 지속",
    "상위 부정 리뷰 언급 키워드에 대한 재현 테스트 및 QA 확인",
  ];

  return {
    headline: `${version} 배포 영향도 진단 리포트`,
    summary: `${version} 릴리즈 배포 전후 데이터를 비교 분석한 결과 전반적인 안정성 지표와 사용자 반응을 모니터링 중입니다.`,
    riskLevel,
    keyChanges: keyChanges.length > 0 ? keyChanges : ["배포 전후 유의미한 지표 변동 감지 중"],
    recommendations,
    analyzedAt: new Date().toISOString(),
  };
}

export async function generateReleaseImpactBriefing(
  view: ReleaseImpactWorkspaceView,
): Promise<ReleaseImpactAiBriefing> {
  const systemInstruction = `너는 B2B 모바일 앱 프로덕트 분석가이자 모바일 엔지니어링 리드다.
제공된 앱 릴리즈 배포 전후(Before vs After) 지표와 사용자 리뷰(VoC) 데이터를 바탕으로 C-Level 및 개발팀을 위한 '릴리즈 임팩트 진단 리포트'를 작성하라.

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

  return fallbackReleaseBriefing(view);
}
