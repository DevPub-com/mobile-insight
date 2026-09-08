"use client";

import { useEffect, useState } from "react";
import type { DashboardExecutiveAiBriefing } from "@/domain/types";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";

export function AiExecutiveBriefing({
  appCode,
  periodLabel,
  dateRange,
  initialBriefing,
}: {
  appCode: string;
  periodLabel: string;
  dateRange?: { startDate: string; endDate: string };
  initialBriefing?: DashboardExecutiveAiBriefing | null;
}) {
  const [briefing, setBriefing] = useState<DashboardExecutiveAiBriefing | null>(
    initialBriefing ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialBriefing);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    async function loadBriefing() {
      if (initialBriefing) return;
      setIsLoading(true);
      try {
        const cacheKey = `briefing_${appCode}_${dateRange?.startDate ?? periodLabel}_${dateRange?.endDate ?? ""}`;
        const response = await fetch("/api/ai/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appCode,
            type: "dashboard_executive",
            cacheKey,
            periodLabel,
            startDate: dateRange?.startDate,
            endDate: dateRange?.endDate,
            refresh: false,
          }),
        });
        if (response.ok && !isCancelled) {
          const json = (await response.json()) as {
            data?: DashboardExecutiveAiBriefing;
          };
          if (json.data) {
            setBriefing(json.data);
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
  }, [appCode, periodLabel, dateRange, initialBriefing]);

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      const cacheKey = `briefing_${appCode}_${dateRange?.startDate ?? periodLabel}_${dateRange?.endDate ?? ""}`;
      const response = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appCode,
          type: "dashboard_executive",
          cacheKey,
          periodLabel,
          startDate: dateRange?.startDate,
          endDate: dateRange?.endDate,
          refresh: true,
        }),
      });
      if (response.ok) {
        const json = (await response.json()) as {
          data?: DashboardExecutiveAiBriefing;
        };
        if (json.data) {
          setBriefing(json.data);
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
            <span>AI Executive Briefing</span>
          </div>
          <span className="mi-ai-analyzing-text">데이터 종합 분석 중...</span>
        </div>
      </section>
    );
  }

  if (!briefing) return null;

  return (
    <section className="mi-ai-briefing-card">
      <div className="mi-ai-briefing-header">
        <div className="mi-ai-badge">
          <KoboyoIcon name="sparkles" size={14} />
          <span>AI Executive Briefing</span>
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
      {briefing.highlights && briefing.highlights.length > 0 && (
        <div className="mi-ai-highlights-grid">
          {briefing.highlights.map((item, index) => (
            <div
              key={`${item.category}-${index}`}
              className={`mi-ai-highlight-item mi-ai-highlight--${item.category}`}
            >
              <span className="mi-ai-highlight-category">
                {item.category === "growth" && "성장 신호"}
                {item.category === "risk" && "리스크"}
                {item.category === "voc" && "사용자 반응"}
                {item.category === "quality" && "품질 및 릴리즈"}
              </span>
              <strong className="mi-ai-highlight-title">{item.title}</strong>
              <p className="mi-ai-highlight-description">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
