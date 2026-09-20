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
): Promise<ReleaseImpactAiBriefing> {
  const systemInstruction = `너는 B2B 모바일 앱 프로덕트 분석가이자 모바일 엔지니어링 리드다.
제공된 앱 릴리스 배포 전후(Before vs After) 지표와 사용자 리뷰(VoC) 데이터를 바탕으로 C-Level 및 개발팀을 위한 '릴리스 임팩트 진단 리포트'를 작성하라.

  기간 길이가 서로 다를 수 있으므로 합계 변화만으로 성과 개선을 단정하지 말라. 누락된 데이터로 안정성을 판단하지 말라. 비교값이 없더라도 반환을 생략하지 말고, 확보된 절대값과 표본 수를 설명한 뒤 누락된 항목은 '수집 중' 또는 '비교 불가'라고 명시하라. 다운로드 판단에는 수집이 완전한 일평균 변화를 사용하라. 크래시 보고 건수의 scope가 platform이면 전체 버전 합계이며 선택 버전의 결함으로 단정하지 말라. 리뷰 수는 표본 규모이며 증가 자체가 개선을 뜻하지 않는다.
부정 리뷰 수와 비율(%)을 구분하고 비율 차이는 %p로 표현하라. 영향받은 사용자 수를 날짜나 버전 간 합산하지 말라.
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
    downloadDailyAverage: view.downloadDailyAverage,
    countSource: "Firebase Crashlytics (FATAL/ANR), Asia/Seoul dates; affected users are distinct app installations. Missing days are unknown, not zero. Google Play rate metrics use a different population.",
    crashReports: view.crashReports,
    anrReports: view.anrReports,
    previousVersion: view.previousRelease?.version ?? null,
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

  const prompt = `다음 릴리스 배포 전후 분석 데이터를 검토하고 진단 리포트를 작성하라:\n${JSON.stringify(inputPayload, null, 2)}`;

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

  const platformLabel = view.release.platform === "android" ? "Android" : "iOS";
  const reviewAfter = view.newReviews.after ?? 0;
  const availableChanges = [
    view.downloads.change,
    view.negativeReviews.change,
    view.ratings[view.release.platform].change,
  ].filter((value) => value !== null).length;
  const rateLabel = (value: number | null) => value === null ? "비교 불가" : `${value.toFixed(1)}%`;
  const keyChanges = [
    `다운로드: 배포 전 ${view.downloads.before?.toLocaleString("ko-KR") ?? "수집 중"}건, 배포 후 ${view.downloads.after?.toLocaleString("ko-KR") ?? "수집 중"}`,
    `리뷰 표본: 배포 전 ${view.newReviews.before ?? 0}건, 배포 후 ${reviewAfter}건`,
    `부정 리뷰 비율: 배포 전 ${rateLabel(view.negativeReviews.before)}, 배포 후 ${rateLabel(view.negativeReviews.after)}`,
  ];
  return {
    headline: `${view.release.version} ${platformLabel} 배포 후 데이터 수집 상태를 확인하고 있습니다`,
    summary: availableChanges
      ? `확보된 ${availableChanges}개 비교 지표를 기준으로 모니터링이 필요합니다. 아직 수집되지 않은 값은 성과 저하로 해석하지 않았습니다.`
      : `배포 후 리뷰는 ${reviewAfter}건이며 다운로드·평점 비교 데이터가 아직 충분하지 않습니다. 현재 값은 장애가 아니라 수집 진행 상태로 해석해야 합니다.`,
    riskLevel: "medium",
    keyChanges,
    recommendations: [
      "배포 후 다운로드와 리뷰 데이터가 추가 수집된 뒤 다시 비교하세요.",
      "현재 표본만으로 성과나 안정성 악화를 단정하지 마세요.",
    ],
    analyzedAt: new Date().toISOString(),
  };
}
