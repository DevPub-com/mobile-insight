import type {
  DashboardData,
  DashboardExecutiveAiBriefing,
} from "@/domain/types";
import { generateStructuredContent } from "./gemini-client";

type GeminiDashboardSummaryResponse = {
  headline: string;
  summary: string;
  highlights: Array<{
    category: "growth" | "risk" | "voc" | "quality";
    title: string;
    description: string;
  }>;
};

function fallbackDashboardSummary(
  data: DashboardData,
  downloadsTotal: number | null,
  downloadChangePercent: number | null,
  periodLabel: string,
): DashboardExecutiveAiBriefing {
  const highlights: DashboardExecutiveAiBriefing["highlights"] = [];

  if (downloadsTotal !== null) {
    const changeDescription =
      downloadChangePercent !== null
        ? `${downloadChangePercent >= 0 ? `+${downloadChangePercent.toFixed(1)}% 증가` : `${downloadChangePercent.toFixed(1)}% 감소`}`
        : "비교 데이터 수집 중";

    highlights.push({
      category: "growth",
      title: `${periodLabel} 다운로드 추이`,
      description: `총 ${downloadsTotal.toLocaleString("ko-KR")}건의 다운로드를 기록하며 전 기간 대비 ${changeDescription}했습니다.`,
    });
  }

  const negativeCount = data.reviews.filter((item) => item.rating <= 2).length;
  highlights.push({
    category: "voc",
    title: "사용자 피드백 신호",
    description: `수집된 최근 리뷰 중 부정 리뷰는 ${negativeCount}건이며, 주요 키워드 모니터링을 진행하고 있습니다.`,
  });

  const activeReleases = data.releases.slice(0, 2);
  if (activeReleases.length > 0) {
    highlights.push({
      category: "quality",
      title: "최신 릴리즈 상태",
      description: `최근 배포된 버전(${activeReleases.map((item) => item.version).join(", ")})의 안정성 및 피드백을 실시간 추적 중입니다.`,
    });
  }

  return {
    headline: `${data.app.name} 모바일 프로덕트 현황 브리핑`,
    summary: `최근 ${periodLabel} 동안의 스토어 및 사용자 반응 데이터를 종합 분석한 결과, 안정적인 서비스 운영과 피드백 추적이 유지되고 있습니다.`,
    highlights,
    analyzedAt: new Date().toISOString(),
  };
}

export async function generateDashboardSummaryBriefing(
  data: DashboardData,
  downloadsTotal: number | null,
  downloadChangePercent: number | null,
  periodLabel: string,
): Promise<DashboardExecutiveAiBriefing> {
  const systemInstruction = `너는 B2B SaaS 모바일 인텔리전스 최고 분석관이다.
앱의 통합 다운로드 지표, 평점, 최근 부정 리뷰 목록, 릴리즈 상태를 종합 분석하여 경영진을 위한 '일일 핵심 브리핑'을 작성하라.

출력 규칙:
1. headline: 전체 비즈니스/운영 상태를 직관적으로 꿰뚫는 핵심 1문장
2. summary: 현재 앱의 퍼포먼스와 주요 변화를 요약한 2~3문장
3. highlights: 3~4개의 핵심 포인트 리스트
   - category는 "growth" | "risk" | "voc" | "quality" 중 하나
   - title: 포인트 제목
   - description: 구체적인 데이터 기반 설명
4. 반드시 JSON 포맷 { "headline": "...", "summary": "...", "highlights": [ { "category": "...", "title": "...", "description": "..." } ] } 형태로 반환하라.`;

  const promptPayload = {
    appName: data.app.name,
    period: periodLabel,
    totalDownloads: downloadsTotal,
    downloadChangePercent,
    recentReviewsSample: data.reviews.slice(0, 15).map((review) => ({
      rating: review.rating,
      content: review.content,
      platform: review.platform,
      topics: review.aiTopicPaths ?? review.aiTopics,
    })),
    recentReleases: data.releases.slice(0, 3).map((release) => ({
      version: release.version,
      platform: release.platform,
      releasedAt: release.releasedAt,
    })),
  };

  const prompt = `다음 모바일 앱 대시보드 데이터를 분석하고 경영진 브리핑을 작성하라:\n${JSON.stringify(promptPayload, null, 2)}`;

  const geminiResponse =
    await generateStructuredContent<GeminiDashboardSummaryResponse>(
      prompt,
      systemInstruction,
      { temperature: 0.2, maxOutputTokens: 1500, timeoutMilliseconds: 15000 },
    );

  if (
    geminiResponse?.headline &&
    geminiResponse.summary &&
    Array.isArray(geminiResponse.highlights)
  ) {
    return {
      headline: geminiResponse.headline,
      summary: geminiResponse.summary,
      highlights: geminiResponse.highlights,
      analyzedAt: new Date().toISOString(),
    };
  }

  return fallbackDashboardSummary(
    data,
    downloadsTotal,
    downloadChangePercent,
    periodLabel,
  );
}
