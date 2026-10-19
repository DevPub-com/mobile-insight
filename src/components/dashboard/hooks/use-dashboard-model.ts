"use client";
import {
  matchesKeyword,
  type KeywordSelection,
} from "@/domain/reviews/review-keywords";
import { latestNegativeReviews } from "@/domain/reviews/review.service";
import type { DashboardData, Platform } from "@/domain/types";
import {
  availableMetricDateRange,
  buildReleaseCadence,
  buildStoreRatingSummary,
  compareVersionsDescending,
  dateRangeDays,
  periodStart,
  reviewMatchesRatingGroup,
  type ReviewRatingGroup,
} from "@/services/mobile";
import type { DashboardView } from "@/services/mobile/dashboard-view";
import { buildActiveAudience } from "@/services/mobile/tabs/active-audience.service";
import { useEffect, useMemo, useRef, useState } from "react";
import { View, viewCopy } from "../layout/dashboard-navigation";
import { useDashboardView } from "./use-dashboard-view";
import { useFirebaseReleaseCrashes } from "./use-firebase-release-crashes";
import { useReviewPage } from "./use-review-page";

export function useDashboardModel({
  data,
  initialView,
}: {
  data: DashboardData;
  initialView?: DashboardView;
}) {
  const [view, setView] = useState<View>("dashboard");
  const availableDateRange = availableMetricDateRange(data);
  const latestDate =
    availableDateRange?.endDate ?? new Date().toISOString().slice(0, 10);
  const earliestDate =
    availableDateRange?.startDate ?? periodStart("30d", latestDate);
  const [dateRange, setDateRange] = useState(() => ({
    startDate:
      periodStart("30d", latestDate) < earliestDate
        ? earliestDate
        : periodStart("30d", latestDate),
    endDate: latestDate,
  }));
  const [reviewPlatform, setReviewPlatform] = useState<Platform | "all">("all");
  const [reviewRating, setReviewRating] = useState<ReviewRatingGroup>("all");
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewKeyword, setReviewKeyword] = useState<KeywordSelection | null>(
    null,
  );
  const reviewLoadMoreRef = useRef<HTMLElement | null>(null);
  const [releasePlatform, setReleasePlatform] = useState<Platform | "all">(
    "all",
  );
  const [releaseSearch, setReleaseSearch] = useState("");
  const [timelineScale, setTimelineScale] = useState<
    "week" | "month" | "quarter"
  >("month");
  const rangeQuery = useDashboardView(data, dateRange, initialView);
  const { loading: rangeLoading, error: rangeError } = rangeQuery;
  const dashboardSummary = rangeQuery.view.dashboardSummary;
  const storeRatings = useMemo(
    () => buildStoreRatingSummary(data, dateRange),
    [data, dateRange],
  );
  const audience = useMemo(
    () => buildActiveAudience(data.metrics, data.app.id, dateRange),
    [data, dateRange],
  );
  const combinedAudience = [...audience.trend]
    .reverse()
    .find(
      (row) =>
        row.androidDau !== null &&
        row.iosDau !== null &&
        row.androidMau !== null &&
        row.iosMau !== null,
    );
  const periodSummary = rangeQuery.view.periodSummary;
  const ratingTrend = dashboardSummary.charts.ratings;
  const releases = useMemo(
    () =>
      [...data.releases].sort(
        (a, b) =>
          b.releasedAt.localeCompare(a.releasedAt) ||
          compareVersionsDescending(a.version, b.version),
      ),
    [data.releases],
  );
  const latestRelease = (platform: Platform) =>
    releases.find((item) => item.platform === platform) ?? null;
  const platformImpacts = Object.fromEntries(
    (["android", "ios"] as Platform[]).map((platform) => {
      const impact = dashboardSummary.latestReleaseImpact.platforms[platform];
      return [platform, impact.release ? impact : null];
    }),
  ) as Record<
    Platform,
    (typeof dashboardSummary.latestReleaseImpact.platforms)[Platform] | null
  >;
  const firebaseReleaseCrashes = useFirebaseReleaseCrashes(
    data.app.code,
    releases,
    data.syncRuns
      .map((run) => run.finishedAt ?? "")
      .sort()
      .at(-1) ?? "",
    view === "dashboard",
  );
  const platformNegativeReviews = (platform: Platform) => {
    const review = dashboardSummary.kpis.negativeReviews[platform];
    return { current: review.value, change: review.changePoints };
  };
  const androidNegativeReviews = platformNegativeReviews("android");
  const iosNegativeReviews = platformNegativeReviews("ios");
  const releaseToday = new Date().toISOString().slice(0, 10);
  const releaseReferenceDate = new Date(`${releaseToday}T00:00:00.000Z`);
  const releaseCadence = buildReleaseCadence(releases, releaseToday);
  const filteredReleases = releases.filter((item) => {
    const query = releaseSearch.trim().toLowerCase();
    return (
      (releasePlatform === "all" || item.platform === releasePlatform) &&
      (!query ||
        item.version.toLowerCase().includes(query) ||
        item.platform.toLowerCase().includes(query))
    );
  });
  const timelineDates = Array.from(
    releases.reduce((groups, item) => {
      const key = item.releasedAt.slice(0, 10);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
      return groups;
    }, new Map<string, typeof releases>()),
  )
    .filter(([releasedAt]) => {
      const windowDays =
        timelineScale === "week" ? 7 : timelineScale === "month" ? 30 : 90;
      const days =
        (releaseReferenceDate.getTime() -
          new Date(`${releasedAt}T00:00:00.000Z`).getTime()) /
        86_400_000;
      return days >= 0 && days < windowDays;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  const filteredReviews = data.reviews.filter((item) => {
    const reviewedAt = item.reviewedAt.slice(0, 10);
    return (
      reviewedAt >= dateRange.startDate &&
      reviewedAt <= dateRange.endDate &&
      (reviewPlatform === "all" || item.platform === reviewPlatform) &&
      reviewMatchesRatingGroup(item.rating, reviewRating) &&
      matchesKeyword(item, reviewKeyword)
    );
  });
  const dashboardNegativeReviews = useMemo(
    () => latestNegativeReviews(data.reviews),
    [data.reviews],
  );
  const {
    vocKeywords,
    notableReviews,
    platformReviewSummaries,
    ratingDistribution,
    reviewRatingSummary,
  } = rangeQuery.view;
  const reviewQuery = new URLSearchParams({
    from: dateRange.startDate,
    to: dateRange.endDate,
    platform: reviewPlatform,
    ratingGroup: reviewRating,
    pageSize: "8",
    revision:
      data.syncRuns
        .map((run) => run.finishedAt ?? "")
        .sort()
        .at(-1) ?? "",
  });
  if (reviewKeyword) reviewQuery.set("keyword", JSON.stringify(reviewKeyword));
  const remoteReviews = useReviewPage(
    data.app.code,
    reviewQuery.toString(),
    !!initialView && view === "reviews",
  );
  const {
    hasMore,
    loading: reviewsLoading,
    error: reviewsError,
    loadMore,
  } = remoteReviews;
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const visibleReviews =
    view === "reviews"
      ? initialView
        ? remoteReviews.items
        : filteredReviews.slice(0, reviewPage * pageSize)
      : dashboardNegativeReviews;
  useEffect(() => {
    const loadMoreTarget = reviewLoadMoreRef.current;
    if (
      view !== "reviews" ||
      rangeLoading ||
      rangeError ||
      !loadMoreTarget ||
      (initialView
        ? !hasMore || reviewsLoading || !!reviewsError
        : reviewPage >= totalPages)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (initialView) loadMore();
          else setReviewPage((page) => Math.min(page + 1, totalPages));
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [
    reviewPage,
    totalPages,
    view,
    initialView,
    hasMore,
    reviewsLoading,
    reviewsError,
    loadMore,
    rangeLoading,
    rangeError,
  ]);
  const latestSync = (platform: Platform) =>
    data.syncRuns.find(
      (item) => item.platform === platform && item.syncType === "all",
    ) ?? data.syncRuns.find((item) => item.platform === platform);
  const latestOverallSync = data.syncRuns.find(
    (item) => item.syncType === "all",
  );
  const periodLabel = `${dateRangeDays(dateRange)}일`;
  const [title, description] = viewCopy[view];
  const connectedPlatforms = (["android", "ios"] as Platform[]).filter(
    (platform) =>
      platform === "android"
        ? Boolean(data.app.androidPackageName)
        : Boolean(data.app.iosAppId || data.app.iosBundleId),
  );
  const healthyPlatforms = connectedPlatforms.filter(
    (platform) => latestSync(platform)?.status === "success",
  );
  const connectionRatio = connectedPlatforms.length
    ? (healthyPlatforms.length / connectedPlatforms.length) * 100
    : null;
  const dashboardReviewRows = dashboardSummary.negativeReviewsTop10.slice(0, 5);
  return {
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
    latestRelease,
    releaseCadence,
    timelineScale,
    setTimelineScale,
    timelineDates,
    releasePlatform,
    setReleasePlatform,
    releaseSearch,
    setReleaseSearch,
    filteredReleases,
    dashboardReviewRows,
    platformImpacts,
    firebaseReleaseCrashes,
    data,
    title,
    description,
    dateRange,
    earliestDate,
    latestDate,
    availableDateRange,
    setDateRange,
    combinedAudience,
    audience,
    storeRatings,
    periodLabel,
    periodSummary,
    ratingTrend,
    androidNegativeReviews,
    dashboardSummary,
    iosNegativeReviews,
    reviewRatingSummary,
    platformReviewSummaries,
    notableReviews,
    ratingDistribution,
    vocKeywords,
    connectedPlatforms,
    latestOverallSync,
    connectionRatio,
    healthyPlatforms,
    latestSync,
    rangeQuery,
  };
}
export type DashboardModel = ReturnType<typeof useDashboardModel>;
