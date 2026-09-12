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
  singlePoint = false,
  smooth = true,
}: {
  values: Array<number | null>;
  color: string;
  singlePoint?: boolean;
  smooth?: boolean;
}) {
  const option = useMemo<EChartsCoreOption>(
    () => {
      const isFlat =
        values.length > 0 && values[0] !== null &&
        values.every((value) => value === values[0]);
      const chartValues = isFlat && !(singlePoint && values.length === 1) ? [values[0], values[0]] : values;
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
              min: chartValues[0]! - flatPadding,
              max: chartValues[0]! + flatPadding,
            }
          : { type: "value", show: false, scale: true },
        series: [
          {
            type: "line",
            data: chartValues,
            connectNulls: false,
            smooth: smooth ? 0.4 : false,
            symbol: singlePoint && values.length === 1 ? "circle" : "none",
            showSymbol: singlePoint && values.length === 1,
            symbolSize: 6,
            itemStyle: { color: chartColor },
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
    [color, values, singlePoint, smooth],
  );

  return (
    <EChart
      option={option}
      className="mi-sparkline"
      ariaLabel="지표 미니 추이"
    />
  );
}
