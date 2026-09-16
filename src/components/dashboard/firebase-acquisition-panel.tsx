"use client";

import { useMemo } from "react";
import type { DashboardData } from "@/domain/types";
import type { MetricDateRange } from "@/services/mobile/common/metrics-calculator";
import { buildFirstOpenTrend } from "@/services/mobile/tabs/downloads.service";
import { DownloadChart } from "./download-chart";
import { EChart } from "./echart";
import { DpCard } from "@/components/ui/dp/DpCard";

const count = (value: number | null) => value === null ? "수집 데이터 없음" : value.toLocaleString("ko-KR");
const sum = (values: (number | null)[]) => {
  const collected = values.filter((value): value is number => value !== null);
  return collected.length ? collected.reduce((total, value) => total + value, 0) : null;
};

export function FirebaseAcquisitionPanel({ data, range }: { data: DashboardData; range: MetricDateRange }) {
  const firstOpens = useMemo(() => buildFirstOpenTrend(data.metricObservations ?? [], data.app.id, range), [data, range]);
  const removals = useMemo(() => buildFirstOpenTrend(data.metricObservations ?? [], data.app.id, range, "app_remove"), [data, range]);
  const removalOption = useMemo(() => ({
    tooltip: { trigger: "axis", confine: true },
    grid: { left: 48, right: 20, top: 30, bottom: 35 },
    xAxis: { type: "category", data: removals.map(row => row.date.slice(5).replace("-", ".")), axisLabel: { color: "#7c879b" } },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: "#e4eaf5", type: "dashed" } } },
    series: [{ type: "bar", name: "Android 삭제", data: removals.map(row => row.android), barMaxWidth: 24, itemStyle: { color: "#ef4444", borderRadius: [3, 3, 0, 0] } }],
  }), [removals]);
  const summaries = [
    { label: "Android 최초 실행", values: firstOpens.map(row => row.android), latest: firstOpens.filter(row => row.android !== null).at(-1)?.date },
    { label: "iOS 최초 실행", values: firstOpens.map(row => row.ios), latest: firstOpens.filter(row => row.ios !== null).at(-1)?.date },
    { label: "Android 삭제", values: removals.map(row => row.android), latest: removals.filter(row => row.android !== null).at(-1)?.date },
  ];
  return <>
    <section className="mi-download-summary mi-firebase-acquisition-summary">
      {summaries.map(item => <DpCard as="article" key={item.label}>
        <span>{item.label}</span><strong>{count(sum(item.values))}</strong>
        <small>Firebase · {item.latest ? `${item.latest}까지 · ${item.values.filter(value => value !== null).length}일 수집` : "미수집"}</small>
      </DpCard>)}
    </section>
    <section className="mi-download-charts">
      <DpCard className="mi-panel mi-chart-card mi-chart-card--large">
        <div className="mi-panel-head"><h3>플랫폼별 최초 실행 추이</h3><p>설치·재설치 후 첫 실행 횟수 · 스토어 다운로드와 다릅니다.</p></div>
        {firstOpens.some(row => row.total !== null) ? <DownloadChart data={firstOpens} releases={data.releases} versionMappings={data.releaseVersionMappings} metric="first_open" /> : <p className="mi-empty">수집 데이터 없음</p>}
      </DpCard>
      <DpCard className="mi-panel mi-chart-card mi-chart-card--large">
        <div className="mi-panel-head"><h3>Android 삭제 추이</h3><p>Firebase app_remove · iOS 삭제는 제공되지 않습니다.</p></div>
        {removals.some(row => row.android !== null) ? <EChart option={removalOption} ariaLabel="Android 일별 앱 삭제 건수" /> : <p className="mi-empty">수집 데이터 없음</p>}
      </DpCard>
    </section>
    <DpCard className="mi-panel mi-daily-table">
      <div className="mi-panel-head"><h3>플랫폼별 일별 상세</h3><p>Firebase Analytics · 최초 실행 및 Android 삭제</p></div>
      <div className="mi-acquisition-table-scroll"><table className="mi-acquisition-table">
        <thead><tr><th>날짜</th><th>Android 최초 실행</th><th>iOS 최초 실행</th><th>Android 삭제</th><th>iOS 삭제</th></tr></thead>
        <tbody>{[...firstOpens].reverse().map(row => <tr key={row.date}>
          <td>{row.date}</td><td>{count(row.android)}</td><td>{count(row.ios)}</td>
          <td>{count(removals.find(item => item.date === row.date)?.android ?? null)}</td><td>미지원</td>
        </tr>)}</tbody>
      </table></div>
    </DpCard>
  </>;
}
