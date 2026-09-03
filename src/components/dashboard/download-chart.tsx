"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";
import type { AppRelease } from "@/domain/types";

type ChartRow = {
  date: string;
  android: number | null;
  ios: number | null;
  total: number | null;
};
const formatNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(value);
const formatAxisNumber = (value: number) => {
  if (value === 0) return "0";
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}만`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}천`;
  return formatNumber(value);
};

export function DownloadChart({
  data,
  releases,
}: {
  data: ChartRow[];
  releases: AppRelease[];
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const visibleDates = new Set(data.map((item) => item.date));
    const visibleReleases = releases
      .filter((release) => visibleDates.has(release.releasedAt.slice(0, 10)))
      .filter(
        (release, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.version === release.version &&
              candidate.releasedAt.slice(0, 10) ===
                release.releasedAt.slice(0, 10),
          ) === index,
      );
    const xAxisLabelInterval = Math.max(0, Math.ceil(data.length / 8) - 1);
    const series = (
      [
        ["전체", "total", "#8993A7"],
        ["Android", "android", "#16B84E"],
        ["iOS", "ios", "#8B3DFF"],
      ] as const
    ).map(([name, key, color]) => ({
      name,
      type: "line" as const,
      data: data.map((row) => row[key]),
      connectNulls: true,
      smooth: 0.2,
      symbol: "circle",
      symbolSize: 5,
      showSymbol: true,
      lineStyle: { color, width: 2.25, type: "solid" as const },
      itemStyle: { color, borderColor: color, borderWidth: 0 },
      markLine:
        name === "전체" && visibleReleases.length
          ? {
              silent: true,
              symbol: "none",
              lineStyle: {
                color: "#b8c0cc",
                type: "dashed" as const,
                width: 1,
              },
              label: { color: "#667085", fontSize: 9 },
              data: visibleReleases.map((release) => ({
                name: release.version,
                xAxis: data.findIndex(
                  (point) => point.date === release.releasedAt.slice(0, 10),
                ),
              })),
            }
          : undefined,
    }));

    return {
      animationDuration: 350,
      aria: { enabled: true },
      color: ["#8993A7", "#16B84E", "#8B3DFF"],
      grid: { top: 62, right: 22, bottom: 38, left: 50 },
      legend: {
        top: 12,
        left: 12,
        itemWidth: 20,
        itemHeight: 6,
        itemGap: 20,
        textStyle: { color: "#465267", fontSize: 10 },
      },
      tooltip: {
        trigger: "axis",
        borderColor: "#dfe4ec",
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,.96)",
        textStyle: { color: "#1d2939", fontSize: 11 },
        valueFormatter: (value: unknown) =>
          value == null ? "데이터 없음" : formatNumber(Number(value)),
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((row) => row.date.slice(5).replace("-", ".")),
        axisLine: { lineStyle: { color: "#dfe5ed" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#7b8798",
          fontSize: 10,
          hideOverlap: true,
          interval: xAxisLabelInterval,
          showMinLabel: true,
          showMaxLabel: true,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 5,
        axisLabel: {
          color: "#7b8798",
          fontSize: 10,
          formatter: formatAxisNumber,
        },
        splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      },
      series,
    };
  }, [data, releases]);

  if (!data.length)
    return (
      <div className="chart-empty">
        선택한 기간의 다운로드 데이터가 없습니다.
      </div>
    );
  return <EChart option={option} ariaLabel="Android 및 iOS 다운로드 추이" />;
}
