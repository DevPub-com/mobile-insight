"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { CrashHistory } from "@/components/dashboard/crash-history";
import { buildCrashHistory } from "@/services/mobile/crash-history.service";
import { AppSelector } from "@/components/dashboard/app-selector";
import { DashboardDateRangePicker } from "@/components/dashboard/date-range-picker";
import { DownloadChart } from "@/components/dashboard/download-chart";
import { DownloadOsShare } from "@/components/dashboard/download-os-share";
import { DownloadModels } from "@/components/dashboard/download-models";
import {
  MetricSparkline,
  metricTrendTone,
  releaseImpactSparklineColor,
} from "@/components/dashboard/metric-sparkline";
import { PlatformIcon } from "@/components/dashboard/platform-icon";
import { ReviewRatingSummary } from "@/components/dashboard/review-rating-summary";
import { RatingChart } from "@/components/dashboard/rating-chart";
import { ReleaseImpactWorkspace } from "@/components/dashboard/release-impact-workspace";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import {
  latestNegativeReviews,
  reviewAuthorLabel,
  reviewDeviceLabel,
  reviewTimeLabel,
} from "@/domain/reviews/review.service";
import type { DashboardData, Platform } from "@/domain/types";
import {
  availableMetricDateRange,
  buildDashboardSummaryForRange,
  buildDateRangeSummary,
  buildInstallLifecycleForRange,
  buildOverview,
  buildDownloadTrendForRange,
  buildStoreRatingSummary,
  buildRatingDistribution,
  buildReviewRateTrendForRange,
  buildVocKeywords,
  compareVersionsDescending,
  dateRangeDays,
  downloadDataStatusForRange,
  periodStart,
  reviewMatchesRatingGroup,
  type ReviewRatingGroup,
} from "@/services/mobile";

type View =
  "dashboard" | "downloads" | "reviews" | "releases" | "impact" | "apps";

const viewCopy: Record<View, [string, string]> = {
  dashboard: ["대시보드", "앱 상태와 최신 배포 이후 변화를 한눈에 확인하세요."],
  downloads: ["다운로드", "앱의 다운로드 추이와 설치 데이터를 확인하세요."],
  reviews: ["평점 & 리뷰", "앱의 평점과 리뷰 데이터를 종합적으로 확인하세요."],
  releases: ["릴리즈", "앱의 버전 배포 현황과 변경사항을 한눈에 확인하세요."],
  impact: [
    "릴리즈 임팩트",
    "특정 버전의 배포 전후 성과 변화를 한눈에 분석하세요.",
  ],
  apps: ["앱 관리", "연결된 앱과 스토어를 관리하고 동기화 상태를 확인하세요."],
};

const performancePeriodViews = new Set<View>([
  "dashboard",
  "downloads",
  "reviews",
]);

const number = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("ko-KR").format(value);
const rating = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);
const percent = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
function ratingSparklineValues(
  trend: Array<{ android: number | null; ios: number | null }>,
  platform: Platform,
  fallback: number | null,
): number[] {
  const values = trend.flatMap((item) => {
    const value = item[platform];
    return value === null ? [] : [value];
  });
  return values.length ? values : fallback === null ? [] : [fallback];
}
const signedDelta = (value: number | null, decimals = 0, suffix = "") => {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${value >= 0 ? "+" : ""}${formatted}${suffix}`;
};
const displayedDifference = (
  before: number | null,
  after: number | null,
  decimals: number,
) => {
  if (before === null || after === null) return null;
  const visibleBefore = Number(before.toFixed(decimals));
  const visibleAfter = Number(after.toFixed(decimals));
  return Number((visibleAfter - visibleBefore).toFixed(decimals));
};
const date = (value: string) => value.slice(0, 10).replaceAll("-", ".");
const releaseDate = (release: DashboardData["releases"][number]) =>
  `${date(release.releasedAt)}${release.releaseDateEstimated ? " (추정)" : ""}`;
const syncDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "기록 없음";

function Change({
  value,
  suffix = "%",
  decimals = 1,
  comparisonLabel,
  scope,
}: {
  value: number | null;
  suffix?: string;
  decimals?: number;
  comparisonLabel?: string;
  scope?: Platform | "total";
}) {
  if (value === null)
    return (
      <DpText as="span" className="mi-change mi-change--muted">
        비교 불가
      </DpText>
    );
  const tone =
    value > 0
      ? "mi-change--increase"
      : value < 0
        ? "mi-change--decrease"
        : "mi-change--flat";
  return (
    <DpText
      as="span"
      className={`mi-change ${tone}${scope ? ` mi-change--${scope}` : ""}`}
    >
      <span className="mi-change-icon" aria-hidden="true">
        {value === 0 ? (
          <KoboyoIcon name="minus" size={9} />
        ) : (
          <KoboyoIcon
            name="arrow-up"
            size={9}
            className={value < 0 ? "is-down" : undefined}
          />
        )}
      </span>
      {value.toFixed(decimals)}
      {suffix}
      {comparisonLabel && <small>({comparisonLabel})</small>}
    </DpText>
  );
}

function MetricCard({
  icon,
  title,
  value,
  change,
  tone,
  sparkline,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  change: ReactNode;
  tone: string;
  sparkline: ReactNode;
}) {
  return (
    <DpCard className="mi-metric-card">
      <DpLayout
        align="center"
        justify="center"
        className={`mi-metric-icon mi-metric-icon--${tone}`}
      >
        {icon}
      </DpLayout>
      <DpLayout className="mi-metric-content min-w-0">
        <DpText as="span" size="small">
          {title}
        </DpText>
        <DpText as="strong" size="small">
          {value}
        </DpText>
        {change}
        {sparkline}
      </DpLayout>
    </DpCard>
  );
}

function DashboardCardTitle({
  icon,
  tone,
  children,
  tooltip,
}: {
  icon: ReactNode;
  tone: "blue" | "red";
  children: ReactNode;
  tooltip?: string;
}) {
  return (
    <DpLayout
      direction="row"
      align="center"
      className="mi-dashboard-card-title"
    >
      <DpLayout
        align="center"
        justify="center"
        className={`mi-dashboard-card-icon mi-dashboard-card-icon--${tone}`}
      >
        {icon}
      </DpLayout>
      <DpText as="h2" title={tooltip}>
        {children}
      </DpText>
    </DpLayout>
  );
}

function PlatformMetric({
  platform,
  value,
  change,
  changeSuffix = "",
  changeDecimals = 1,
  sparkline,
  statusLabel,
}: {
  platform: Platform;
  value: string;
  change: number | null;
  changeSuffix?: string;
  changeDecimals?: number;
  sparkline: number[];
  statusLabel?: string;
}) {
  return (
    <DpLayout className={`mi-platform-metric mi-platform-metric--${platform}`}>
      <DpLayout
        direction="row"
        align="center"
        className="mi-platform-metric-label"
      >
        <PlatformIcon platform={platform} size={17} />
        <DpText as="span">{platform === "android" ? "Android" : "iOS"}</DpText>
      </DpLayout>
      <DpText as="strong">{value}</DpText>
      <DpText
        as="span"
        className={`mi-platform-delta ${metricTrendTone(change)}`}
      >
        {statusLabel ??
          (change === null
            ? "비교 불가"
            : `${change > 0 ? "▲" : change < 0 ? "▼" : "—"} ${Math.abs(change).toFixed(changeDecimals)}${changeSuffix}`)}
      </DpText>
      <MetricSparkline
        values={sparkline}
        color={platform === "android" ? "#22A447" : "#8B5CF6"}
      />
    </DpLayout>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="mi-review-stars" aria-label={`5점 만점 중 ${rating}점`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span className={index < rating ? "is-filled" : undefined} key={index}>
          ★
        </span>
      ))}
    </span>
  );
}

function ReviewDevice({
  review,
}: {
  review: DashboardData["reviews"][number];
}) {
  const label = reviewDeviceLabel(review);
  if (!label) return null;
  return (
    <span
      className="mi-review-device"
      title={`작성 단말: ${label}`}
      aria-label={`작성 단말: ${label}`}
    >
      <KoboyoIcon name="phone" size={9} />
      {label}
    </span>
  );
}

export function DashboardShell({ data }: { data: DashboardData }) {
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
  const reviewLoadMoreRef = useRef<HTMLElement | null>(null);
  const [releasePlatform, setReleasePlatform] = useState<Platform | "all">(
    "all",
  );
  const [releaseSearch, setReleaseSearch] = useState("");
  const [timelineScale, setTimelineScale] = useState<
    "week" | "month" | "quarter"
  >("month");
  const dashboardSummary = useMemo(
    () => buildDashboardSummaryForRange(data, dateRange),
    [data, dateRange],
  );
  const overallSummary = useMemo(() => buildOverview(data), [data]);
  const storeRatings = useMemo(() => buildStoreRatingSummary(data), [data]);
  const collectedDownloadTrend = useMemo(() => {
    if (!availableDateRange) return [];
    let total = 0;
    return buildDownloadTrendForRange(data, availableDateRange).flatMap((point) => {
      if (point.total === null) return [];
      total += point.total;
      return [{ date: point.date, total }];
    });
  }, [data, availableDateRange]);
  const cumulativeDownloads = collectedDownloadTrend.map((point) => point.total);
  const crashHistory = useMemo(() => buildCrashHistory(data, dateRange), [data, dateRange]);
  const trend = dashboardSummary.charts.downloads;
  const periodSummary = useMemo(
    () => buildDateRangeSummary(data, dateRange),
    [data, dateRange],
  );
  const ratingTrend = dashboardSummary.charts.ratings;
  const reviewRateTrend = useMemo(
    () => buildReviewRateTrendForRange(data, dateRange),
    [data, dateRange],
  );
  const installLifecycle = useMemo(
    () => buildInstallLifecycleForRange(data, dateRange),
    [data, dateRange],
  );
  const downloadDataStatuses = useMemo(
    () =>
      (["android", "ios"] as Platform[]).flatMap((platform) => {
        const connected =
          platform === "android"
            ? Boolean(data.app.androidPackageName)
            : Boolean(data.app.iosAppId || data.app.iosBundleId);
        if (!connected) return [];
        const status = downloadDataStatusForRange(data, platform, dateRange);
        return status === "available" ? [] : [{ platform, status }];
      }),
    [data, dateRange],
  );
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
  const crashIssueFor = (platform: Platform) => {
    const issue = dashboardSummary.kpis.crashIssues[platform];
    return { ...issue, current: issue.value };
  };
  const platformNegativeReviews = (platform: Platform) => {
    const review = dashboardSummary.kpis.negativeReviews[platform];
    return { current: review.value, change: review.changePoints };
  };
  const androidNegativeReviews = platformNegativeReviews("android");
  const iosNegativeReviews = platformNegativeReviews("ios");
  const deviceTypeLabels: Record<string, string> = {
    phone_tablet: "휴대전화·태블릿",
    wear: "Wear OS",
    tv: "Android TV",
    automotive: "Automotive",
    android_xr: "Android XR",
    google_play_games_pc: "Google Play Games PC",
  };
  const androidDistributionDetail = data.androidDistribution
    ? `배포 폼팩터: ${data.androidDistribution.deviceTypes.map((item) => deviceTypeLabels[item] ?? item).join(", ") || "미수집"} · 휴대전화·태블릿 출시: ${data.androidDistribution.restOfWorld ? "전 세계" : `${data.androidDistribution.countryCodes.length}개 국가`}`
    : "출시 국가·기기 유형 미수집";
  const releaseReferenceDate = new Date(`${latestDate}T00:00:00.000Z`);
  const cadenceReleases = releases.filter(
    (item) => item.releaseDateSource !== "first_observed_at",
  );
  const recentReleaseCount = cadenceReleases.filter((item) => {
    const days =
      (releaseReferenceDate.getTime() - new Date(item.releasedAt).getTime()) /
      86_400_000;
    return days >= 0 && days < 30;
  }).length;
  const releaseIntervals = (["android", "ios"] as Platform[]).flatMap(
    (platform) => {
      const dates = cadenceReleases
        .filter((item) => item.platform === platform)
        .map((item) => new Date(item.releasedAt).getTime());
      return dates
        .slice(0, -1)
        .map((value, index) => Math.abs(value - dates[index + 1]) / 86_400_000);
    },
  );
  const averageReleaseCycle = releaseIntervals.length
    ? releaseIntervals.reduce((sum, value) => sum + value, 0) /
      releaseIntervals.length
    : null;
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
      reviewMatchesRatingGroup(item.rating, reviewRating)
    );
  });
  const dashboardNegativeReviews = useMemo(
    () => latestNegativeReviews(data.reviews),
    [data.reviews],
  );
  const periodReviews = data.reviews.filter((item) => {
    const reviewedAt = item.reviewedAt.slice(0, 10);
    return reviewedAt >= dateRange.startDate && reviewedAt <= dateRange.endDate;
  });
  const vocKeywords = buildVocKeywords(periodReviews);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const visibleReviews =
    view === "reviews"
      ? filteredReviews.slice(0, reviewPage * pageSize)
      : dashboardNegativeReviews;

  useEffect(() => {
    const loadMoreTarget = reviewLoadMoreRef.current;
    if (view !== "reviews" || reviewPage >= totalPages || !loadMoreTarget) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReviewPage((page) => Math.min(page + 1, totalPages));
        }
      },
      { rootMargin: "160px 0px" },
    );
    observer.observe(loadMoreTarget);
    return () => observer.disconnect();
  }, [reviewPage, totalPages, view]);
  const latestSync = (platform: Platform) =>
    data.syncRuns.find(
      (item) => item.platform === platform && item.syncType === "all",
    ) ?? data.syncRuns.find((item) => item.platform === platform);
  const latestOverallSync = data.syncRuns.find(
    (item) => item.syncType === "all",
  );
  const periodLabel = `${dateRangeDays(dateRange)}일`;
  const [title, description] = viewCopy[view];
  const installChartMaximum = Math.max(
    1,
    ...installLifecycle.trend.flatMap((item) => [
      item.installs ?? 0,
      item.uninstalls ?? 0,
    ]),
  );
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
  const ratingDistribution = buildRatingDistribution(periodReviews);
  const reviewCountTrend = trend.map(
    ({ date: pointDate }) =>
      periodReviews.filter(
        (review) => review.reviewedAt.slice(0, 10) === pointDate,
      ).length,
  );

  const nav: Array<[View, string, ReactNode]> = [
    [
      "dashboard",
      "대시보드",
      <KoboyoIcon name="dashboard" size={17} key="dashboard" />,
    ],
    [
      "downloads",
      "다운로드",
      <KoboyoIcon name="download" size={17} key="download" />,
    ],
    [
      "reviews",
      "평점 & 리뷰",
      <KoboyoIcon name="star" size={17} key="review" />,
    ],
    [
      "releases",
      "릴리즈",
      <KoboyoIcon name="rocket" size={17} key="release" />,
    ],
    [
      "impact",
      "릴리즈 임팩트",
      <KoboyoIcon name="bar-chart" size={17} key="impact" />,
    ],
  ];
  const appRows = data.apps.map((app) => {
    const isSelectedApp = app.id === data.app.id;
    const platforms = (["android", "ios"] as Platform[]).filter((platform) =>
      platform === "android"
        ? app.androidPackageName
        : app.iosBundleId || app.iosAppId,
    );
    const latestAppSync = isSelectedApp
      ? (platforms
          .map((platform) => latestSync(platform)?.finishedAt ?? null)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null)
      : null;
    const appStatus = !isSelectedApp
      ? "상태 미수집"
      : platforms.length > 0 &&
          platforms.every(
            (platform) => latestSync(platform)?.status === "success",
          )
        ? "정상"
        : data.syncRuns.length
          ? "확인 필요"
          : "동기화 전";
    return (
      <DpLayout as="article" key={app.id}>
        <DpText as="strong">{app.name}</DpText>
        <DpText as="span" className="mi-app-platforms">
          {platforms.map((platform) => (
            <PlatformIcon key={platform} platform={platform} size={15} />
          ))}
          {platforms
            .map((platform) => (platform === "android" ? "Android" : "iOS"))
            .join(" · ")}
        </DpText>
        <DpText as="code">
          {app.androidPackageName ??
            app.iosBundleId ??
            app.iosAppId ??
            "미설정"}
        </DpText>
        <DpText as="time">{syncDate(latestAppSync)}</DpText>
        <DpBadge>{appStatus}</DpBadge>
      </DpLayout>
    );
  });

  const reviewPanel = (
    <DpCard className="mi-panel mi-review-panel">
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
                  <span className="mi-review-classification">
                    <DpText as="span" className="mi-review-version">
                      {item.version
                        ? `v${item.version.replace(/^v/, "")}`
                        : "버전 정보 없음"}
                    </DpText>
                    {item.aiSentiment && (
                      <span
                        className={`mi-ai-sentiment-badge is-${item.aiSentiment}`}
                      >
                        {item.aiSentiment === "positive" && "긍정"}
                        {item.aiSentiment === "neutral" && "개선"}
                        {item.aiSentiment === "negative" && "불만"}
                      </span>
                    )}
                  </span>
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
                {item.aiTopics && item.aiTopics.length > 0 && (
                  <DpLayout direction="row" className="mi-review-ai-tags">
                    {[...new Set(item.aiTopics)].map((topic) => (
                      <span key={topic} className="mi-ai-topic-chip">
                        #{topic}
                      </span>
                    ))}
                  </DpLayout>
                )}
              </DpLayout>
            </DpLayout>
          ))
        ) : (
          <DpText className="mi-empty">조건에 맞는 리뷰가 없습니다.</DpText>
        )}
      </DpLayout>
      {view === "reviews" && reviewPage < totalPages && (
        <DpLayout
          ref={reviewLoadMoreRef}
          className="mi-review-load-more"
          aria-hidden="true"
        />
      )}
    </DpCard>
  );

  const releaseWorkspace = (
    <DpLayout className="mi-release-workspace">
      <DpLayout as="section" className="mi-release-summary-grid">
        {(
          [
            [
              "최신 Android 버전",
              latestRelease("android")?.version ?? "—",
              latestRelease("android")
                ? `${releaseDate(latestRelease("android")!)} 출시 · ${androidDistributionDetail}`
                : "릴리즈 없음",
              "android",
              <KoboyoIcon name="phone" size={23} key="android" />,
            ],
            [
              "최신 iOS 버전",
              latestRelease("ios")?.version ?? "—",
              latestRelease("ios")
                ? `${releaseDate(latestRelease("ios")!)} 출시`
                : "릴리즈 없음",
              "ios",
              <KoboyoIcon name="package" size={22} key="ios" />,
            ],
            [
              "최근 30일 배포 수",
              `${recentReleaseCount}회`,
              "최초 관측일 제외 · 추정일 포함",
              "deploy",
              <KoboyoIcon name="send" size={22} key="deploy" />,
            ],
            [
              "평균 배포 주기",
              averageReleaseCycle === null
                ? "—"
                : `${averageReleaseCycle.toFixed(1)}일`,
              "최초 관측일 제외 · 플랫폼별 평균",
              "cycle",
              <KoboyoIcon name="clock" size={22} key="cycle" />,
            ],
          ] as const
        ).map(([label, value, detail, tone, icon]) => (
          <DpCard as="article" className="mi-release-summary" key={label}>
            <DpLayout
              align="center"
              justify="center"
              className={`mi-release-summary-icon mi-release-summary-icon--${tone}`}
            >
              {icon}
            </DpLayout>
            <DpLayout>
              <DpText as="span">{label}</DpText>
              <DpLayout direction="row" align="center">
                <DpText as="strong">{value}</DpText>
                {(tone === "android" || tone === "ios") && (
                  <DpBadge className="mi-release-latest-badge">최신</DpBadge>
                )}
              </DpLayout>
              <DpText as="small">{detail}</DpText>
            </DpLayout>
          </DpCard>
        ))}
      </DpLayout>

      <DpCard as="section" className="mi-release-timeline-card">
        <DpLayout
          direction="row"
          align="start"
          justify="between"
          className="mi-release-section-head"
        >
          <DpLayout>
            <DpText as="h3">릴리즈 타임라인</DpText>
            <DpLayout direction="row" className="mi-release-legend">
              <DpText as="span">
                <i className="android" />
                Android
              </DpText>
              <DpText as="span">
                <i className="ios" />
                iOS
              </DpText>
            </DpLayout>
          </DpLayout>
          <DpLayout direction="row" className="mi-release-scale" role="tablist">
            {(["week", "month", "quarter"] as const).map((scale) => (
              <DpButton
                key={scale}
                role="tab"
                aria-selected={timelineScale === scale}
                className={timelineScale === scale ? "is-active" : ""}
                onClick={() => setTimelineScale(scale)}
              >
                {scale === "week" ? "주" : scale === "month" ? "월" : "분기"}
              </DpButton>
            ))}
          </DpLayout>
        </DpLayout>
        {timelineDates.length ? (
          <DpLayout className="mi-release-timeline">
            <div className="mi-release-track" />
            {timelineDates.map(([releasedAt, items]) => (
              <DpLayout
                align="center"
                key={releasedAt}
                className="mi-release-stop"
              >
                <DpLayout className="mi-release-tags">
                  {items.map((item) => (
                    <DpBadge
                      key={item.id}
                      className={`mi-release-tag mi-release-tag--${item.platform}`}
                    >
                      {item.version}
                    </DpBadge>
                  ))}
                </DpLayout>
                <i
                  className={`mi-release-dot mi-release-dot--${items[0].platform}`}
                />
                <DpText as="time">
                  {date(releasedAt).slice(5)}
                  {items.some((item) => item.releaseDateEstimated) && " (추정)"}
                </DpText>
              </DpLayout>
            ))}
          </DpLayout>
        ) : (
          <DpText className="mi-empty">릴리즈 이력이 없습니다.</DpText>
        )}
      </DpCard>

      <DpCard as="section" className="mi-release-table-card">
        <DpLayout
          direction="row"
          align="center"
          justify="between"
          className="mi-release-table-tools"
        >
          <DpLayout
            direction="row"
            className="mi-release-platform-tabs"
            role="tablist"
          >
            {(["all", "android", "ios"] as const).map((platform) => (
              <DpButton
                key={platform}
                role="tab"
                aria-selected={releasePlatform === platform}
                className={releasePlatform === platform ? "is-active" : ""}
                onClick={() => setReleasePlatform(platform)}
              >
                {platform === "all"
                  ? "전체"
                  : platform === "android"
                    ? "Android"
                    : "iOS"}
              </DpButton>
            ))}
          </DpLayout>
          <DpLayout direction="row" className="mi-release-filters">
            <label className="mi-release-search">
              <KoboyoIcon name="search" size={16} />
              <input
                type="search"
                value={releaseSearch}
                onChange={(event) => setReleaseSearch(event.target.value)}
                placeholder="버전, 플랫폼 검색"
              />
            </label>
          </DpLayout>
        </DpLayout>
        <DpLayout className="mi-release-table">
          <DpLayout className="mi-release-table-head">
            <DpText as="span">버전</DpText>
            <DpText as="span">플랫폼</DpText>
            <DpText as="span">출시일</DpText>
            <DpText as="span">변경사항 요약</DpText>
          </DpLayout>
          {filteredReleases.length ? (
            filteredReleases.map((item) => (
              <DpLayout
                as="article"
                key={item.id}
                className="mi-release-table-row"
              >
                <DpLayout direction="row" align="center">
                  <DpLayout>
                    <DpText as="strong">{item.version}</DpText>
                    <DpText as="small">
                      {item.buildNumber
                        ? `build ${item.buildNumber}`
                        : "빌드 식별자 미수집"}
                    </DpText>
                  </DpLayout>
                  {latestRelease(item.platform)?.id === item.id && (
                    <DpBadge className="mi-release-latest-badge">최신</DpBadge>
                  )}
                </DpLayout>
                <DpText
                  as="span"
                  className={`mi-release-platform-pill mi-release-platform-pill--${item.platform}`}
                >
                  <PlatformIcon platform={item.platform} size={14} />
                  {item.platform === "android" ? "Android" : "iOS"}
                </DpText>
                <DpLayout
                  direction="row"
                  align="center"
                  className="mi-quality-group"
                >
                  <DpText as="time">{releaseDate(item)}</DpText>
                </DpLayout>
                <DpText as="span" className="mi-release-notes">
                  {item.releaseNotes?.replace(/[^\S\r\n]+-\s+/g, "\n- ") ??
                    "스토어에 변경사항이 등록되지 않았습니다."}
                </DpText>
              </DpLayout>
            ))
          ) : (
            <DpText className="mi-empty">조건에 맞는 릴리즈가 없습니다.</DpText>
          )}
        </DpLayout>
        <DpLayout
          direction="row"
          align="center"
          justify="between"
          className="mi-release-table-foot"
        >
          <DpText as="span">총 {filteredReleases.length}개 릴리즈</DpText>
          <DpText as="span">최신순</DpText>
        </DpLayout>
      </DpCard>
    </DpLayout>
  );

  const dashboardReviewRows = dashboardSummary.negativeReviewsTop10;
  const dashboardReviewPanel = (
    <DpCard className="mi-panel mi-dashboard-review-panel">
      <DpLayout
        direction="row"
        align="center"
        justify="between"
        className="mi-panel-head mi-dashboard-panel-head"
      >
        <DpText as="h3">부정 리뷰 Top 10</DpText>
        <DpButton
          className="mi-dashboard-link"
          onClick={() => {
            setReviewPlatform("all");
            setReviewRating("negative");
            setReviewPage(1);
            setView("reviews");
          }}
        >
          전체보기 <KoboyoIcon name="arrow-right" size={13} />
        </DpButton>
      </DpLayout>
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
              <DpText as="span" title="스토어 리뷰 원문에 포함된 앱 버전 · 현재 배포 버전과 다를 수 있습니다.">
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

  const dashboardImpactPanel = (
    <DpCard className="mi-panel mi-dashboard-impact-panel">
      <DpLayout
        direction="row"
        align="center"
        justify="between"
        className="mi-panel-head mi-dashboard-panel-head"
      >
        <DpText as="h3">최근 업데이트 후 달라진 점</DpText>
        <DpButton
          className="mi-dashboard-link"
          onClick={() => setView("impact")}
        >
          상세보기 <KoboyoIcon name="arrow-right" size={13} />
        </DpButton>
      </DpLayout>
      {platformImpacts.android || platformImpacts.ios ? (
        <>
          <DpLayout className="mi-dashboard-platform-impact-grid">
            {(["android", "ios"] as Platform[]).map((platform) => {
              const releaseImpact = platformImpacts[platform];
              const crashIssue = crashIssueFor(platform);
              const rows = [
                {
                  label: "평점",
                  current: releaseImpact?.rating.after ?? null,
                  currentSuffix: "",
                  currentDecimals: 2,
                  change: releaseImpact
                    ? displayedDifference(
                        releaseImpact.rating.before,
                        releaseImpact.rating.after,
                        2,
                      )
                    : null,
                  changeSuffix: "",
                  changeDecimals: 2,
                  sparkline: releaseImpact
                    ? [
                        releaseImpact.rating.before,
                        releaseImpact.rating.after,
                      ].flatMap((item) => (item === null ? [] : [item]))
                    : [],
                },
                {
                  label: "부정 리뷰",
                  current: releaseImpact?.negativeReviews.after ?? null,
                  currentSuffix: "%",
                  currentDecimals: 1,
                  change: releaseImpact?.negativeReviews.changePoints ?? null,
                  changeSuffix: "%p",
                  changeDecimals: 1,
                  sparkline: releaseImpact
                    ? [
                        releaseImpact.negativeReviews.before,
                        releaseImpact.negativeReviews.after,
                      ].flatMap((item) => (item === null ? [] : [item]))
                    : [],
                },
                {
                  label: "리뷰 건수",
                  current: releaseImpact?.reviewCount.after ?? null,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: releaseImpact?.reviewCount.change ?? null,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: releaseImpact
                    ? [
                        releaseImpact.reviewCount.before,
                        releaseImpact.reviewCount.after,
                      ].flatMap((item) => (item === null ? [] : [item]))
                    : [],
                },
                {
                  label: "새 크래시",
                  current: crashIssue.current,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: crashIssue.change,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: crashIssue.sparkline,
                },
                {
                  label: "배포 후 신규 다운로드",
                  current: releaseImpact?.downloads.after ?? null,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: releaseImpact?.downloads.change ?? null,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: releaseImpact
                    ? [
                        releaseImpact.downloads.before,
                        releaseImpact.downloads.after,
                      ].flatMap((item) => (item === null ? [] : [item]))
                    : [],
                },
              ];
              return (
                <DpLayout
                  className={`mi-dashboard-impact-platform mi-dashboard-impact-platform--${platform}`}
                  key={platform}
                >
                  <DpLayout
                    direction="row"
                    align="center"
                    className="mi-dashboard-impact-platform-title"
                  >
                    <PlatformIcon platform={platform} size={19} />
                    <DpText as="strong">
                      {platform === "android" ? "Android" : "iOS"}
                    </DpText>
                    <DpLayout className="mi-dashboard-impact-version">
                      {releaseImpact?.release ? (
                        <>
                          <DpText as="b">
                            v{releaseImpact.release.version.replace(/^v/, "")}
                          </DpText>
                          <DpText as="span">
                            {releaseDate(releaseImpact.release)} ~{" "}
                            {date(latestDate)}
                          </DpText>
                        </>
                      ) : (
                        <DpText as="span">버전 정보 없음</DpText>
                      )}
                    </DpLayout>
                  </DpLayout>
                  {rows.map((row) => {
                    return (
                      <DpLayout
                        direction="row"
                        align="center"
                        className="mi-dashboard-impact-row"
                        key={row.label}
                      >
                        <DpText as="span">{row.label}</DpText>
                        <DpLayout
                          direction="row"
                          align="center"
                          className="mi-dashboard-impact-values"
                        >
                          <DpText
                            as="strong"
                            className="mi-dashboard-impact-current"
                          >
                            {row.current === null
                              ? "—"
                              : `${new Intl.NumberFormat("ko-KR", {
                                  minimumFractionDigits: row.currentDecimals,
                                  maximumFractionDigits: row.currentDecimals,
                                }).format(row.current)}${row.currentSuffix}`}
                          </DpText>
                          <DpText
                            as="span"
                            className={metricTrendTone(row.change)}
                          >
                            (
                            {signedDelta(
                              row.change,
                              row.changeDecimals,
                              row.changeSuffix,
                            )}
                            )
                          </DpText>
                        </DpLayout>
                        <MetricSparkline
                          values={row.sparkline}
                          color={releaseImpactSparklineColor(row.change)}
                        />
                      </DpLayout>
                    );
                  })}
                </DpLayout>
              );
            })}
          </DpLayout>
        </>
      ) : (
        <DpText className="mi-empty">표시할 릴리즈가 없습니다.</DpText>
      )}
    </DpCard>
  );

  return (
    <DpLayout as="main" direction="row" className="mi-app-shell">
      <DpLayout as="aside" className="mi-sidebar">
        <DpLayout direction="row" align="center" className="mi-brand">
          <DpLayout direction="row" align="end" className="mi-logo">
            <i />
            <i />
            <i />
          </DpLayout>
          <DpText as="strong">Mobile Insight</DpText>
        </DpLayout>
        <DpLayout className="mi-sidebar-app">
          <AppSelector apps={data.apps} current={data.app.code} />
        </DpLayout>
        <DpLayout as="nav" aria-label="Mobile Insight 메뉴">
          <DpText as="span" className="mi-nav-label">
            성과
          </DpText>
          {nav.map(([key, label, icon]) => (
            <DpButton
              key={key}
              className={view === key ? "is-active" : ""}
              onClick={() => {
                setView(key);
                setReviewPage(1);
              }}
            >
              {icon}
              {label}
            </DpButton>
          ))}
        </DpLayout>
      </DpLayout>
      <DpLayout as="section" className="mi-workspace">
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
            </DpLayout>
          </DpLayout>
          <DpLayout
            direction="row"
            align="center"
            justify="end"
            className="mi-header-tools"
          >
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
        <DpLayout className="mi-content">
          {view === "dashboard" && (
            <>
              <DpLayout as="section" className="mi-dashboard-overall-grid" aria-label="전체 기간 지표">
                <DpCard className="mi-dashboard-kpi-card mi-dashboard-overall-card mi-dashboard-overall-download">
                  <DashboardCardTitle
                    icon={<KoboyoIcon name="download" size={17} />}
                    tone="blue"
                    tooltip="선택 기간과 무관한 수집된 전체 다운로드 합계입니다. 출시 이후 누적 다운로드와 다를 수 있습니다."
                  >
                    총 다운로드
                  </DashboardCardTitle>
                  <DpText as="strong" className="mi-dashboard-download-value">
                    {number(overallSummary.totalDownloads)}
                  </DpText>
                  <DpText className="mi-dashboard-overall-note">수집된 전체 기간 합계 · 날짜 필터 미적용</DpText>
                  {collectedDownloadTrend.length > 0 && (
                    <DpText className="mi-dashboard-overall-note">
                      {date(collectedDownloadTrend[0].date)} ~ {date(collectedDownloadTrend.at(-1)!.date)} · {collectedDownloadTrend.length}일 수집분
                    </DpText>
                  )}
                  <DpLayout direction="row" className="mi-dashboard-overall-platforms">
                    <DpText>Android {overallSummary.androidDownloads === null ? "미수집" : number(overallSummary.androidDownloads)}</DpText>
                    <DpText>iOS {overallSummary.iosDownloads === null ? "미수집" : number(overallSummary.iosDownloads)}</DpText>
                  </DpLayout>
                  <DpLayout className="mi-overall-download-chart" aria-label="수집 기간 누적 다운로드 추이">
                    <MetricSparkline values={cumulativeDownloads} color="#6489EE" smooth={false} singlePoint />
                  </DpLayout>
                </DpCard>
                <DpCard className="mi-dashboard-kpi-card mi-dashboard-overall-card">
                  <DashboardCardTitle
                    icon={<KoboyoIcon name="star" size={17} />}
                    tone="blue"
                    tooltip="Android는 기본 Google Play 평점, iOS는 App Store 평점입니다. Google Play 기본 평점은 전체 기간 단순 평균과 다른 지표입니다."
                  >
                    스토어 평점
                  </DashboardCardTitle>
                  <DpLayout direction="row" className="mi-dashboard-platform-split">
                    {(["android", "ios"] as const).map((platform) => (
                      <DpLayout key={platform} className={`mi-platform-metric mi-platform-metric--${platform}`}>
                        <DpLayout direction="row" align="center" className="mi-platform-metric-label">
                          <PlatformIcon platform={platform} size={17} />
                          <DpText as="span">{platform === "android" ? "Android" : "iOS"}</DpText>
                        </DpLayout>
                        <DpText as="strong">{storeRatings[platform]?.value.toFixed(platform === "android" ? 3 : 2) ?? "—"}</DpText>
                        <DpText as="span" className={`mi-platform-delta ${metricTrendTone(storeRatings[platform]?.change ?? null)}`}
                          title={storeRatings[platform] ? `${date(storeRatings[platform].date)} · ${storeRatings[platform].source === "manual" ? "수동 확인" : "수집 기준"} · 직전 기록 대비` : "미수집"}>
                          {storeRatings[platform]?.change == null ? "—" : `${storeRatings[platform].change > 0 ? "▲" : storeRatings[platform].change < 0 ? "▼" : "—"} ${Math.abs(storeRatings[platform].change).toFixed(2)}`}
                        </DpText>
                        <MetricSparkline values={storeRatings[platform]?.trend ?? []} color={platform === "android" ? "#22A447" : "#8B5CF6"} singlePoint />
                        {storeRatings[platform]?.trend.length === 1 && (
                          <DpText className="mi-dashboard-overall-note">{date(storeRatings[platform].date)} 기록 1건 · 추이 비교 불가</DpText>
                        )}
                      </DpLayout>
                    ))}
                  </DpLayout>
                </DpCard>
              </DpLayout>
              <DpLayout as="section" className="mi-dashboard-kpi-grid">
              <DpCard className="mi-dashboard-kpi-card mi-dashboard-download-card">
                <DashboardCardTitle
                  icon={<KoboyoIcon name="download" size={17} />}
                  tone="blue"
                >
                  최근 {periodLabel} 다운로드
                </DashboardCardTitle>
                <DpText as="strong" className="mi-dashboard-download-value">
                  {number(periodSummary.downloads)}
                </DpText>
                <DpLayout
                  direction="row"
                  align="center"
                  className="mi-dashboard-download-change"
                >
                  <Change
                    value={periodSummary.downloadChangePercent}
                    scope="total"
                  />
                  <DpText as="span">(vs. 이전 {periodLabel})</DpText>
                </DpLayout>
                <MetricSparkline
                  values={trend.flatMap((item) =>
                    item.total === null ? [] : [item.total],
                  )}
                  color="#8993A7"
                />
              </DpCard>
              <DpCard className="mi-dashboard-kpi-card">
                <DashboardCardTitle
                  icon={<KoboyoIcon name="bug" size={18} />}
                  tone="red"
                  tooltip="선택 기간의 스토어 크래시 보고 건수입니다. 같은 오류의 반복 발생을 포함하며, 신규 고유 이슈 수와 다릅니다."
                >
                  크래시 발생 건수
                </DashboardCardTitle>
                <DpLayout
                  direction="row"
                  className="mi-dashboard-platform-split"
                >
                  {(["android", "ios"] as Platform[]).map((platform) => {
                    const crashIssue = crashHistory[platform];
                    return (
                      <PlatformMetric
                        key={platform}
                        platform={platform}
                        value={number(crashIssue.value)}
                        change={crashIssue.change}
                        changeSuffix="건"
                        changeDecimals={0}
                        sparkline={crashHistory.trend.flatMap((point) => point[platform] === null ? [] : [point[platform]])}
                        statusLabel={
                          crashIssue.value === null
                            ? "보고서 데이터 없음"
                            : `${crashIssue.days}일 수집분`
                        }
                      />
                    );
                  })}
                </DpLayout>
              </DpCard>
              <DpCard className="mi-dashboard-kpi-card">
                <DashboardCardTitle
                  icon={<KoboyoIcon name="star" size={17} />}
                  tone="blue"
                >
                  최근 {periodLabel} 평점
                </DashboardCardTitle>
                <DpLayout
                  direction="row"
                  className="mi-dashboard-platform-split"
                >
                  <PlatformMetric
                    platform="android"
                    value={rating(periodSummary.androidRating)}
                    change={periodSummary.androidRatingChange}
                    changeDecimals={2}
                    sparkline={ratingSparklineValues(
                      ratingTrend,
                      "android",
                      periodSummary.androidRating,
                    )}
                  />
                  <PlatformMetric
                    platform="ios"
                    value={rating(periodSummary.iosRating)}
                    change={periodSummary.iosRatingChange}
                    changeDecimals={2}
                    sparkline={ratingSparklineValues(
                      ratingTrend,
                      "ios",
                      periodSummary.iosRating,
                    )}
                  />
                </DpLayout>
              </DpCard>
              <DpCard className="mi-dashboard-kpi-card">
                <DashboardCardTitle
                  icon={<KoboyoIcon name="message-square" size={17} />}
                  tone="red"
                  tooltip="선택 기간에 수집된 플랫폼별 작성 리뷰 중 1~2점 리뷰 수 ÷ 전체 작성 리뷰 수 × 100. 직전 동일 길이 기간과 비교합니다. 별점만 남긴 평가는 포함하지 않습니다."
                >
                  부정 리뷰 비율
                </DashboardCardTitle>
                <DpText className="mi-dashboard-overall-note">{date(dateRange.startDate)} ~ {date(dateRange.endDate)} · 수집 리뷰 중 1~2점</DpText>
                <DpLayout
                  direction="row"
                  className="mi-dashboard-platform-split"
                >
                  <PlatformMetric
                    platform="android"
                    value={percent(androidNegativeReviews.current)}
                    change={androidNegativeReviews.change}
                    changeSuffix="%p"
                    sparkline={dashboardSummary.kpis.negativeReviews.android.sparkline}
                  />
                  <PlatformMetric
                    platform="ios"
                    value={percent(iosNegativeReviews.current)}
                    change={iosNegativeReviews.change}
                    changeSuffix="%p"
                    sparkline={dashboardSummary.kpis.negativeReviews.ios.sparkline}
                  />
                </DpLayout>
              </DpCard>
            </DpLayout>
          </>
        )}
          {view === "dashboard" && <CrashHistory data={data} range={dateRange} />}
          {view === "reviews" && (
            <DpLayout as="section" className="mi-kpi-grid mi-review-kpis">
              <MetricCard
                icon={<KoboyoIcon name="star" size={18} />}
                title="평균 평점 (Android)"
                value={rating(periodSummary.androidRating)}
                change={
                  <Change
                    value={periodSummary.androidRatingChange}
                    suffix=""
                    decimals={2}
                    scope="android"
                  />
                }
                tone="green"
                sparkline={
                  <MetricSparkline
                    values={ratingSparklineValues(
                      ratingTrend,
                      "android",
                      periodSummary.androidRating,
                    )}
                    color="#22A447"
                  />
                }
              />
              <MetricCard
                icon={<KoboyoIcon name="star" size={18} />}
                title="평균 평점 (iOS)"
                value={rating(periodSummary.iosRating)}
                change={
                  <Change
                    value={periodSummary.iosRatingChange}
                    suffix=""
                    decimals={2}
                    scope="ios"
                  />
                }
                tone="violet"
                sparkline={
                  <MetricSparkline
                    values={ratingSparklineValues(
                      ratingTrend,
                      "ios",
                      periodSummary.iosRating,
                    )}
                    color="#8B5CF6"
                  />
                }
              />
              <MetricCard
                icon={<KoboyoIcon name="message-square" size={18} />}
                title="부정 리뷰 비율 (1~2점)"
                value={percent(periodSummary.negativeReviewRate)}
                change={
                  <Change
                    value={periodSummary.negativeReviewRateChangePoints}
                    suffix="%p"
                    scope="total"
                  />
                }
                tone="red"
                sparkline={
                  <MetricSparkline
                    values={reviewRateTrend.flatMap((item) =>
                      item.rate === null ? [] : [item.rate],
                    )}
                    color="#8993A7"
                  />
                }
              />
              <MetricCard
                icon={<KoboyoIcon name="message-square" size={18} />}
                title={
                  data.reviewDataTruncated
                    ? "최근 수집 리뷰 수"
                    : "전체 수집 리뷰 수"
                }
                value={number(data.reviews.length)}
                change={
                  <Change
                    value={periodSummary.reviewCountChange}
                    suffix="건"
                    decimals={0}
                    scope="total"
                  />
                }
                tone="blue"
                sparkline={
                  <MetricSparkline values={reviewCountTrend} color="#8993A7" />
                }
              />
            </DpLayout>
          )}
          {view === "dashboard" && (
            <>
              <DpLayout as="section" className="mi-chart-grid">
                <DpCard className="mi-panel mi-chart-card">
                  <DpLayout
                    direction="row"
                    justify="between"
                    align="center"
                    className="mi-panel-head"
                  >
                    <DpText as="h3">다운로드 추이</DpText>
                  </DpLayout>
                  <DownloadChart
                    data={trend}
                    releases={data.releases}
                    versionMappings={data.releaseVersionMappings}
                  />
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
                {dashboardReviewPanel}
                {dashboardImpactPanel}
              </DpLayout>
            </>
          )}
          {view === "downloads" && (
            <>
              <DpLayout as="section" className="mi-download-summary">
                {[
                  {
                    label: "전체 다운로드",
                    value: periodSummary.downloads,
                    change: periodSummary.downloadChangePercent,
                  },
                  {
                    label: "Android 다운로드",
                    value: periodSummary.androidDownloads,
                    change: periodSummary.androidDownloadChangePercent,
                  },
                  {
                    label: "iOS 다운로드",
                    value: periodSummary.iosDownloads,
                    change: periodSummary.iosDownloadChangePercent,
                  },
                  {
                    label: "순증 설치",
                    value: installLifecycle.totals.net,
                    change: null,
                  },
                ].map(({ label, value, change }) => (
                  <DpCard as="article" key={label}>
                    <DpText as="span">{label}</DpText>
                    <DpText as="strong">{number(value)}</DpText>
                    <Change
                      value={change}
                      comparisonLabel={`직전 ${dateRangeDays(dateRange)}일 대비`}
                    />
                  </DpCard>
                ))}
              </DpLayout>
              <DpLayout as="section" className="mi-download-charts">
                <DpCard className="mi-panel mi-chart-card mi-chart-card--large">
                  <DpLayout
                    direction="row"
                    justify="between"
                    align="start"
                    className="mi-panel-head"
                  >
                    <DpLayout>
                      <DpText as="h3">다운로드 추이</DpText>
                      <DpText>전체 · Android · iOS</DpText>
                    </DpLayout>
                    {downloadDataStatuses.length > 0 && (
                      <DpLayout
                        direction="row"
                        className="mi-data-statuses"
                        aria-live="polite"
                        aria-label="다운로드 데이터 수집 상태"
                      >
                        {downloadDataStatuses.map(({ platform, status }) => (
                          <span
                            key={platform}
                            className={`mi-data-status mi-data-status--${status}`}
                          >
                            <PlatformIcon platform={platform} size={12} />
                            {platform === "android" ? "Android" : "iOS"} ·{
                              status === "missing" ? "데이터 없음" : "수집 지연"
                            }
                          </span>
                        ))}
                      </DpLayout>
                    )}
                  </DpLayout>
                  <DownloadChart
                    data={trend}
                    releases={data.releases}
                    versionMappings={data.releaseVersionMappings}
                  />
                </DpCard>
                <DpCard className="mi-panel mi-install-chart">
                  <DpLayout
                    direction="row"
                    justify="between"
                    align="start"
                    className="mi-panel-head"
                  >
                    <DpLayout>
                      <DpText as="h3">설치 vs 삭제 추이</DpText>
                      <DpText>중앙 0선 기준 · 위: 설치 / 아래: 삭제</DpText>
                    </DpLayout>
                    <DpBadge>일별</DpBadge>
                  </DpLayout>
                  {installLifecycle.trend.length ? (
                    <DpLayout
                      direction="row"
                      align="end"
                      className="mi-install-bars"
                      aria-label="설치 및 삭제 일별 막대 차트"
                    >
                      {installLifecycle.trend.map((item) => (
                        <DpLayout
                          key={item.date}
                          className="mi-install-bar"
                          title={`${item.date} 설치 ${number(item.installs)} / 삭제 ${number(item.uninstalls)}`}
                        >
                          {item.installs !== null && (
                            <i
                              style={{
                                height: `${(item.installs / installChartMaximum) * 44}%`,
                              }}
                            />
                          )}
                          {item.uninstalls !== null && (
                            <b
                              style={{
                                height: `${(item.uninstalls / installChartMaximum) * 44}%`,
                              }}
                            />
                          )}
                        </DpLayout>
                      ))}
                    </DpLayout>
                  ) : (
                    <DpText className="mi-empty">
                      설치·삭제 데이터가 아직 수집되지 않았습니다.
                    </DpText>
                  )}
                  <DpLayout direction="row" className="mi-install-legend">
                    <span>
                      <i />
                      설치 {number(installLifecycle.totals.installs)}
                    </span>
                    <span>
                      <b />
                      삭제 {number(installLifecycle.totals.uninstalls)}
                    </span>
                  </DpLayout>
                  {(data.app.iosAppId || data.app.iosBundleId) && (
                    <DpText as="small">
                      iOS 설치·삭제는 Apple과 진단/사용 데이터를 공유한 사용자
                      기준의 표본입니다.
                    </DpText>
                  )}
                </DpCard>
              </DpLayout>
              <DownloadOsShare android={periodSummary.androidDownloads} ios={periodSummary.iosDownloads} />
              <DownloadModels data={data} range={dateRange} />
              <DpCard className="mi-panel mi-daily-table">
                <DpLayout
                  direction="row"
                  align="center"
                  justify="between"
                  className="mi-panel-head"
                >
                  <DpLayout>
                    <DpText as="h3">일별 다운로드 상세</DpText>
                    <DpText>최근 일자부터 플랫폼별 실적을 확인하세요.</DpText>
                  </DpLayout>
                  <DpButton className="mi-csv-button">
                    <KoboyoIcon name="download" size={14} />
                    CSV 다운로드
                  </DpButton>
                </DpLayout>
                <DpLayout className="mi-table-head">
                  <DpText as="span">날짜</DpText>
                  <DpText as="span">Android</DpText>
                  <DpText as="span">iOS</DpText>
                  <DpText as="span">합계</DpText>
                  <DpText as="span">vs 이전일</DpText>
                </DpLayout>
                {[...trend]
                  .reverse()
                  .slice(0, 5)
                  .map((item, index, rows) => {
                    const previous = rows[index + 1]?.total ?? item.total;
                    const dailyChange =
                      item.total !== null && previous != null && previous !== 0
                        ? ((item.total - previous) / previous) * 100
                        : null;
                    return (
                      <DpLayout
                        as="article"
                        className="mi-table-row"
                        key={item.date}
                      >
                        <DpText as="span">{date(item.date)}</DpText>
                        <DpText as="span">{number(item.android)}</DpText>
                        <DpText as="span">{number(item.ios)}</DpText>
                        <DpText as="strong">{number(item.total)}</DpText>
                        <Change value={dailyChange} />
                      </DpLayout>
                    );
                  })}
              </DpCard>
            </>
          )}
          {view === "reviews" && (
            <>
              <ReviewRatingSummary reviews={periodReviews} periodLabel={periodLabel} />
              <DpLayout className="mi-rating-distributions">
                {ratingDistribution.map(({ platform, rows, total }) => (
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
                        <DpText>
                          최근 {periodLabel} · 리뷰 {number(total)}건
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
                        <DpLayout
                          direction="row"
                          align="center"
                          key={row.score}
                        >
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
                <DpCard className="mi-voc-summary">
                  <DpLayout
                    direction="row"
                    align="center"
                    justify="between"
                    className="mi-panel-head"
                  >
                    <DpLayout>
                      <DpText as="h3">VOC 키워드 요약</DpText>
                      <DpText>부정 리뷰(1~2점) 기반 주요 불만 키워드</DpText>
                    </DpLayout>
                    <DpBadge>전체</DpBadge>
                  </DpLayout>
                  <DpLayout direction="row" className="mi-voc-chips">
                    {vocKeywords.map(({ label, count }) => (
                      <DpBadge key={label}>
                        {label} <small>{count}</small>
                      </DpBadge>
                    ))}
                  </DpLayout>
                  <DpLayout
                    direction="row"
                    align="center"
                    justify="between"
                    className="mi-voc-total"
                  >
                    <DpText>전체 부정 리뷰 수</DpText>
                    <DpText as="strong">
                      {number(
                        periodReviews.filter((review) => review.rating <= 2)
                          .length,
                      )}
                    </DpText>
                  </DpLayout>
                </DpCard>
              </DpLayout>
              {reviewPanel}
            </>
          )}
          {view === "releases" && releaseWorkspace}
          {view === "impact" && <ReleaseImpactWorkspace data={data} />}
          {view === "apps" && (
            <>
              <DpLayout as="section" className="mi-app-summary-grid">
                {[
                  ["등록 앱 수", `${data.apps.length}`, "전체 활성 앱"],
                  [
                    "연결된 스토어",
                    `${connectedPlatforms.length}`,
                    connectedPlatforms
                      .map((item) =>
                        item === "android" ? "Google Play" : "App Store",
                      )
                      .join(", ") || "연결 없음",
                  ],
                  [
                    "최근 동기화 상태",
                    syncDate(latestOverallSync?.finishedAt ?? null),
                    latestOverallSync
                      ? `선택 앱 ${latestOverallSync.status}`
                      : "동기화 기록 없음",
                  ],
                  [
                    "정상 연동 비율",
                    connectionRatio === null
                      ? "—"
                      : `${connectionRatio.toFixed(0)}%`,
                    `${healthyPlatforms.length} / ${connectedPlatforms.length} 스토어 정상 연동`,
                  ],
                ].map(([label, value, detail]) => (
                  <DpCard as="article" key={label}>
                    <DpText as="span">{label}</DpText>
                    <DpText as="strong">{value}</DpText>
                    <DpText as="small">{detail}</DpText>
                  </DpCard>
                ))}
              </DpLayout>
              <DpCard className="mi-panel mi-app-panel">
                <DpLayout
                  direction="row"
                  align="center"
                  justify="between"
                  className="mi-panel-head"
                >
                  <DpLayout>
                    <DpText as="h3">
                      앱 목록 <small>{data.apps.length}</small>
                    </DpText>
                    <DpText>등록 앱과 스토어 데이터 연결 상태입니다.</DpText>
                  </DpLayout>
                  <DpButton className="mi-add-app">앱 추가 +</DpButton>
                </DpLayout>
                <DpLayout className="mi-app-table">
                  <DpLayout className="mi-app-table-head">
                    <DpText as="span">앱 이름</DpText>
                    <DpText as="span">플랫폼</DpText>
                    <DpText as="span">식별자</DpText>
                    <DpText as="span">최근 동기화</DpText>
                    <DpText as="span">상태</DpText>
                  </DpLayout>
                  {appRows}
                </DpLayout>
              </DpCard>
              <DpCard className="mi-panel mi-connections">
                <DpLayout className="mi-panel-head">
                  <DpText as="h3">스토어 연결 관리</DpText>
                  <DpText>
                    스토어 계정을 연결하여 앱 데이터를 자동으로 동기화하세요.
                  </DpText>
                </DpLayout>
                {[
                  [
                    "Google Play Console",
                    data.app.androidPackageName,
                    "android",
                  ],
                  [
                    "App Store Connect",
                    data.app.iosBundleId ?? data.app.iosAppId,
                    "ios",
                  ],
                ].map(([service, identifier, platform]) => (
                  <DpLayout
                    as="article"
                    direction="row"
                    align="center"
                    key={service}
                  >
                    <DpText as="strong">{service}</DpText>
                    <DpText as="span">{identifier ?? "식별자 미설정"}</DpText>
                    <DpBadge>
                      {identifier
                        ? (latestSync(platform as Platform)?.status ??
                          "동기화 전")
                        : "미연동"}
                    </DpBadge>
                    <DpButton>관리</DpButton>
                  </DpLayout>
                ))}
              </DpCard>
            </>
          )}
        </DpLayout>
      </DpLayout>
    </DpLayout>
  );
}
