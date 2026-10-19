"use client";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";

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
      <DpCard
        as="section"
        variant="custom"
        className="mi-ai-briefing-card is-loading"
      >
        <DpLayout direction="row" className="mi-ai-briefing-header">
          <DpLayout
            display="inline-flex"
            direction="row"
            className="mi-ai-badge"
          >
            <KoboyoIcon name="sparkles" size={14} />
            <DpText as="span" wrap="inherit">
              AI Executive Briefing
            </DpText>
          </DpLayout>
          <DpText as="span" wrap="inherit" className="mi-ai-analyzing-text">
            데이터 종합 분석 중...
          </DpText>
        </DpLayout>
      </DpCard>
    );
  }

  if (!briefing) return null;

  return (
    <DpCard as="section" variant="custom" className="mi-ai-briefing-card">
      <DpLayout direction="row" className="mi-ai-briefing-header">
        <DpLayout display="inline-flex" direction="row" className="mi-ai-badge">
          <KoboyoIcon name="sparkles" size={14} />
          <DpText as="span" wrap="inherit">
            AI Executive Briefing
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
      <DpText as="h3" wrap="inherit" className="mi-ai-headline">
        {briefing.headline}
      </DpText>
      <DpText as="p" wrap="inherit" className="mi-ai-summary">
        {briefing.summary}
      </DpText>
      {briefing.highlights && briefing.highlights.length > 0 && (
        <DpLayout display="grid" className="mi-ai-highlights-grid">
          {briefing.highlights.map((item, index) => (
            <DpLayout
              direction="row"
              key={`${item.category}-${index}`}
              className={`mi-ai-highlight-item mi-ai-highlight--${item.category}`}
            >
              <DpText
                as="span"
                wrap="inherit"
                className="mi-ai-highlight-category"
              >
                {item.category === "growth" && "성장 신호"}
                {item.category === "risk" && "리스크"}
                {item.category === "voc" && "사용자 반응"}
                {item.category === "quality" && "품질 및 릴리스"}
              </DpText>
              <DpText
                as="strong"
                wrap="inherit"
                className="mi-ai-highlight-title"
              >
                {item.title}
              </DpText>
              <DpText
                as="p"
                wrap="inherit"
                className="mi-ai-highlight-description"
              >
                {item.description}
              </DpText>
            </DpLayout>
          ))}
        </DpLayout>
      )}
    </DpCard>
  );
}
