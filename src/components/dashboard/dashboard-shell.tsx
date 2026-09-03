"use client";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LayoutDashboard,
  MessageSquareText,
  Minus,
  PackageOpen,
  Rocket,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Star,
  Triangle,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { AppSelector } from "@/components/dashboard/app-selector";
import { DownloadChart } from "@/components/dashboard/download-chart";
import { MetricSparkline } from "@/components/dashboard/metric-sparkline";
import { PlatformIcon } from "@/components/dashboard/platform-icon";
import { RatingChart } from "@/components/dashboard/rating-chart";
import { ReleaseImpactWorkspace } from "@/components/dashboard/release-impact-workspace";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import {
  latestNegativeReviews,
  reviewAuthorLabel,
  reviewTimeLabel,
} from "@/domain/reviews/review.service";
import type { DashboardData, MetricQuality, Platform } from "@/domain/types";
import {
  buildDownloadTrend,
  buildInstallLifecycle,
  buildPeriodSummary,
  buildRatingDistribution,
  buildRatingTrend,
  buildReleaseImpact,
  buildReviewRateTrend,
  buildVocKeywords,
  classifyVersionChange,
  compareVersionsDescending,
  metricQualityForPeriod,
  periodStart,
  reviewMatchesPeriod,
  reviewMatchesRatingGroup,
  reviewQualityForPeriod,
  selectLatestMatureRelease,
  type Period,
  type ReviewPeriod,
  type ReviewRatingGroup,
} from "@/services/mobile";

type View =
  "dashboard" | "downloads" | "reviews" | "releases" | "impact" | "apps";

const viewCopy: Record<View, [string, string]> = {
  dashboard: ["대시보드", "앱의 주요 성과를 한눈에 확인하세요."],
  downloads: ["다운로드", "앱의 다운로드 추이와 설치 데이터를 확인하세요."],
  reviews: ["평점 & 리뷰", "앱의 평점과 리뷰 데이터를 종합적으로 확인하세요."],
  releases: ["릴리즈", "앱의 버전 배포 현황과 변경사항을 한눈에 확인하세요."],
  impact: ["릴리즈 임팩트", "특정 버전의 배포 전후 성과 변화를 한눈에 분석하세요."],
  apps: ["앱 관리", "연결된 앱과 스토어를 관리하고 동기화 상태를 확인하세요."],
};

const periods: Array<{ value: Period; label: string }> = [
  { value: "7d", label: "7일" },
  { value: "28d", label: "28일" },
  { value: "3m", label: "90일" },
];

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
const percentChange = (before: number | null, after: number | null) =>
  before === null || after === null || before === 0
    ? null
    : ((after - before) / before) * 100;
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
}: {
  value: number | null;
  suffix?: string;
  decimals?: number;
  comparisonLabel?: string;
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
    <DpText as="span" className={`mi-change ${tone}`}>
      <span className="mi-change-icon" aria-hidden="true">
        {value === 0 ? (
          <Minus size={9} color="currentColor" strokeWidth={2.5} />
        ) : (
          <Triangle
            size={8}
            color="currentColor"
            fill="currentColor"
            strokeWidth={0}
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
  quality,
  qualityLabel,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  change: ReactNode;
  tone: string;
  sparkline: ReactNode;
  quality: MetricQuality;
  qualityLabel?: string;
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
        <DpLayout direction="row" align="center" justify="between">
          <DpText as="span" size="small">{title}</DpText>
          <QualityBadge quality={quality} label={qualityLabel} />
        </DpLayout>
        <DpText as="strong" size="small">{value}</DpText>
        {change}
        {sparkline}
      </DpLayout>
    </DpCard>
  );
}

const qualityLabels: Record<MetricQuality, string> = {
  exact: "실측",
  estimated: "추정",
  derived: "가공",
  unavailable: "미수집",
};

function QualityBadge({ quality, label }: { quality: MetricQuality; label?: string }) {
  return (
    <DpBadge className={`mi-quality-badge mi-quality-badge--${quality}`}>
      {label ?? qualityLabels[quality]}
    </DpBadge>
  );
}

function PeriodTabs({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) {
  return (
    <DpLayout direction="row" className="mi-tabs" role="tablist">
      {periods.map((item) => (
        <DpButton
          key={item.value}
          role="tab"
          aria-selected={value === item.value}
          className={value === item.value ? "is-active" : ""}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </DpButton>
      ))}
    </DpLayout>
  );
}

export function DashboardShell({ data }: { data: DashboardData }) {
  const [view, setView] = useState<View>("dashboard");
  const [period, setPeriod] = useState<Period>("28d");
  const [reviewPlatform, setReviewPlatform] = useState<Platform | "all">("all");
  const [reviewRating, setReviewRating] = useState<ReviewRatingGroup>("all");
  const [reviewPeriod, setReviewPeriod] = useState<ReviewPeriod>("all");
  const [reviewPage, setReviewPage] = useState(1);
  const [releasePlatform, setReleasePlatform] = useState<Platform | "all">(
    "all",
  );
  const [releaseType, setReleaseType] = useState<
    "all" | "major" | "minor" | "patch"
  >("all");
  const [releaseSearch, setReleaseSearch] = useState("");
  const [timelineScale, setTimelineScale] = useState<
    "week" | "month" | "quarter"
  >("month");
  const trend = useMemo(() => buildDownloadTrend(data, period), [data, period]);
  const periodSummary = useMemo(
    () => buildPeriodSummary(data, period),
    [data, period],
  );
  const ratingTrend = useMemo(
    () => buildRatingTrend(data, period),
    [data, period],
  );
  const reviewRateTrend = useMemo(
    () => buildReviewRateTrend(data, period),
    [data, period],
  );
  const installLifecycle = useMemo(
    () => buildInstallLifecycle(data, period),
    [data, period],
  );
  const releases = useMemo(
    () =>
      [...data.releases].sort((a, b) =>
        b.releasedAt.localeCompare(a.releasedAt) ||
        compareVersionsDescending(a.version, b.version),
      ),
    [data.releases],
  );
  const selectedRelease = selectLatestMatureRelease(data);
  const impact = selectedRelease
    ? buildReleaseImpact(
        data,
        selectedRelease.version,
        selectedRelease.platform,
      )
    : null;
  const latestDate = data.metrics.reduce(
    (latest, metric) => metric.date > latest ? metric.date : latest,
    "",
  ) || new Date().toISOString().slice(0, 10);
  const firstDate = periodStart(period, latestDate);
  const qualityFor = (
    metricKeys: string[],
    platform?: Platform,
  ): MetricQuality => metricQualityForPeriod(data, period, metricKeys, platform);
  const androidDownloadQuality = qualityFor(["daily_user_installs"], "android");
  const iosDownloadQuality = qualityFor(["total_downloads"], "ios");
  const connectedDownloadQualities = [
    ...(data.app.androidPackageName ? [androidDownloadQuality] : []),
    ...(data.app.iosAppId || data.app.iosBundleId ? [iosDownloadQuality] : []),
  ];
  const downloadQuality: MetricQuality = connectedDownloadQualities.includes("unavailable")
    ? "unavailable"
    : connectedDownloadQualities.includes("estimated")
      ? "estimated"
      : connectedDownloadQualities.includes("derived")
        ? "derived"
        : connectedDownloadQualities.length ? "exact" : "unavailable";
  const androidRatingQuality: MetricQuality = data.source === "demo" ? "derived" : (data.ratingSnapshots ?? []).some(
    (item) => item.platform === "android" && item.date >= firstDate,
  )
    ? "exact"
    : "unavailable";
  const iosRatingQuality: MetricQuality =
    data.source === "demo" ? "derived" : (data.ratingSnapshots ?? [])
      .filter((item) => item.platform === "ios" && item.date >= firstDate)
      .at(-1)?.quality ?? "unavailable";
  const reviewQuality = reviewQualityForPeriod(data, period);
  const latestRelease = (platform: Platform) =>
    releases.find((item) => item.platform === platform) ?? null;
  const previousVersion = (release: DashboardData["releases"][number]) => {
    const platformReleases = releases.filter(
      (item) => item.platform === release.platform,
    );
    const index = platformReleases.findIndex((item) => item.id === release.id);
    return index < 0 ? null : platformReleases[index + 1]?.version ?? null;
  };
  const releaseKind = (release: DashboardData["releases"][number]) =>
    classifyVersionChange(release.version, previousVersion(release));
  const releaseKindLabel = (release: DashboardData["releases"][number]) => {
    const labels = { major: "Major", minor: "Minor", patch: "Patch", unknown: "분류 불가" };
    return labels[releaseKind(release)];
  };
  const releaseDeliveryLabel = (release: DashboardData["releases"][number]) => {
    if (release.platform === "android") {
      return release.track === "production"
        ? "Production"
        : release.track ?? "Production";
    }
    return "App Store";
  };
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
       (releaseType === "all" || releaseKind(item) === releaseType) &&
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
  const filteredReviews = data.reviews.filter(
    (item) =>
      reviewMatchesPeriod(item.reviewedAt, reviewPeriod, latestDate) &&
      (reviewPlatform === "all" || item.platform === reviewPlatform) &&
      reviewMatchesRatingGroup(item.rating, reviewRating),
  );
  const dashboardNegativeReviews = useMemo(
    () => latestNegativeReviews(data.reviews),
    [data.reviews],
  );
  const periodReviews = data.reviews.filter(
    (item) => item.reviewedAt.slice(0, 10) >= periodStart(period, latestDate),
  );
  const vocKeywords = buildVocKeywords(periodReviews);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const visibleReviews =
    view === "reviews"
      ? filteredReviews.slice(
          (reviewPage - 1) * pageSize,
          reviewPage * pageSize,
        )
      : dashboardNegativeReviews;
  const latestSync = (platform: Platform) =>
    data.syncRuns.find(
      (item) => item.platform === platform && item.syncType === "all",
    ) ?? data.syncRuns.find((item) => item.platform === platform);
  const latestOverallSync = data.syncRuns.find(
    (item) => item.syncType === "all",
  );
  const periodLabel =
    periods.find((item) => item.value === period)?.label ?? "7일";
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
    ["dashboard", "대시보드", <LayoutDashboard size={17} key="dashboard" />],
    ["downloads", "다운로드", <Download size={17} key="download" />],
    ["reviews", "평점 & 리뷰", <Star size={17} key="review" />],
    ["releases", "릴리즈", <Rocket size={17} key="release" />],
    ["impact", "릴리즈 임팩트", <BarChart3 size={17} key="impact" />],
    ["apps", "앱 관리", <Settings size={17} key="apps" />],
  ];
  const appRows = data.apps.map((app) => {
    const isSelectedApp = app.id === data.app.id;
    const platforms = (["android", "ios"] as Platform[]).filter((platform) =>
      platform === "android"
        ? app.androidPackageName
        : app.iosBundleId || app.iosAppId,
    );
    const latestAppSync = isSelectedApp ? platforms
      .map((platform) => latestSync(platform)?.finishedAt ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null : null;
    const appStatus = !isSelectedApp
      ? "상태 미수집"
      : platforms.length > 0 &&
          platforms.every((platform) => latestSync(platform)?.status === "success")
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
          {platforms.map((platform) => platform === "android" ? "Android" : "iOS").join(" · ")}
        </DpText>
        <DpText as="code">
          {app.androidPackageName ?? app.iosBundleId ?? app.iosAppId ?? "미설정"}
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
          <DpText as="h3">{view === "dashboard" ? "부정 리뷰" : "최근 리뷰"}</DpText>
        </DpLayout>
        {view === "dashboard" ? (
          <DpButton
            className="mi-review-more"
            onClick={() => {
              setReviewPlatform("all");
              setReviewRating("negative");
              setReviewPeriod("all");
              setReviewPage(1);
              setView("reviews");
            }}
          >
            더보기
          </DpButton>
        ) : (
          <DpBadge>{filteredReviews.length}건</DpBadge>
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
          {(["all", "negative", "neutral", "positive"] as const).map(
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
                  : value === "negative"
                    ? "1~2점"
                    : value === "neutral"
                      ? "3점"
                      : "4~5점"}
              </DpButton>
            ),
          )}
          <DpText as="span">기간</DpText>
          {(["all", "7d", "30d", "3m"] as const).map((value) => (
            <DpButton
              key={value}
              className={reviewPeriod === value ? "is-active" : ""}
              onClick={() => {
                setReviewPeriod(value);
                setReviewPage(1);
              }}
            >
              {value === "all" ? "전체" : value.toUpperCase()}
            </DpButton>
          ))}
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
                  <span className="mi-review-stars" aria-label={`${item.rating}점`}>
                    <DpText as="strong">{"★".repeat(item.rating)}</DpText>
                    <DpText as="span">{"★".repeat(5 - item.rating)}</DpText>
                  </span>
                  <DpText as="span" className="mi-review-version">
                    {item.version
                      ? `v${item.version.replace(/^v/, "")}`
                      : "버전 정보 없음"}
                  </DpText>
                  <DpText
                    as="time"
                    dateTime={item.reviewedAt}
                    suppressHydrationWarning
                  >
                    {reviewTimeLabel(item.reviewedAt)}
                  </DpText>
                </DpLayout>
                <DpText className="mi-review-copy">{item.content}</DpText>
              </DpLayout>
            </DpLayout>
          ))
        ) : (
          <DpText className="mi-empty">조건에 맞는 리뷰가 없습니다.</DpText>
        )}
      </DpLayout>
      {view === "reviews" && (
        <DpLayout
          direction="row"
          align="center"
          justify="center"
          className="mi-pagination"
        >
          <DpButton
            aria-label="이전 페이지"
            disabled={reviewPage === 1}
            onClick={() => setReviewPage((page) => page - 1)}
          >
            <ChevronLeft size={16} />
          </DpButton>
          <DpText as="span">
            {reviewPage} / {totalPages}
          </DpText>
          <DpButton
            aria-label="다음 페이지"
            disabled={reviewPage === totalPages}
            onClick={() => setReviewPage((page) => page + 1)}
          >
            <ChevronRight size={16} />
          </DpButton>
        </DpLayout>
      )}
    </DpCard>
  );

  const releasePanel = (
    <DpCard className="mi-panel">
      <DpLayout
        className={`mi-panel-head${
          view === "dashboard" ? " mi-panel-head--compact" : ""
        }`}
      >
        <DpText as="h3">
          {view === "releases" ? "릴리즈" : "릴리즈 현황"}
        </DpText>
        <DpText>
          {view === "releases"
            ? "앱 버전별 업데이트 정보와 배포 이력을 확인하세요."
            : "최근 플랫폼별 앱 버전입니다."}
        </DpText>
      </DpLayout>
      {view === "releases" && (
        <DpLayout direction="row" className="mi-release-table-head">
          <DpText as="span">버전</DpText>
          <DpText as="span">플랫폼</DpText>
          <DpText as="span">출시일</DpText>
          <DpText as="span">변경사항</DpText>
          <DpText as="span">작업</DpText>
        </DpLayout>
      )}
      <DpLayout className="mi-release-list">
        {releases
          .slice(0, view === "releases" ? releases.length : 5)
          .map((item, index) => (
            <DpLayout
              as="article"
              direction="row"
              align="center"
              key={item.id}
              className="mi-release-row"
            >
              <DpLayout
                align="center"
                justify="center"
                className={`mi-platform mi-platform--${item.platform}`}
              >
                <PlatformIcon platform={item.platform} />
              </DpLayout>
              <DpLayout className="flex-1">
                <DpText as="strong">{item.version}</DpText>
                <DpText as="small">
                  {item.platform === "android" ? "Android" : "iOS"}
                  {item.buildNumber ? ` · build ${item.buildNumber}` : ""}
                </DpText>
              </DpLayout>
              {index < 2 && <DpBadge>최신</DpBadge>}
              <QualityBadge quality={item.releaseDateEstimated ? "estimated" : "exact"} />
              <DpText as="time">{releaseDate(item)}</DpText>
              {view === "releases" && (
                <DpText className="mi-release-note">
                  {item.releaseNotes ?? "스토어에 변경사항이 등록되지 않았습니다."}
                </DpText>
              )}
            </DpLayout>
          ))}
      </DpLayout>
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
                ? `${releaseDate(latestRelease("android")!)} 출시`
                : "릴리즈 없음",
              "android",
              <Smartphone size={23} key="android" />,
            ],
            [
              "최신 iOS 버전",
              latestRelease("ios")?.version ?? "—",
              latestRelease("ios")
                ? `${releaseDate(latestRelease("ios")!)} 출시`
                : "릴리즈 없음",
              "ios",
              <PackageOpen size={22} key="ios" />,
            ],
            [
              "최근 30일 배포 수",
              `${recentReleaseCount}회`,
              "최초 관측일 제외 · 추정일 포함",
              "deploy",
              <Send size={22} key="deploy" />,
            ],
            [
              "평균 배포 주기",
              averageReleaseCycle === null
                ? "—"
                : `${averageReleaseCycle.toFixed(1)}일`,
              "최초 관측일 제외 · 플랫폼별 평균",
              "cycle",
              <Clock3 size={22} key="cycle" />,
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
                  <DpBadge>최신</DpBadge>
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
            <label className="mi-release-type-filter">
              <SlidersHorizontal size={15} />
              <select
                aria-label="변경 유형"
                value={releaseType}
                onChange={(event) =>
                  setReleaseType(event.target.value as typeof releaseType)
                }
              >
                <option value="all">전체 변경 유형</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="patch">Patch</option>
              </select>
            </label>
            <label className="mi-release-search">
              <Search size={16} />
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
            <DpText as="span">플랫폼 · 배포</DpText>
            <DpText as="span">출시일</DpText>
            <DpText as="span">변경 유형</DpText>
            <DpText as="span">변경사항 요약</DpText>
            <DpText as="span">상태</DpText>
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
                    <DpBadge>최신</DpBadge>
                  )}
                </DpLayout>
                <DpText
                  as="span"
                  className={`mi-release-platform-pill mi-release-platform-pill--${item.platform}`}
                >
                  <PlatformIcon platform={item.platform} size={14} />
                  {item.platform === "android" ? "Android" : "iOS"}
                  <small>{releaseDeliveryLabel(item)}</small>
                </DpText>
                <DpLayout direction="row" align="center" className="mi-quality-group">
                  <DpText as="time">{releaseDate(item)}</DpText>
                  <QualityBadge quality={item.releaseDateEstimated ? "estimated" : "exact"} />
                </DpLayout>
                <DpBadge
                  className={`mi-release-kind mi-release-kind--${releaseKind(item)}`}
                >
                  {releaseKindLabel(item)}
                </DpBadge>
                <DpText as="span" className="mi-release-notes">
                  {item.releaseNotes ?? "스토어에 변경사항이 등록되지 않았습니다."}
                </DpText>
                <DpText as="span" className="mi-release-complete">
                  <CheckCircle2 size={15} />
                  {item.phasedReleaseState === "ACTIVE"
                    ? `단계 배포 ${item.phasedReleaseDay ?? "—"}일차`
                    : item.rolloutFraction != null
                      ? `배포 ${(item.rolloutFraction * 100).toFixed(0)}%`
                      : item.status?.replaceAll("_", " ") ?? "상태 미수집"}
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

  const impactRows = impact
    ? [
        {
          label: "다운로드",
          before: number(impact.downloads.before),
          after: number(impact.downloads.after),
          change:
            impact.downloads.before === null || impact.downloads.after === null
              ? null
              : impact.downloads.after - impact.downloads.before,
          changeSuffix: "",
          changePercent: impact.downloads.changePercent,
          improvesWhenDecreasing: false,
        },
        {
          label: "평균 평점",
          before: rating(impact.rating.before),
          after: rating(impact.rating.after),
          change: displayedDifference(
            impact.rating.before,
            impact.rating.after,
            2,
          ),
          changeSuffix: "",
          changePercent: percentChange(
            impact.rating.before,
            impact.rating.after,
          ),
          improvesWhenDecreasing: false,
        },
        {
          label: "부정 리뷰 비율",
          before:
            impact.negativeReviews.before === null
              ? "—"
              : `${impact.negativeReviews.before.toFixed(1)}%`,
          after:
            impact.negativeReviews.after === null
              ? "—"
              : `${impact.negativeReviews.after.toFixed(1)}%`,
          change: displayedDifference(
            impact.negativeReviews.before,
            impact.negativeReviews.after,
            1,
          ),
          changeSuffix: "%p",
          changePercent: percentChange(
            impact.negativeReviews.before,
            impact.negativeReviews.after,
          ),
          improvesWhenDecreasing: true,
        },
        {
          label: "신규 리뷰",
          before: `${number(impact.newReviews.before)}건`,
          after: `${number(impact.newReviews.after)}건`,
          change: impact.newReviews.after - impact.newReviews.before,
          changeSuffix: "건",
          changePercent: impact.newReviews.changePercent,
          improvesWhenDecreasing: false,
        },
      ]
    : [];

  const impactPanel = (
    <DpCard
      className={`mi-panel mi-impact-panel ${view === "impact" ? "mi-impact-panel--detail" : ""}`}
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
            {view === "impact" ? "주요 지표 변화" : "릴리즈 임팩트"}
          </DpText>
          <DpText>배포일을 제외한 전후 7일을 같은 기준으로 비교합니다.</DpText>
        </DpLayout>
      </DpLayout>
      {impact && selectedRelease ? (
        <>
          <DpLayout direction="row" align="center" className="mi-impact-meta">
            <DpText as="strong">
              v{selectedRelease.version.replace(/^v/, "")}
            </DpText>
            <DpBadge>
              {selectedRelease.platform === "android" ? "Android" : "iPhone"}
            </DpBadge>
            <DpText as="span">{releaseDate(selectedRelease)} 배포</DpText>
          </DpLayout>
          <DpLayout className="mi-impact-periods">
            <DpLayout>
              <DpText as="span">배포 전 7일</DpText>
              <DpText as="strong">
                {date(impact.windows.before.from)} ~{" "}
                {date(impact.windows.before.to)}
              </DpText>
            </DpLayout>
            <DpText as="b">VS</DpText>
            <DpLayout>
              <DpText as="span">배포 후 7일</DpText>
              <DpText as="strong">
                {date(impact.windows.after.from)} ~{" "}
                {date(impact.windows.after.to)}
              </DpText>
            </DpLayout>
          </DpLayout>
          <DpLayout className="mi-impact-table-wrap">
            <DpLayout className="mi-impact-table-head">
              <DpText as="span">지표</DpText>
              <DpText as="span">배포 전</DpText>
              <DpText as="span">배포 후</DpText>
              <DpText as="span">변화량</DpText>
              <DpText as="span">변화율</DpText>
            </DpLayout>
            {impactRows.map((row) => {
              const good =
                row.change === null
                  ? null
                  : row.improvesWhenDecreasing
                    ? row.change <= 0
                    : row.change >= 0;
              return (
                <DpLayout
                  as="article"
                  className="mi-impact-table-row"
                  key={row.label}
                >
                  <DpText as="strong">{row.label}</DpText>
                  <DpText as="span">{row.before}</DpText>
                  <DpText as="span">{row.after}</DpText>
                  <DpText
                    as="span"
                    className={
                      good === null
                        ? "is-muted"
                        : good
                          ? "is-positive"
                          : "is-negative"
                    }
                  >
                    {signedDelta(
                      row.change,
                      row.changeSuffix === "%p" || row.label === "평균 평점"
                        ? 2
                        : 0,
                      row.changeSuffix,
                    )}
                  </DpText>
                  <Change value={row.changePercent} />
                </DpLayout>
              );
            })}
          </DpLayout>
        </>
      ) : (
        <DpText className="mi-empty">비교 가능한 릴리즈가 없습니다.</DpText>
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
          {nav.slice(0, 5).map(([key, label, icon]) => (
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
          <DpText as="span" className="mi-nav-label">
            설정
          </DpText>
          {nav.slice(5).map(([key, label, icon]) => (
            <DpButton
              key={key}
              className={view === key ? "is-active" : ""}
              onClick={() => setView(key)}
            >
              {icon}
              {label}
            </DpButton>
          ))}
        </DpLayout>
        <DpLayout direction="row" align="center" className="mi-sidebar-user">
          <ChevronLeft size={14} />
          <DpText as="span">메뉴 접기</DpText>
        </DpLayout>
      </DpLayout>
      <DpLayout as="section" className="mi-workspace">
        <DpLayout as="header" direction="row" align="center" justify="between" className="mi-header">
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
              <DpLayout
                direction="row"
                align="center"
                className="mi-global-period"
              >
                <PeriodTabs value={period} onChange={setPeriod} />
                <DpLayout
                  direction="row"
                  align="center"
                  className="mi-date"
                  aria-live="polite"
                >
                  <CalendarDays size={16} />
                  <DpText as="span">
                    {date(firstDate)} ~ {date(latestDate)} ({periodLabel})
                  </DpText>
                </DpLayout>
              </DpLayout>
            )}
          </DpLayout>
        </DpLayout>
        <DpLayout className="mi-content">
          {view === "dashboard" && (
            <DpLayout as="section" className="mi-kpi-grid">
              <MetricCard
                icon={<Download size={16} />}
                title="다운로드"
                value={number(periodSummary.downloads)}
                change={
                  <Change
                    value={periodSummary.downloadChangePercent}
                    comparisonLabel={`이전 ${periodLabel} 대비`}
                  />
                }
                tone="blue"
                quality={downloadQuality}
                qualityLabel={data.source === "database" && downloadQuality === "derived" ? "부분" : undefined}
                sparkline={
                  <MetricSparkline
                    values={trend.flatMap((item) => item.total === null ? [] : [item.total])}
                    color="#4C73EC"
                  />
                }
              />
              <MetricCard
                icon={<Star size={16} />}
                title="평균 평점 (Android)"
                value={rating(periodSummary.androidRating)}
                change={
                  <Change
                    value={periodSummary.androidRatingChange}
                    suffix=""
                    decimals={2}
                  />
                }
                tone="green"
                quality={androidRatingQuality}
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
                icon={<Star size={16} />}
                title="평균 평점 (iOS)"
                value={rating(periodSummary.iosRating)}
                change={
                  <Change
                    value={periodSummary.iosRatingChange}
                    suffix=""
                    decimals={2}
                  />
                }
                tone="violet"
                quality={iosRatingQuality}
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
                icon={<MessageSquareText size={16} />}
                title="부정 리뷰 비율 (1~2점)"
                value={percent(periodSummary.negativeReviewRate)}
                change={
                  <Change
                    value={periodSummary.negativeReviewRateChangePoints}
                    suffix="%p"
                  />
                }
                tone="red"
                quality={reviewQuality}
                sparkline={
                  <MetricSparkline
                    values={reviewRateTrend.flatMap((item) => item.rate === null ? [] : [item.rate])}
                    color="#EF4444"
                  />
                }
              />
            </DpLayout>
          )}
          {view === "reviews" && (
            <DpLayout as="section" className="mi-kpi-grid mi-review-kpis">
              <MetricCard
                icon={<Star size={18} />}
                title="평균 평점 (Android)"
                value={rating(periodSummary.androidRating)}
                change={
                  <Change
                    value={periodSummary.androidRatingChange}
                    suffix=""
                    decimals={2}
                  />
                }
                tone="green"
                quality={androidRatingQuality}
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
                icon={<Star size={18} />}
                title="평균 평점 (iOS)"
                value={rating(periodSummary.iosRating)}
                change={
                  <Change
                    value={periodSummary.iosRatingChange}
                    suffix=""
                    decimals={2}
                  />
                }
                tone="violet"
                quality={iosRatingQuality}
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
                icon={<MessageSquareText size={18} />}
                title="부정 리뷰 비율 (1~2점)"
                value={percent(periodSummary.negativeReviewRate)}
                change={
                  <Change
                    value={periodSummary.negativeReviewRateChangePoints}
                    suffix="%p"
                  />
                }
                tone="red"
                quality={reviewQuality}
                sparkline={
                  <MetricSparkline
                    values={reviewRateTrend.flatMap((item) => item.rate === null ? [] : [item.rate])}
                    color="#EF4444"
                  />
                }
              />
              <MetricCard
                icon={<MessageSquareText size={18} />}
                title={data.reviewDataTruncated ? "최근 수집 리뷰 수" : "전체 수집 리뷰 수"}
                value={number(data.reviews.length)}
                change={
                  <Change
                    value={periodSummary.reviewCountChange}
                    suffix="건"
                    decimals={0}
                  />
                }
                tone="blue"
                quality={reviewQuality}
                sparkline={
                  <MetricSparkline values={reviewCountTrend} color="#4C73EC" />
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
                    <QualityBadge quality={downloadQuality} label={data.source === "database" && downloadQuality === "derived" ? "부분" : undefined} />
                  </DpLayout>
                  <DownloadChart data={trend} releases={data.releases} />
                </DpCard>
                <DpCard className="mi-panel mi-chart-card">
                  <DpLayout
                    direction="row"
                    justify="between"
                    align="center"
                    className="mi-panel-head"
                  >
                    <DpText as="h3">평점 추이</DpText>
                    <DpLayout direction="row" className="mi-quality-group">
                      <QualityBadge quality={androidRatingQuality} />
                      <QualityBadge quality={iosRatingQuality} />
                    </DpLayout>
                  </DpLayout>
                  <RatingChart data={ratingTrend} />
                </DpCard>
              </DpLayout>
              <DpLayout as="section" className="mi-bottom-grid">
                {reviewPanel}
                {releasePanel}
                {impactPanel}
              </DpLayout>
            </>
          )}
          {view === "downloads" && (
            <>
              <DpLayout as="section" className="mi-download-summary">
                {[
                  { label: "전체 다운로드", value: periodSummary.downloads, change: periodSummary.downloadChangePercent, quality: downloadQuality },
                  { label: "Android 다운로드", value: periodSummary.androidDownloads, change: periodSummary.androidDownloadChangePercent, quality: androidDownloadQuality },
                  { label: "iOS 다운로드", value: periodSummary.iosDownloads, change: periodSummary.iosDownloadChangePercent, quality: iosDownloadQuality },
                  { label: "순증 설치", value: installLifecycle.totals.net, change: null, quality: qualityFor(["daily_device_installs", "daily_device_uninstalls", "installs", "uninstalls"]) },
                ].map(({ label, value, change, quality }) => (
                  <DpCard as="article" key={label}>
                    <DpLayout direction="row" align="center" justify="between">
                      <DpText as="span">{label}</DpText>
                      <QualityBadge quality={quality} label={data.source === "database" && quality === "derived" ? "부분" : undefined} />
                    </DpLayout>
                    <DpText as="strong">{number(value)}</DpText>
                    <Change value={change} />
                  </DpCard>
                ))}
              </DpLayout>
              <DpLayout as="section" className="mi-download-charts">
                <DpCard className="mi-panel mi-chart-card mi-chart-card--large">
                  <DpLayout direction="row" justify="between" align="start" className="mi-panel-head">
                    <DpLayout><DpText as="h3">다운로드 추이</DpText><DpText>전체 · Android · iOS</DpText></DpLayout>
                    <QualityBadge quality={downloadQuality} label={data.source === "database" && downloadQuality === "derived" ? "부분" : undefined} />
                  </DpLayout>
                  <DownloadChart data={trend} releases={data.releases} />
                </DpCard>
                <DpCard className="mi-panel mi-install-chart">
                  <DpLayout direction="row" justify="between" align="start" className="mi-panel-head">
                    <DpLayout><DpText as="h3">설치 vs 삭제 추이</DpText><DpText>일별 순설치 변화를 비교합니다.</DpText></DpLayout>
                    <DpBadge>일별</DpBadge>
                  </DpLayout>
                  {installLifecycle.trend.length ? (
                    <DpLayout direction="row" align="end" className="mi-install-bars" aria-label="설치 및 삭제 일별 막대 차트">
                      {installLifecycle.trend.slice(-20).map((item) => (
                        <DpLayout key={item.date} className="mi-install-bar" title={`${item.date} 설치 ${number(item.installs)} / 삭제 ${number(item.uninstalls)}`}>
                          {item.installs !== null && (
                            <i style={{ height: `${Math.max(3, (item.installs / installChartMaximum) * 74)}px` }} />
                          )}
                          {item.uninstalls !== null && (
                            <b style={{ height: `${Math.max(3, (item.uninstalls / installChartMaximum) * 74)}px` }} />
                          )}
                        </DpLayout>
                      ))}
                    </DpLayout>
                  ) : (
                    <DpText className="mi-empty">설치·삭제 데이터가 아직 수집되지 않았습니다.</DpText>
                  )}
                  <DpLayout direction="row" className="mi-install-legend"><span><i />설치 {number(installLifecycle.totals.installs)}</span><span><b />삭제 {number(installLifecycle.totals.uninstalls)}</span></DpLayout>
                  {(data.app.iosAppId || data.app.iosBundleId) && (
                    <DpText as="small">
                      iOS 설치·삭제는 Apple과 진단/사용 데이터를 공유한 사용자 기준의 표본입니다.
                    </DpText>
                  )}
                </DpCard>
              </DpLayout>
              <DpCard className="mi-panel mi-daily-table">
                <DpLayout direction="row" align="center" justify="between" className="mi-panel-head">
                  <DpLayout><DpText as="h3">일별 다운로드 상세</DpText><DpText>최근 일자부터 플랫폼별 실적을 확인하세요.</DpText></DpLayout>
                  <DpButton className="mi-csv-button"><Download size={14} />CSV 다운로드</DpButton>
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
                  <DpLayout direction="row" align="center" justify="between" className="mi-panel-head">
                    <DpLayout><DpText as="h3">VOC 키워드 요약</DpText><DpText>부정 리뷰(1~2점) 기반 주요 불만 키워드</DpText></DpLayout>
                    <DpBadge>전체</DpBadge>
                  </DpLayout>
                  <DpLayout direction="row" className="mi-voc-chips">
                    {vocKeywords.map(({ label, count }) => <DpBadge key={label}>{label} <small>{count}</small></DpBadge>)}
                  </DpLayout>
                  <DpLayout direction="row" align="center" justify="between" className="mi-voc-total"><DpText>전체 부정 리뷰 수</DpText><DpText as="strong">{number(periodReviews.filter((review) => review.rating <= 2).length)}</DpText></DpLayout>
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
                  ["연결된 스토어", `${connectedPlatforms.length}`, connectedPlatforms.map((item) => item === "android" ? "Google Play" : "App Store").join(", ") || "연결 없음"],
                  ["최근 동기화 상태", syncDate(latestOverallSync?.finishedAt ?? null), latestOverallSync ? `선택 앱 ${latestOverallSync.status}` : "동기화 기록 없음"],
                  ["정상 연동 비율", connectionRatio === null ? "—" : `${connectionRatio.toFixed(0)}%`, `${healthyPlatforms.length} / ${connectedPlatforms.length} 스토어 정상 연동`],
                ].map(([label, value, detail]) => <DpCard as="article" key={label}><DpText as="span">{label}</DpText><DpText as="strong">{value}</DpText><DpText as="small">{detail}</DpText></DpCard>)}
              </DpLayout>
              <DpCard className="mi-panel mi-app-panel">
                <DpLayout direction="row" align="center" justify="between" className="mi-panel-head">
                  <DpLayout><DpText as="h3">앱 목록 <small>{data.apps.length}</small></DpText><DpText>등록 앱과 스토어 데이터 연결 상태입니다.</DpText></DpLayout>
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
                  <DpText>스토어 계정을 연결하여 앱 데이터를 자동으로 동기화하세요.</DpText>
                </DpLayout>
                {[
                  ["Google Play Console", data.app.androidPackageName, "android"],
                  ["App Store Connect", data.app.iosBundleId ?? data.app.iosAppId, "ios"],
                ].map(([service, identifier, platform]) => (
                  <DpLayout
                    as="article"
                    direction="row"
                    align="center"
                    key={service}
                  >
                    <DpText as="strong">{service}</DpText>
                    <DpText as="span">{identifier ?? "식별자 미설정"}</DpText>
                    <DpBadge>{identifier ? latestSync(platform as Platform)?.status ?? "동기화 전" : "미연동"}</DpBadge>
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
