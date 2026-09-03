"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";

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
      const flatPadding = 1;
      return {
        animationDuration: 300,
        grid: { top: 4, right: 3, bottom: 2, left: 3 },
        xAxis: {
          type: "category",
          show: false,
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
            lineStyle: { color, width: 1 },
            areaStyle: {
              origin: "start",
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}77` },
                  { offset: 1, color: `${color}03` },
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
