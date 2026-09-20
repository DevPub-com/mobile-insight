"use client";
import { useEffect, useMemo, useState } from "react";
import type { DashboardData } from "@/domain/types";
import { buildDashboardView, type DashboardView } from "@/services/mobile/dashboard-view";
import type { MetricDateRange } from "@/services/mobile/common/metrics-calculator";

export function useDashboardView(data: DashboardData, range: MetricDateRange, initialView?: DashboardView) {
  const revision = data.syncRuns.map(run => run.finishedAt ?? "").sort().at(-1) ?? "";
  const key = `${data.app.code}:${revision}:${range.startDate}:${range.endDate}`;
  const initialMatches = initialView?.range.startDate === range.startDate && initialView.range.endDate === range.endDate;
  const [result, setResult] = useState<{ key: string; view?: DashboardView; error?: string } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!initialView || initialMatches) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ from: range.startDate, to: range.endDate });
    fetch(`/api/dashboard/${encodeURIComponent(data.app.code)}/view?${query}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error("요약을 불러오지 못했습니다.");
        const body = await response.json() as { data: DashboardView };
        if (!controller.signal.aborted) setResult({ key, view: body.data });
      }).catch(() => { if (!controller.signal.aborted) setResult({ key, error: "요약을 불러오지 못했습니다." }); });
    return () => controller.abort();
  }, [data.app.code, range.startDate, range.endDate, initialView, initialMatches, key, retry]);
  const localView = useMemo(() => initialView ? null : buildDashboardView(data, range), [data, range, initialView]);
  const current = result?.key === key ? result : null;
  return {
    view: localView ?? (initialMatches ? initialView! : current?.view ?? initialView!),
    loading: !!initialView && !initialMatches && !current,
    error: !initialMatches ? current?.error : undefined,
    retry: () => { setResult(null); setRetry(value => value + 1); },
  };
}
