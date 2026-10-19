"use client";
import { DashboardDateRangePicker } from "@/components/dashboard/layout/date-range-picker";
import { SyncButton } from "@/components/dashboard/layout/sync-button";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { performancePeriodViews } from "./dashboard-navigation";

import type { DashboardModel } from "../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "title"
  | "description"
  | "data"
  | "view"
  | "dateRange"
  | "earliestDate"
  | "latestDate"
  | "availableDateRange"
  | "setDateRange"
  | "setReviewPage"
>;

export function DashboardHeader({
  title,
  description,
  data,
  view,
  dateRange,
  earliestDate,
  latestDate,
  availableDateRange,
  setDateRange,
  setReviewPage,
}: Props) {
  return (
    <DpLayout
      as="header"
      direction="row"
      align="center"
      justify="between"
      className="mi-header"
    >
      <DpLayout direction="row" align="start" justify="between">
        <DpLayout>
          <DpText as="h1">{title}</DpText>
          <DpText>{description}</DpText>
          <DpText className="mi-sync-schedule">
            정기 갱신 · 전체 데이터 매일 오후 3:30 · 리뷰·평점·버전 3시간마다
            (한국시간)
          </DpText>
        </DpLayout>
      </DpLayout>
      <DpLayout
        direction="row"
        align="center"
        justify="end"
        className="mi-header-tools"
      >
        <SyncButton
          key={data.app.id}
          appId={data.app.id}
          revision={
            data.syncRuns
              .map((run) => run.finishedAt)
              .filter((value): value is string => !!value)
              .sort()
              .at(-1) ?? null
          }
        />
        {performancePeriodViews.has(view) && (
          <DashboardDateRangePicker
            value={dateRange}
            minDate={earliestDate}
            maxDate={latestDate}
            disabled={!availableDateRange}
            onChange={(nextRange) => {
              setDateRange(nextRange);
              setReviewPage(1);
            }}
          />
        )}
      </DpLayout>
    </DpLayout>
  );
}
