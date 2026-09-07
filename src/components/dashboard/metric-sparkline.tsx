"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";

export function resolveSparklineColor(seriesColor: string) {
  return seriesColor;
}

export function releaseImpactSparklineColor(value: number | null) {
  return value === null
    ? "#8993A7"
    : value > 0
      ? "#22A447"
      : value < 0
        ? "#EF4444"
        : "#F59E0B";
}

export function metricTrendTone(value: number | null) {
  return value === null
    ? "is-muted"
    : value > 0
      ? "is-increase"
      : value < 0
        ? "is-decrease"
        : "is-flat";
}

export function MetricSparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const option = useMemo<EChartsCoreOption>(
    () => {
      const isFlat =
        values.length > 0 &&
        values.every((value) => value === values[0]);
      const chartValues = isFlat ? [values[0], values[0]] : values;
      const chartColor = resolveSparklineColor(color);
      const flatPadding = 1;
      return {
        animationDuration: 300,
        grid: { top: 4, right: 3, bottom: 2, left: 3 },
        xAxis: {
          type: "category",
          show: false,
          boundaryGap: false,
          data: chartValues.map((_, index) => index),
        },
        yAxis: isFlat
          ? {
              type: "value",
              show: false,
              scale: true,
              min: chartValues[0] - flatPadding,
              max: chartValues[0] + flatPadding,
            }
          : { type: "value", show: false, scale: true },
        series: [
          {
            type: "line",
            data: chartValues,
            smooth: 0.4,
            symbol: "none",
            showSymbol: false,
            lineStyle: { color: chartColor, width: 1 },
            areaStyle: {
              origin: "start",
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${chartColor}77` },
                  { offset: 1, color: `${chartColor}03` },
                ],
              },
            },
          },
        ],
      };
    },
    [color, values],
  );

  return (
    <EChart
      option={option}
      className="mi-sparkline"
      ariaLabel="지표 미니 추이"
    />
  );
}
