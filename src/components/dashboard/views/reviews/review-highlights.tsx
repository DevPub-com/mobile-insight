"use client";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import { keywordGradeLabel } from "@/domain/reviews/review-keywords";
import { number, rating } from "../../utils/dashboard-formatters";
import {
  DashboardCardTitle,
  PlatformMetric,
} from "../../shared/dashboard-presentation";

import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<DashboardModel, "platformReviewSummaries" | "notableReviews">;

export function ReviewHighlights({
  platformReviewSummaries,
  notableReviews,
}: Props) {
  return (
    <DpLayout as="section" className="mi-review-summary-grid">
      <DpCard className="mi-dashboard-kpi-card mi-review-platform-card">
        <DashboardCardTitle
          icon={<KoboyoIcon name="message-square" size={17} />}
          tone="blue"
          tooltip="선택 기간에 작성된 수집 리뷰 수입니다."
        >
          설정 기간 리뷰 수
        </DashboardCardTitle>
        <DpLayout direction="row" className="mi-dashboard-platform-split">
          {platformReviewSummaries.map(({ platform, count, counts }) => (
            <PlatformMetric
              key={platform}
              platform={platform}
              value={`${number(count)}건`}
              change={null}
              statusLabel="수집 리뷰"
              sparkline={counts}
            />
          ))}
        </DpLayout>
      </DpCard>
      <DpCard className="mi-dashboard-kpi-card mi-review-platform-card">
        <DashboardCardTitle
          icon={<KoboyoIcon name="star" size={17} />}
          tone="blue"
          tooltip="선택 기간에 작성된 수집 리뷰의 평균 별점입니다."
        >
          설정 기간 평점
        </DashboardCardTitle>
        <DpLayout direction="row" className="mi-dashboard-platform-split">
          {platformReviewSummaries.map(
            ({ platform, average, count, ratings }) => (
              <PlatformMetric
                key={platform}
                platform={platform}
                value={rating(average)}
                change={null}
                statusLabel={
                  count
                    ? `리뷰 ${number(count)}건 · 5점 만점`
                    : "이 기간에 리뷰 없음"
                }
                sparkline={ratings}
              />
            ),
          )}
        </DpLayout>
      </DpCard>
      <DpCard className="mi-review-summary-card">
        <DpText as="h3">주목할 만한 리뷰</DpText>
        <DpLayout display="grid" className="mi-notable-reviews">
          {notableReviews.length ? (
            notableReviews.map(({ label, key, grade, count, review }) => (
              <div key={`${grade}:${key}`}>
                <DpText
                  as="span"
                  wrap="inherit"
                  className={`mi-ai-topic-chip is-${grade}`}
                  title={`${(JSON.parse(key) as string[])
                    .filter(Boolean)
                    .map((value) => `#${value}`)
                    .join(" ")} · ${keywordGradeLabel[grade]}`}
                >
                  #{label}
                </DpText>
                <DpText as="strong" wrap="inherit" className="mi-repeat-count">
                  {count}건 반복
                </DpText>
                <DpText as="p" wrap="inherit" title={review.content}>
                  {review.content}
                </DpText>
              </div>
            ))
          ) : (
            <DpText className="mi-summary-caption">
              이 기간에는 소분류가 확인된 반복 리뷰가 없습니다.
            </DpText>
          )}
        </DpLayout>
      </DpCard>
    </DpLayout>
  );
}
