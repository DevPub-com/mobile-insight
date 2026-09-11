"use client";

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

  useEffect(() => {
    let isCancelled = false;
    async function loadBriefing() {
      setIsLoading(true);
      setBriefing(null);
      try {
        const response = await fetch("/api/ai/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appCode,
            type: "release_impact",
            releaseId,
            refresh: false,
          }),
        });
        if (response.ok && !isCancelled) {
          const json = await response.json();
          if (json.data) {
            setBriefing(json.data as ReleaseImpactAiBriefing);
          }
        }
      } catch {
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    loadBriefing();
    return () => {
      isCancelled = true;
    };
  }, [appCode, releaseId]);

  async function handleRefresh() {
    setIsRefreshing(true);
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
      if (response.ok) {
        const json = await response.json();
        if (json.data) {
          setBriefing(json.data as ReleaseImpactAiBriefing);
        }
      }
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mi-ai-briefing-card is-loading">
        <div className="mi-ai-briefing-header">
          <div className="mi-ai-badge">
            <KoboyoIcon name="sparkles" size={14} />
            <span>AI Release Impact Briefing</span>
          </div>
          <span className="mi-ai-analyzing-text">배포 전후 영향도 분석 중...</span>
        </div>
      </section>
    );
  }

  if (!briefing) return <section className="mi-ai-briefing-card">AI 분석 결과가 없습니다. 실제 비교 데이터와 AI 연결 상태를 확인해 주세요.</section>;

  return (
    <section className="mi-ai-briefing-card mi-ai-release-card">
      <div className="mi-ai-briefing-header">
        <div className="mi-ai-badge-group">
          <div className="mi-ai-badge">
            <KoboyoIcon name="sparkles" size={14} />
            <span>AI 배포 영향도 진단</span>
          </div>
          <span
            className={`mi-ai-risk-badge mi-ai-risk--${briefing.riskLevel}`}
          >
            {briefing.riskLevel === "low" && "안정 (Low Risk)"}
            {briefing.riskLevel === "medium" && "주의 (Medium Risk)"}
            {briefing.riskLevel === "high" && "경고 (High Risk)"}
            {briefing.riskLevel === "critical" && "위험 (Critical Risk)"}
          </span>
        </div>
        <div className="mi-ai-actions">
          <button
            type="button"
            className="mi-ai-refresh-button"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <KoboyoIcon name="clock" size={12} />
            <span>{isRefreshing ? "분석 중..." : "AI 새로고침"}</span>
          </button>
        </div>
      </div>
      <h3 className="mi-ai-headline">{briefing.headline}</h3>
      <p className="mi-ai-summary">{briefing.summary}</p>
      <div className="mi-ai-release-columns">
        {briefing.keyChanges && briefing.keyChanges.length > 0 && (
          <div className="mi-ai-release-column">
            <strong className="mi-ai-column-title">주요 지표 및 VoC 변동</strong>
            <ul className="mi-ai-bullet-list">
              {briefing.keyChanges.map((change, index) => (
                <li key={`change-${index}`}>{change}</li>
              ))}
            </ul>
          </div>
        )}
        {briefing.recommendations && briefing.recommendations.length > 0 && (
          <div className="mi-ai-release-column">
            <strong className="mi-ai-column-title">권장 대응 액션</strong>
            <ul className="mi-ai-bullet-list is-recommendation">
              {briefing.recommendations.map((action, index) => (
                <li key={`action-${index}`}>{action}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
