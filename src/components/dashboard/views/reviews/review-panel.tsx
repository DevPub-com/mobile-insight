"use client";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import {
  keywordGradeLabel,
  reviewTopicChips,
} from "@/domain/reviews/review-keywords";
import {
  reviewAuthorLabel,
  reviewTimeLabel,
} from "@/domain/reviews/review.service";
import { ReviewDevice, ReviewStars } from "../../shared/dashboard-presentation";

import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "view"
  | "setReviewPlatform"
  | "setReviewRating"
  | "setReviewKeyword"
  | "setReviewPage"
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

export function ReviewPanel({
  view,
  setReviewPlatform,
  setReviewRating,
  setReviewKeyword,
  setReviewPage,
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
    <DpCard
      id="voc-review-results"
      tabIndex={-1}
      className="mi-panel mi-review-panel"
    >
      <DpLayout
        direction="row"
        justify="between"
        align="start"
        className={`mi-panel-head${
          view === "dashboard" ? " mi-panel-head--compact" : ""
        }`}
      >
        <DpLayout>
          <DpText as="h3">
            {view === "dashboard" ? "부정 리뷰" : "최근 리뷰"}
          </DpText>
        </DpLayout>
        {view === "dashboard" && (
          <DpButton
            className="mi-review-more"
            onClick={() => {
              setReviewPlatform("all");
              setReviewRating("negative");
              setReviewKeyword(null);
              setReviewPage(1);
              setView("reviews");
            }}
          >
            더보기
          </DpButton>
        )}
      </DpLayout>
      {view === "reviews" && (
        <DpLayout direction="row" className="mi-filter-row">
          <DpText as="span">플랫폼</DpText>
          {(["all", "android", "ios"] as const).map((value) => (
            <DpButton
              key={value}
              className={reviewPlatform === value ? "is-active" : ""}
              onClick={() => {
                setReviewPlatform(value);
                setReviewPage(1);
              }}
            >
              {value === "all"
                ? "전체"
                : value === "android"
                  ? "Android"
                  : "iOS"}
            </DpButton>
          ))}
          <DpText as="span">평점</DpText>
          {(["all", "positive", "neutral", "negative"] as const).map(
            (value) => (
              <DpButton
                key={value}
                className={reviewRating === value ? "is-active" : ""}
                onClick={() => {
                  setReviewRating(value);
                  setReviewPage(1);
                }}
              >
                {value === "all"
                  ? "전체"
                  : value === "positive"
                    ? "4~5점"
                    : value === "neutral"
                      ? "3점"
                      : "1~2점"}
              </DpButton>
            ),
          )}
        </DpLayout>
      )}
      {view === "reviews" && reviewKeyword && (
        <DpLayout
          direction="row"
          className="mi-voc-active-filter"
          aria-live="polite"
        >
          <DpText as="span" wrap="inherit">
            {reviewKeyword.label} ·{" "}
            {reviewKeyword.grade === "all"
              ? "전체 감정"
              : keywordGradeLabel[reviewKeyword.grade]}{" "}
            · {initialView ? remoteReviews.total : filteredReviews.length}개
            리뷰
          </DpText>
          <DpButton
            variant="custom"
            type="button"
            onClick={() => {
              setReviewKeyword(null);
              setReviewPage(1);
            }}
          >
            키워드 필터 해제
          </DpButton>
        </DpLayout>
      )}
      <DpLayout className="mi-review-list">
        {visibleReviews.length ? (
          visibleReviews.map((item) => (
            <DpLayout
              as="article"
              direction="row"
              key={item.id}
              className="mi-review-row"
            >
              <DpLayout
                align="center"
                justify="center"
                className={`mi-platform mi-platform--${item.platform}`}
              >
                <PlatformIcon platform={item.platform} />
              </DpLayout>
              <DpLayout className="min-w-0 flex-1">
                <DpLayout
                  direction="row"
                  align="center"
                  className={`mi-review-meta mi-review-meta--${item.platform}`}
                >
                  <DpText as="span" className="mi-review-author">
                    {reviewAuthorLabel(item.author)}
                  </DpText>
                  <ReviewStars rating={item.rating} />
                  <DpLayout
                    as="span"
                    display="inline-flex"
                    direction="row"
                    className="mi-review-classification"
                  >
                    <DpText as="span" className="mi-review-version">
                      {item.version
                        ? `v${item.version.replace(/^v/, "")}`
                        : "버전 정보 없음"}
                    </DpText>
                  </DpLayout>
                  <ReviewDevice review={item} />
                  <DpText
                    as="time"
                    dateTime={item.reviewedAt}
                    suppressHydrationWarning
                  >
                    {reviewTimeLabel(item.reviewedAt)}
                  </DpText>
                </DpLayout>
                <DpText className="mi-review-copy">{item.content}</DpText>
                <DpLayout
                  direction="row"
                  className={`mi-review-ai-tags is-${item.aiSentiment ?? (item.rating <= 2 ? "negative" : item.rating >= 4 ? "positive" : "neutral")}`}
                >
                  {reviewTopicChips(item).map(({ label, key, level }) => (
                    <DpButton
                      variant="custom"
                      type="button"
                      key={key}
                      className="mi-ai-topic-chip"
                      title={`${level === "major" ? "대분류" : level === "middle" ? "중분류" : "소분류"}: ${label}`}
                      aria-label={`${label} 관련 리뷰 보기`}
                      onClick={() => {
                        setView("reviews");
                        setReviewKeyword({ label, key, level, grade: "all" });
                        setReviewPage(1);
                      }}
                    >
                      #{label}
                    </DpButton>
                  ))}
                </DpLayout>
              </DpLayout>
            </DpLayout>
          ))
        ) : (
          <DpText className="mi-empty">
            {initialView && remoteReviews.loading
              ? "리뷰를 불러오는 중…"
              : initialView && remoteReviews.error
                ? remoteReviews.error
                : "조건에 맞는 리뷰가 없습니다."}
          </DpText>
        )}
      </DpLayout>
      {view === "reviews" && initialView && remoteReviews.error && (
        <DpButton onClick={remoteReviews.retry}>리뷰 다시 불러오기</DpButton>
      )}
      {view === "reviews" &&
        (initialView ? remoteReviews.hasMore : reviewPage < totalPages) && (
          <DpLayout
            ref={reviewLoadMoreRef}
            className="mi-review-load-more"
            aria-hidden="true"
          />
        )}
    </DpCard>
  );
}
