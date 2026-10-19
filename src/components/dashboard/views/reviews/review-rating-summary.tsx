"use client";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";

import type { EChartsCoreOption } from "echarts/core";
import { EChart } from "@/components/dashboard/charts/echart";
import type { AppReview } from "@/domain/types";
import { buildReviewRatingSummary } from "@/domain/reviews/review-presentation";

export function ReviewRatingSummary({
  reviews = [],
  model,
}: {
  reviews?: AppReview[];
  model?: ReturnType<typeof buildReviewRatingSummary>;
  periodLabel?: string;
}) {
  const aggregated = model ?? buildReviewRatingSummary(reviews);
  const summary = aggregated.summary;
  const daily = new Map(
    aggregated.daily.map(({ date, ...value }) => [date, value]),
  );
  const days = [...daily.keys()].sort();
  const dates: string[] = [];
  if (days.length) {
    const cursor = new Date(`${days[0]}T00:00:00Z`);
    const end = days[days.length - 1];
    while (cursor.toISOString().slice(0, 10) <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const option: EChartsCoreOption = {
    animation: false,
    grid: { top: 12, right: 15, bottom: 24, left: 28 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? `${value.toFixed(2)}점` : "리뷰 없음",
    },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: dates.length === 1,
      axisLabel: {
        formatter: (value: string) => value.slice(5),
        color: "#8993a7",
        hideOverlap: true,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 1,
      max: 5,
      interval: 2,
      axisLabel: { color: "#8993a7" },
      splitLine: { lineStyle: { color: "#edf0f5" } },
    },
    series: [
      {
        type: "line",
        name: "일별 평균 평점",
        data: dates.map((day) => {
          const point = daily.get(day);
          return point ? point.sum / point.count : null;
        }),
        connectNulls: false,
        smooth: false,
        symbol: "circle",
        symbolSize: 5,
        lineStyle: { color: "#6489ee", width: 2 },
        itemStyle: { color: "#6489ee" },
        areaStyle: { color: "#6489ee18" },
      },
    ],
  };
  const groups = [
    { label: "긍정 (4~5점)", count: summary.positive, color: "#22A447" },
    { label: "중립 (3점)", count: summary.neutral, color: "#8993A7" },
    { label: "부정 (1~2점)", count: summary.negative, color: "#EF4444" },
  ];
  const percentage = (count: number) =>
    summary.total ? (count / summary.total) * 100 : 0;
  const positiveEnd = percentage(summary.positive);
  const neutralEnd = positiveEnd + percentage(summary.neutral);

  return (
    <DpLayout
      as="section"
      display="grid"
      className="mi-review-summary"
      aria-label="전체 리뷰 평점 요약"
    >
      <DpCard as="article" variant="custom" className="mi-review-summary-card">
        <DpText as="h3" wrap="inherit">
          전체 평균 평점 (Android · iOS)
        </DpText>
        <DpLayout display="grid" className="mi-review-average-body">
          <div>
            <DpText
              as="strong"
              wrap="inherit"
              className="mi-review-summary-average"
            >
              {summary.average === null ? "—" : summary.average.toFixed(2)}{" "}
              <DpText as="small" wrap="inherit">
                / 5점
              </DpText>
            </DpText>
            <DpText
              as="span"
              wrap="inherit"
              className="mi-review-average-caption"
            >
              선택 기간 수집 리뷰 {summary.total.toLocaleString("ko-KR")}건
            </DpText>
          </div>
          <div className="mi-review-average-trend">
            {days.length ? (
              <EChart
                option={option}
                className="mi-review-average-chart"
                ariaLabel="선택 기간 Android·iOS 수집 리뷰의 일별 평균 평점 추이"
              />
            ) : (
              <DpText as="p" wrap="inherit">
                선택 기간에 수집된 리뷰가 없습니다.
              </DpText>
            )}
          </div>
        </DpLayout>
      </DpCard>
      <DpCard as="article" variant="custom" className="mi-review-summary-card">
        <DpText as="h3" wrap="inherit">
          긍정 · 부정 리뷰 비율
        </DpText>
        {summary.total === 0 ? (
          <DpText as="p" wrap="inherit">
            선택 기간에 수집된 리뷰가 없습니다.
          </DpText>
        ) : (
          <DpLayout direction="row" className="mi-review-sentiment">
            <div
              className="mi-review-pie"
              role="img"
              aria-label={groups
                .map(
                  (group) =>
                    `${group.label} ${percentage(group.count).toFixed(1)}%`,
                )
                .join(", ")}
              style={{
                background: `conic-gradient(#22A447 0% ${positiveEnd}%, #8993A7 ${positiveEnd}% ${neutralEnd}%, #EF4444 ${neutralEnd}% 100%)`,
              }}
            />
            <ul>
              {groups.map((group) => (
                <li key={group.label}>
                  <span style={{ background: group.color }} />
                  {group.label}
                  <DpText as="strong" wrap="inherit">
                    {percentage(group.count).toFixed(1)}%
                  </DpText>
                  <DpText as="small" wrap="inherit">
                    {group.count.toLocaleString("ko-KR")}건
                  </DpText>
                </li>
              ))}
            </ul>
          </DpLayout>
        )}
      </DpCard>
    </DpLayout>
  );
}
