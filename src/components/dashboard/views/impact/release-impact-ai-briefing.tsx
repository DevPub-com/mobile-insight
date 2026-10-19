"use client";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";

import { useEffect, useState } from "react";
import type { ReleaseImpactAiBriefing } from "@/domain/types";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";

export function ReleaseImpactAiBriefingCard({
  appCode,
  releaseId,
  initialBriefing,
}: {
  appCode: string;
  releaseId: string;
  initialBriefing?: ReleaseImpactAiBriefing | null;
}) {
  const [briefing, setBriefing] = useState<ReleaseImpactAiBriefing | null>(
    initialBriefing ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialBriefing);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadBriefing() {
      setIsLoading(true);
      setBriefing(null);
      setRefreshError(false);
      const request = async (cacheOnly: boolean) => {
        const response = await fetch("/api/ai/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            appCode,
            type: "release_impact",
            releaseId,
            cacheOnly,
          }),
        });
        if (!response.ok) throw new Error("Briefing request failed");
        return (await response.json()).data as ReleaseImpactAiBriefing | null;
      };
      try {
        try {
          const cached = await request(true);
          if (!controller.signal.aborted && cached) {
            setBriefing(cached);
            setIsLoading(false);
          }
        } catch {
          // A cache read failure must not prevent a fresh analysis.
        }
        if (controller.signal.aborted) return;
        setIsRefreshing(true);
        const fresh = await request(false);
        if (!controller.signal.aborted) {
          if (fresh) setBriefing(fresh);
          else setRefreshError(true);
        }
      } catch {
        if (!controller.signal.aborted) setRefreshError(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }
    loadBriefing();
    return () => controller.abort();
  }, [appCode, releaseId]);

  async function handleRefresh() {
    setIsRefreshing(true);
    setRefreshError(false);
    try {
      const response = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appCode,
          type: "release_impact",
          releaseId,
          refresh: true,
        }),
      });
      if (!response.ok) throw new Error("Briefing request failed");
      if (response.ok) {
        const json = await response.json();
        if (json.data) {
          setBriefing(json.data as ReleaseImpactAiBriefing);
        } else setRefreshError(true);
      }
    } catch {
      setRefreshError(true);
    } finally {
      setIsRefreshing(false);
    }
  }

  if (!briefing && (isLoading || isRefreshing)) {
    return (
      <DpCard
        as="section"
        variant="custom"
        className="mi-ai-briefing-card mi-ai-release-card is-loading"
        aria-busy="true"
        aria-label="AI 배포 영향도 진단 로딩 중"
      >
        <DpLayout direction="row" className="mi-ai-briefing-header">
          <DpLayout
            display="inline-flex"
            direction="row"
            className="mi-ai-badge"
          >
            <KoboyoIcon name="sparkles" size={14} />
            <DpText as="span" wrap="inherit">
              AI 배포 영향도 진단
            </DpText>
          </DpLayout>
          <DpText
            as="span"
            wrap="inherit"
            className="mi-ai-analyzing-text"
            role="status"
          >
            {isRefreshing
              ? "분석을 새로 불러오는 중…"
              : "배포 전후 영향도 분석 중…"}
          </DpText>
        </DpLayout>
        <DpLayout display="grid" className="ri-ai-skeleton" aria-hidden="true">
          <div className="ri-skeleton-line is-heading" />
          <div className="ri-skeleton-line" />
          <div className="ri-skeleton-line is-short" />
          <DpLayout display="grid" className="mi-ai-release-columns">
            {[0, 1].map((column) => (
              <DpLayout
                direction="row"
                className="mi-ai-release-column"
                key={column}
              >
                <div className="ri-skeleton-line is-label" />
                {[0, 1, 2].map((line) => (
                  <div className="ri-skeleton-line" key={line} />
                ))}
              </DpLayout>
            ))}
          </DpLayout>
        </DpLayout>
      </DpCard>
    );
  }

  if (!briefing)
    return (
      <DpCard
        as="section"
        variant="custom"
        className="mi-ai-briefing-card mi-ai-release-card"
      >
        <DpLayout direction="row" className="mi-ai-briefing-header">
          <DpText as="strong" wrap="inherit">
            AI 배포 영향도 진단
          </DpText>
          <DpButton
            variant="custom"
            type="button"
            className="mi-ai-refresh-button"
            onClick={handleRefresh}
          >
            다시 시도
          </DpButton>
        </DpLayout>
        <DpText as="p" wrap="inherit" role="status">
          분석 결과를 불러오지 못했거나 비교할 데이터가 부족합니다.
        </DpText>
      </DpCard>
    );

  return (
    <DpCard
      as="section"
      variant="custom"
      className="mi-ai-briefing-card mi-ai-release-card"
    >
      <DpLayout direction="row" className="mi-ai-briefing-header">
        <DpLayout direction="row" className="mi-ai-badge-group">
          <DpLayout
            display="inline-flex"
            direction="row"
            className="mi-ai-badge"
          >
            <KoboyoIcon name="sparkles" size={14} />
            <DpText as="span" wrap="inherit">
              AI 배포 영향도 진단
            </DpText>
          </DpLayout>
          <DpText
            as="span"
            wrap="inherit"
            className={`mi-ai-risk-badge mi-ai-risk--${briefing.riskLevel}`}
          >
            {briefing.riskLevel === "low" && "안정 (Low Risk)"}
            {briefing.riskLevel === "medium" && "주의 (Medium Risk)"}
            {briefing.riskLevel === "high" && "경고 (High Risk)"}
            {briefing.riskLevel === "critical" && "위험 (Critical Risk)"}
          </DpText>
        </DpLayout>
        <DpLayout direction="row" className="mi-ai-actions">
          <DpButton
            variant="custom"
            type="button"
            className="mi-ai-refresh-button"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <KoboyoIcon name="clock" size={12} />
            <DpText as="span" wrap="inherit">
              {isRefreshing ? "분석 중..." : "AI 새로고침"}
            </DpText>
          </DpButton>
        </DpLayout>
      </DpLayout>
      {refreshError && (
        <DpText as="p" wrap="inherit" role="status">
          최신 분석을 불러오지 못했습니다. 기존 분석을 표시합니다.
        </DpText>
      )}
      <DpText as="h3" wrap="inherit" className="mi-ai-headline">
        {briefing.headline}
      </DpText>
      <DpText as="p" wrap="inherit" className="mi-ai-summary">
        {briefing.summary}
      </DpText>
      <DpLayout display="grid" className="mi-ai-release-columns">
        {briefing.keyChanges && briefing.keyChanges.length > 0 && (
          <DpLayout direction="row" className="mi-ai-release-column">
            <DpText as="strong" wrap="inherit" className="mi-ai-column-title">
              주요 지표 및 VoC 변동
            </DpText>
            <ul className="mi-ai-bullet-list">
              {briefing.keyChanges.map((change, index) => (
                <li key={`change-${index}`}>{change}</li>
              ))}
            </ul>
          </DpLayout>
        )}
        {briefing.recommendations && briefing.recommendations.length > 0 && (
          <DpLayout direction="row" className="mi-ai-release-column">
            <DpText as="strong" wrap="inherit" className="mi-ai-column-title">
              권장 대응 액션
            </DpText>
            <ul className="mi-ai-bullet-list is-recommendation">
              {briefing.recommendations.map((action, index) => (
                <li key={`action-${index}`}>{action}</li>
              ))}
            </ul>
          </DpLayout>
        )}
      </DpLayout>
    </DpCard>
  );
}
