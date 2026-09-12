"use client";

import { useMemo } from "react";
import { DownloadChart } from "./download-chart";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import type { DashboardData } from "@/domain/types";
import type { MetricDateRange } from "@/services/mobile/common/metrics-calculator";
import { buildFirstOpenTrend } from "@/services/mobile/tabs/downloads.service";

const count = (value: number | null) => value === null ? "—" : value.toLocaleString("ko-KR");

export function FirstOpenPanel({ data, range }: { data: DashboardData; range: MetricDateRange }) {
  const trend = useMemo(() => buildFirstOpenTrend(data.metricObservations ?? [], data.app.id, range), [data, range]);
  const observed = trend.filter((row) => row.total !== null);
  if (!observed.length) return null;
  const first = observed[0];
  const latest = observed.at(-1)!;
  const chartTrend = trend.filter((row) => row.date >= first.date && row.date <= latest.date);
  return (
    <DpCard className="mi-panel mi-daily-table mi-first-open-panel">
      <DpLayout className="mi-panel-head">
        <DpText as="h3">Firebase 최초 실행</DpText>
        <DpText>설치·재설치 후 첫 실행 횟수 · 다운로드와 별도 집계 · {first.date} ~ {latest.date}</DpText>
      </DpLayout>
      <div className="mi-chart-card mi-chart-card--large">
        <DownloadChart data={chartTrend} releases={data.releases} versionMappings={data.releaseVersionMappings} metric="first_open" />
      </div>
      <DpLayout className="mi-table-head">
        <DpText as="span">날짜</DpText>
        <DpText as="span">Android 최초 실행 (회)</DpText>
        <DpText as="span">iOS 최초 실행 (회)</DpText>
      </DpLayout>
      {[...observed].reverse().slice(0, 5).map((row) => (
        <DpLayout as="article" className="mi-table-row" key={row.date}>
          <DpText as="span">{row.date.replaceAll("-", ".")}</DpText>
          <DpText as="strong">{count(row.android)}</DpText>
          <DpText as="strong">{count(row.ios)}</DpText>
        </DpLayout>
      ))}
    </DpCard>
  );
}
