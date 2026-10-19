"use client";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { VocKeywordChart } from "@/components/dashboard/views/reviews/voc-keyword-chart";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { keywordGradeLabel } from "@/domain/reviews/review-keywords";

import { ReviewPanel } from "./review-panel";
import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "ratingDistribution"
  | "vocKeywords"
  | "setReviewKeyword"
  | "setReviewPlatform"
  | "setReviewRating"
  | "setReviewPage"
  | "view"
  | "setView"
  | "reviewPlatform"
  | "reviewRating"
  | "reviewKeyword"
  | "initialView"
  | "remoteReviews"
  | "filteredReviews"
  | "visibleReviews"
  | "reviewPage"
  | "totalPages"
  | "reviewLoadMoreRef"
>;

export function ReviewAnalytics({
  ratingDistribution,
  vocKeywords,
  setReviewKeyword,
  setReviewPlatform,
  setReviewRating,
  setReviewPage,
  view,
  setView,
  reviewPlatform,
  reviewRating,
  reviewKeyword,
  initialView,
  remoteReviews,
  filteredReviews,
  visibleReviews,
  reviewPage,
  totalPages,
  reviewLoadMoreRef,
}: Props) {
  return (
    <>
      <DpLayout className="mi-rating-distributions">
        <DpLayout className="mi-rating-distribution-stack">
          {ratingDistribution.map(({ platform, rows }) => (
            <DpCard key={platform} className="mi-rating-card">
              <DpLayout
                direction="row"
                align="center"
                justify="between"
                className="mi-panel-head"
              >
                <DpLayout>
                  <DpText as="h3">
                    수집 리뷰 별점 분포 (
                    {platform === "android" ? "Android" : "iOS"})
                  </DpText>
                </DpLayout>
                <DpLayout
                  align="center"
                  justify="center"
                  className={`mi-platform mi-platform--${platform}`}
                >
                  <PlatformIcon platform={platform} />
                </DpLayout>
              </DpLayout>
              <DpLayout className="mi-rating-bars">
                {rows.map((row) => (
                  <DpLayout direction="row" align="center" key={row.score}>
                    <DpText as="span">{row.score}점</DpText>
                    <DpLayout as="i">
                      <DpLayout
                        as="b"
                        className={`mi-rating-fill mi-rating-fill--${platform}`}
                        style={{ width: `${row.percent}%` }}
                      />
                    </DpLayout>
                    <DpText as="strong">{row.percent.toFixed(1)}%</DpText>
                  </DpLayout>
                ))}
              </DpLayout>
            </DpCard>
          ))}
        </DpLayout>
        <DpCard className="mi-voc-summary">
          <DpLayout
            direction="row"
            align="center"
            justify="between"
            className="mi-panel-head"
          >
            <DpLayout>
              <DpText as="h3">리뷰 키워드</DpText>
              <DpLayout
                direction="row"
                className="mi-keyword-legend"
                aria-label="키워드 등급 범례"
              >
                {(["positive", "neutral", "negative"] as const).map((grade) => (
                  <DpText as="span" wrap="inherit" key={grade}>
                    <i className={`is-${grade}`} aria-hidden="true" />
                    {keywordGradeLabel[grade]}
                  </DpText>
                ))}
              </DpLayout>
            </DpLayout>
            <DpBadge>선택 기간</DpBadge>
          </DpLayout>
          <VocKeywordChart
            groups={vocKeywords}
            onSelect={(selection) => {
              setReviewKeyword(selection);
              setReviewPlatform("all");
              setReviewRating("all");
              setReviewPage(1);
              requestAnimationFrame(() => {
                const results = document.getElementById("voc-review-results");
                results?.focus({ preventScroll: true });
                results?.scrollIntoView({ block: "start", behavior: "smooth" });
              });
            }}
          />
        </DpCard>
      </DpLayout>
      <ReviewPanel
        view={view}
        setReviewPlatform={setReviewPlatform}
        setReviewRating={setReviewRating}
        setReviewKeyword={setReviewKeyword}
        setReviewPage={setReviewPage}
        setView={setView}
        reviewPlatform={reviewPlatform}
        reviewRating={reviewRating}
        reviewKeyword={reviewKeyword}
        initialView={initialView}
        remoteReviews={remoteReviews}
        filteredReviews={filteredReviews}
        visibleReviews={visibleReviews}
        reviewPage={reviewPage}
        totalPages={totalPages}
        reviewLoadMoreRef={reviewLoadMoreRef}
      />
    </>
  );
}
