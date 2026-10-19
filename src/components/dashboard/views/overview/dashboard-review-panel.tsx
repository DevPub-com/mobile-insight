"use client";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import { reviewTimeLabel } from "@/domain/reviews/review.service";
import { ReviewStars } from "../../shared/dashboard-presentation";

import { DashboardPanelHeader } from "../../shared/dashboard-panel-header";
import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "setReviewPlatform"
  | "setReviewRating"
  | "setReviewKeyword"
  | "setReviewPage"
  | "setView"
  | "dashboardReviewRows"
>;

export function DashboardReviewPanel({
  setReviewPlatform,
  setReviewRating,
  setReviewKeyword,
  setReviewPage,
  setView,
  dashboardReviewRows,
}: Props) {
  return (
    <DpCard className="mi-panel mi-dashboard-review-panel">
      <DashboardPanelHeader title="최근 부정 리뷰">
        <DpButton
          className="mi-dashboard-link"
          onClick={() => {
            setReviewPlatform("all");
            setReviewRating("negative");
            setReviewKeyword(null);
            setReviewPage(1);
            setView("reviews");
          }}
        >
          전체보기 <KoboyoIcon name="arrow-right" size={13} />
        </DpButton>
      </DashboardPanelHeader>
      <DpLayout className="mi-dashboard-review-table">
        <DpLayout className="mi-dashboard-review-head" aria-hidden="true">
          <DpText as="span">플랫폼</DpText>
          <DpText as="span">평점</DpText>
          <DpText as="span">버전</DpText>
          <DpText as="span">작성일</DpText>
          <DpText as="span">리뷰 내용</DpText>
        </DpLayout>
        {dashboardReviewRows.length ? (
          dashboardReviewRows.map((item) => (
            <DpLayout
              as="article"
              className="mi-dashboard-review-item"
              key={item.id}
            >
              <DpLayout
                align="center"
                justify="center"
                className={`mi-dashboard-table-platform mi-dashboard-table-platform--${item.platform}`}
              >
                <PlatformIcon platform={item.platform} size={13} />
              </DpLayout>
              <ReviewStars rating={item.rating} />
              <DpText
                as="span"
                title="스토어 리뷰 원문에 포함된 앱 버전 · 현재 배포 버전과 다를 수 있습니다."
              >
                {item.version ? `v${item.version.replace(/^v/, "")}` : "—"}
              </DpText>
              <DpText
                as="time"
                dateTime={item.reviewedAt}
                suppressHydrationWarning
              >
                {reviewTimeLabel(item.reviewedAt)}
              </DpText>
              <DpText className="mi-dashboard-review-copy" title={item.content}>
                {item.content}
              </DpText>
            </DpLayout>
          ))
        ) : (
          <DpText className="mi-empty">
            선택 기간의 부정 리뷰가 없습니다.
          </DpText>
        )}
      </DpLayout>
    </DpCard>
  );
}
