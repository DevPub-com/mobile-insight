"use client";
import { useMemo } from "react";
import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "./echart";
import type { AudiencePoint } from "@/services/mobile/tabs/active-audience.service";

export function ActiveAudienceChart({ data }: { data: AudiencePoint[] }) {
  const option = useMemo<EChartsCoreOption>(() => ({
    aria: { enabled: true },
    grid: { top: 76, right: 22, bottom: 38, left: 62 },
    legend: { top: 12, left: 12, textStyle: { fontSize: 10 } },
    tooltip: { trigger: "axis", valueFormatter: (value: unknown) => value == null ? "—" : `${Number(value).toLocaleString("ko-KR")}명` },
    xAxis: { type: "category", boundaryGap: false, data: data.map(row => row.date.slice(5).replace("-", ".")), axisLabel: { hideOverlap: true, interval: Math.max(0, Math.ceil(data.length / 8) - 1) } },
    yAxis: { type: "value", min: 0, axisLabel: { formatter: (value: number) => value >= 10000 ? `${Number((value / 10000).toFixed(1))}만` : value.toLocaleString("ko-KR") }, splitLine: { lineStyle: { type: "dashed", color: "#e8edf5" } } },
    series: ([
      ["MAU (28일)", "androidMau", "iosMau", "#4B5563", "solid"],
      ["DAU", "androidDau", "iosDau", "#F97316", "solid"],
    ] as const).map(([name, androidKey, iosKey, color, type]) => ({ name, type: "line", data: data.map(row => row[androidKey] === null || row[iosKey] === null ? null : row[androidKey] + row[iosKey]), connectNulls: false, smooth: false, symbol: "circle", symbolSize: 4, lineStyle: { color, type, width: 2 }, itemStyle: { color } })),
  }), [data]);
  return <EChart option={option} ariaLabel="통합 DAU 및 MAU 최근 28일 활성 사용자 추이" />;
}
