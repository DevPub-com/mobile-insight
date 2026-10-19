"use client";
import { RatingChart } from "@/components/dashboard/views/overview/rating-chart";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { ActiveAudienceChart } from "./active-audience-chart";

import { DashboardImpactPanel } from "./dashboard-impact-panel";
import { DashboardReviewPanel } from "./dashboard-review-panel";
import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "audience"
  | "ratingTrend"
  | "setReviewPlatform"
  | "setReviewRating"
  | "setReviewKeyword"
  | "setReviewPage"
  | "setView"
  | "dashboardReviewRows"
  | "platformImpacts"
  | "firebaseReleaseCrashes"
>;

export function DashboardCharts({
  audience,
  ratingTrend,
  setReviewPlatform,
  setReviewRating,
  setReviewKeyword,
  setReviewPage,
  setView,
  dashboardReviewRows,
  platformImpacts,
  firebaseReleaseCrashes,
}: Props) {
  return (
    <>
      <DpLayout as="section" className="mi-chart-grid">
        <DpCard className="mi-panel mi-chart-card">
          <DpLayout
            direction="row"
            justify="between"
            align="center"
            className="mi-panel-head"
          >
            <DpLayout>
              <DpText as="h3">MAU · DAU 추이</DpText>
            </DpLayout>
          </DpLayout>
          <ActiveAudienceChart data={audience.trend} />
        </DpCard>
        <DpCard className="mi-panel mi-chart-card">
          <DpLayout
            direction="row"
            justify="between"
            align="center"
            className="mi-panel-head"
          >
            <DpText as="h3">평점 추이</DpText>
          </DpLayout>
          <RatingChart data={ratingTrend} />
        </DpCard>
      </DpLayout>
      <DpLayout as="section" className="mi-dashboard-bottom-grid">
        <DashboardReviewPanel
          setReviewPlatform={setReviewPlatform}
          setReviewRating={setReviewRating}
          setReviewKeyword={setReviewKeyword}
          setReviewPage={setReviewPage}
          setView={setView}
          dashboardReviewRows={dashboardReviewRows}
        />
        <DashboardImpactPanel
          setView={setView}
          platformImpacts={platformImpacts}
          firebaseReleaseCrashes={firebaseReleaseCrashes}
        />
      </DpLayout>
    </>
  );
}
