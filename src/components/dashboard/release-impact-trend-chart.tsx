"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";

type Point = { offset: number; date: string; downloads: number | null; rating?: number | null; crashes?: number | null; anrs?: number | null; crashUsers?: number | null; anrUsers?: number | null };

export function ReleaseImpactTrendChart({ data, metric = "downloads", beforeLabel = "배포 전", afterLabel = "배포 후" }: { data: Point[]; metric?: "downloads" | "rating" | "crashes" | "anrs" | "crashUsers" | "anrUsers"; beforeLabel?: string; afterLabel?: string }) {
  const option = useMemo<EChartsCoreOption>(() => {
    const previousPoints = data.filter(point => point.offset < 0).sort((a, b) => a.offset - b.offset);
    const currentPoints = data.filter(point => point.offset >= 0).sort((a, b) => a.offset - b.offset);
    const previousStart = previousPoints[0]?.offset ?? 0;
    const previousByDay = new Map(previousPoints.map(point => [point.offset - previousStart, point[metric] ?? null]));
    const currentByDay = new Map(currentPoints.map(point => [point.offset, point[metric] ?? null]));
    const lastDay = Math.max(0, ...previousByDay.keys(), ...currentByDay.keys());
    const elapsedDays = Array.from({ length: lastDay + 1 }, (_, day) => day);
    const before = elapsedDays.map(day => previousByDay.get(day) ?? null);
    const after = elapsedDays.map(day => currentByDay.get(day) ?? null);

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
            : `${new Intl.NumberFormat("ko-KR").format(Number(value))}${metric === "rating" ? "점" : metric.endsWith("Users") ? "명" : "건"}`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: elapsedDays.map(day => day === 0 ? "0" : `+${day}`),
        axisLine: { lineStyle: { color: "#dce3ed" } },
        axisTick: { show: false },
        axisLabel: { color: "#758196", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        min: metric === "rating" ? 1 : 0,
        max: metric === "rating" ? 5 : undefined,
        minInterval: metric === "rating" ? 1 : undefined,
        splitNumber: 4,
        axisLabel: {
          color: "#758196",
          fontSize: 10,
          formatter: (value: number) =>
            new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value),
        },
        splitLine: { lineStyle: { color: "#e9edf4", type: "dashed" } },
      },
      series: [
        {
          name: beforeLabel,
          type: "line",
          data: before,
          connectNulls: false,
          smooth: false,
          symbol: "circle",
          symbolSize: 6,
          lineStyle: { color: "#8993A7", width: 2 },
          itemStyle: { color: "white", borderColor: "#8993A7", borderWidth: 2 },
        },
        {
          name: afterLabel,
          type: "line",
          data: after,
          connectNulls: false,
          smooth: false,
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
  }, [data, metric, beforeLabel, afterLabel]);

  return (
    <EChart
      option={option}
      className="ri-trend-chart"
      ariaLabel={metric === "rating" ? "버전별 평균 리뷰 평점 추이" : metric === "anrs" ? "버전별 ANR 보고 건수 추이" : metric === "crashUsers" ? "크래시 영향받은 사용자 추이" : metric === "anrUsers" ? "ANR 영향받은 사용자 추이" : metric === "crashes" ? "버전별 크래시 보고 건수 추이" : "릴리즈 배포 기간별 다운로드 추이"}
    />
  );
}
