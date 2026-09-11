"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";

type Point = { offset: number; date: string; downloads: number | null };

export function ReleaseImpactTrendChart({ data }: { data: Point[] }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const before = data.map((point) =>
      point.offset < 0 ? point.downloads : null,
    );
    const after = data.map((point) =>
      point.offset >= 0 ? point.downloads : null,
    );

    return {
      animationDuration: 450,
      aria: { enabled: true },
      grid: { top: 54, right: 22, bottom: 36, left: 48 },
      legend: {
        top: 10,
        left: 8,
        itemWidth: 16,
        itemHeight: 3,
        textStyle: { color: "#718096", fontSize: 10 },
      },
      tooltip: {
        trigger: "axis",
        borderColor: "#dfe5ef",
        backgroundColor: "rgba(255,255,255,.98)",
        textStyle: { color: "#172033", fontSize: 11 },
        valueFormatter: (value: unknown) =>
          value == null
            ? "데이터 없음"
            : `${new Intl.NumberFormat("ko-KR").format(Number(value))}건`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((point) =>
          point.offset > 0 ? `+${point.offset}` : String(point.offset),
        ),
        axisLine: { lineStyle: { color: "#dce3ed" } },
        axisTick: { show: false },
        axisLabel: { color: "#758196", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 4,
        axisLabel: {
          color: "#758196",
          fontSize: 10,
          formatter: (value: number) =>
            value === 0 ? "0" : `${Math.round(value / 1000)}K`,
        },
        splitLine: { lineStyle: { color: "#e9edf4", type: "dashed" } },
      },
      series: [
        {
          name: "배포 전",
          type: "line",
          data: before,
          connectNulls: false,
          smooth: 0.22,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#8993A7", width: 2 },
          itemStyle: { color: "white", borderColor: "#8993A7", borderWidth: 2 },
        },
        {
          name: "배포 후",
          type: "line",
          data: after,
          connectNulls: false,
          smooth: 0.22,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: { color: "#4C73EC", width: 2.5 },
          itemStyle: { color: "white", borderColor: "#4C73EC", borderWidth: 2 },
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: "#8f9bb0", type: "dashed", width: 1 },
            label: {
              show: true,
              formatter: "배포일",
              color: "#fff",
              backgroundColor: "#26334d",
              borderRadius: 4,
              padding: [4, 6],
              fontSize: 9,
            },
            data: [{ xAxis: "0" }],
          },
        },
      ],
    };
  }, [data]);

  return (
    <EChart
      option={option}
      className="ri-trend-chart"
      ariaLabel="릴리즈 배포 기간별 다운로드 추이"
    />
  );
}
