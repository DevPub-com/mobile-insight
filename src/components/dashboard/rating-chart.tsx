"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";
import { DpLayout } from "@/components/ui/dp/DpLayout";

type RatingPoint = { date: string; android: number | null; ios: number | null };

export function RatingChart({ data }: { data: RatingPoint[] }) {
  const option = useMemo<EChartsCoreOption>(
    () => ({
      animationDuration: 350,
      aria: { enabled: true },
      color: ["#16B84E", "#8B3DFF"],
      grid: { top: 62, right: 22, bottom: 38, left: 48 },
      legend: {
        top: 12,
        left: 12,
        itemWidth: 20,
        itemHeight: 6,
        itemGap: 20,
        textStyle: { color: "#465267", fontSize: 11 },
      },
      tooltip: {
        trigger: "axis",
        borderColor: "#dfe4ec",
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,.96)",
        textStyle: { color: "#1d2939", fontSize: 11 },
        valueFormatter: (value: unknown) =>
          value == null ? "데이터 없음" : Number(value).toFixed(2),
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
        min: 3,
        max: 5,
        interval: 0.5,
        axisLabel: {
          color: "#7b8798",
          fontSize: 10,
          formatter: (value: number) => value.toFixed(1),
        },
        splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      },
      series: (
        [
          ["Android", "android", "#16B84E"],
          ["iOS", "ios", "#8B3DFF"],
        ] as const
      ).map(([name, key, color]) => ({
        name,
        type: "line",
        smooth: 0.2,
        data: data.map((row) => row[key]),
        connectNulls: true,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color, width: 2.25 },
        itemStyle: { color, borderColor: color, borderWidth: 0 },
      })),
    }),
    [data],
  );

  if (!data.length)
    return (
      <DpLayout align="center" justify="center" className="chart-empty">
        선택한 기간의 평점 데이터가 없습니다.
      </DpLayout>
    );
  return <EChart option={option} ariaLabel="Android 및 iOS 평점 추이" />;
}
