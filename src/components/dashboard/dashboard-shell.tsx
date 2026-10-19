"use client";
import { DpText } from "@/components/ui/dp/DpText";
import { ReleaseImpactWorkspace } from "@/components/dashboard/views/impact/release-impact-workspace";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import type { DashboardData } from "@/domain/types";
import type { DashboardView } from "@/services/mobile/dashboard-view";
import { performancePeriodViews } from "./layout/dashboard-navigation";
import { FirebaseAcquisitionPanel } from "./views/acquisition/firebase-acquisition-panel";

import { AppManagementView } from "./views/apps/app-management-view";
import { DashboardCharts } from "./views/overview/dashboard-charts";
import { DashboardHeader } from "./layout/dashboard-header";
import { DashboardSidebar } from "./layout/dashboard-sidebar";
import { DashboardSummaryCards } from "./views/overview/dashboard-summary-cards";
import { ReleasesView } from "./views/releases/releases-view";
import { ReviewAnalytics } from "./views/reviews/review-analytics";
import { ReviewHighlights } from "./views/reviews/review-highlights";
import { ReviewRatingSummary } from "./views/reviews/review-rating-summary";
import { useDashboardModel } from "./hooks/use-dashboard-model";
export { Change } from "./shared/dashboard-presentation";
export function DashboardShell({
  data,
  initialView,
}: {
  data: DashboardData;
  initialView?: DashboardView;
}) {
  const model = useDashboardModel({ data, initialView });
  const { view, rangeQuery, dateRange } = model;
  return (
    <DpLayout as="main" direction="row" className="mi-app-shell">
      <DashboardSidebar
        data={model.data}
        view={model.view}
        setView={model.setView}
        setReviewPage={model.setReviewPage}
      />
      <DpLayout as="section" className="mi-workspace">
        <DashboardHeader
          title={model.title}
          description={model.description}
          data={model.data}
          view={model.view}
          dateRange={model.dateRange}
          earliestDate={model.earliestDate}
          latestDate={model.latestDate}
          availableDateRange={model.availableDateRange}
          setDateRange={model.setDateRange}
          setReviewPage={model.setReviewPage}
        />
        <DpLayout className="mi-content">
          {performancePeriodViews.has(view) && rangeQuery.loading && (
            <DpText as="p" wrap="inherit" role="status">
              선택한 기간의 데이터를 불러오는 중…
            </DpText>
          )}
          {performancePeriodViews.has(view) && rangeQuery.error && (
            <div role="alert">
              {rangeQuery.error}{" "}
              <DpButton onClick={rangeQuery.retry}>다시 불러오기</DpButton>
            </div>
          )}
          {(!performancePeriodViews.has(view) ||
            (!rangeQuery.loading && !rangeQuery.error)) && (
            <>
              {view === "dashboard" && (
                <DashboardSummaryCards
                  combinedAudience={model.combinedAudience}
                  data={model.data}
                  audience={model.audience}
                  dateRange={model.dateRange}
                  storeRatings={model.storeRatings}
                  periodLabel={model.periodLabel}
                  periodSummary={model.periodSummary}
                  ratingTrend={model.ratingTrend}
                  androidNegativeReviews={model.androidNegativeReviews}
                  dashboardSummary={model.dashboardSummary}
                  iosNegativeReviews={model.iosNegativeReviews}
                />
              )}
              {view === "reviews" && (
                <ReviewRatingSummary model={model.reviewRatingSummary} />
              )}
              {view === "reviews" && (
                <ReviewHighlights
                  platformReviewSummaries={model.platformReviewSummaries}
                  notableReviews={model.notableReviews}
                />
              )}
              {view === "dashboard" && (
                <DashboardCharts
                  audience={model.audience}
                  ratingTrend={model.ratingTrend}
                  setReviewPlatform={model.setReviewPlatform}
                  setReviewRating={model.setReviewRating}
                  setReviewKeyword={model.setReviewKeyword}
                  setReviewPage={model.setReviewPage}
                  setView={model.setView}
                  dashboardReviewRows={model.dashboardReviewRows}
                  platformImpacts={model.platformImpacts}
                  firebaseReleaseCrashes={model.firebaseReleaseCrashes}
                />
              )}
              {view === "downloads" && (
                <FirebaseAcquisitionPanel data={data} range={dateRange} />
              )}
              {view === "reviews" && (
                <ReviewAnalytics
                  ratingDistribution={model.ratingDistribution}
                  vocKeywords={model.vocKeywords}
                  setReviewKeyword={model.setReviewKeyword}
                  setReviewPlatform={model.setReviewPlatform}
                  setReviewRating={model.setReviewRating}
                  setReviewPage={model.setReviewPage}
                  view={model.view}
                  setView={model.setView}
                  reviewPlatform={model.reviewPlatform}
                  reviewRating={model.reviewRating}
                  reviewKeyword={model.reviewKeyword}
                  initialView={model.initialView}
                  remoteReviews={model.remoteReviews}
                  filteredReviews={model.filteredReviews}
                  visibleReviews={model.visibleReviews}
                  reviewPage={model.reviewPage}
                  totalPages={model.totalPages}
                  reviewLoadMoreRef={model.reviewLoadMoreRef}
                />
              )}
              {view === "releases" && (
                <ReleasesView
                  latestRelease={model.latestRelease}
                  releaseCadence={model.releaseCadence}
                  timelineScale={model.timelineScale}
                  setTimelineScale={model.setTimelineScale}
                  timelineDates={model.timelineDates}
                  releasePlatform={model.releasePlatform}
                  setReleasePlatform={model.setReleasePlatform}
                  releaseSearch={model.releaseSearch}
                  setReleaseSearch={model.setReleaseSearch}
                  filteredReleases={model.filteredReleases}
                />
              )}
              {view === "impact" && <ReleaseImpactWorkspace data={data} />}
              {view === "apps" && (
                <AppManagementView
                  data={model.data}
                  connectedPlatforms={model.connectedPlatforms}
                  latestOverallSync={model.latestOverallSync}
                  connectionRatio={model.connectionRatio}
                  healthyPlatforms={model.healthyPlatforms}
                  latestSync={model.latestSync}
                />
              )}
            </>
          )}
        </DpLayout>
      </DpLayout>
    </DpLayout>
  );
}
