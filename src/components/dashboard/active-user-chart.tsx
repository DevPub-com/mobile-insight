"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";

type ChartRow = {
  date: string;
  android: number | null;
  ios: number | null;
  total: number | null;
};
const formatNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(value);

export function ActiveUserChart({ data }: { data: ChartRow[] }) {
  const option = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 350,
      aria: { enabled: true },
      color: ["#8993A7", "#22A447", "#8B5CF6"],
      grid: { top: 62, right: 22, bottom: 38, left: 58 },
      legend: {
        top: 12,
        left: 12,
        icon: "roundRect",
        itemWidth: 12,
        itemHeight: 3,
        textStyle: { color: "#566277", fontSize: 10 },
      },
      tooltip: {
        trigger: "axis",
        borderColor: "#dfe4ec",
        backgroundColor: "rgba(255,255,255,.96)",
        valueFormatter: (value: unknown) =>
          value == null ? "데이터 없음" : formatNumber(Number(value)),
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((row) => row.date.slice(5).replace("-", ".")),
        axisLine: { lineStyle: { color: "#dfe5ed" } },
        axisTick: { show: false },
        axisLabel: { color: "#7b8798", fontSize: 10, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#7b8798", fontSize: 10 },
        splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      },
      series: (
        [
          ["Total", "total", "#8993A7", 2.4],
          ["Android", "android", "#22A447", 1.8],
          ["iOS", "ios", "#8B5CF6", 1.8],
        ] as const
      ).map(([name, key, color, width]) => ({
        name,
        type: "line",
        data: data.map((row) => row[key]),
        connectNulls: true,
        smooth: 0.2,
        showSymbol: false,
        lineStyle: { color, width },
      })),
    }),
    [data],
  );

  if (!data.length)
    return (
      <div className="chart-empty">
        선택한 기간의 GA4 활성 사용자 데이터가 없습니다.
      </div>
    );
  return (
    <EChart option={option} ariaLabel="Android 및 iOS 28일 활성 사용자 추이" />
  );
}
