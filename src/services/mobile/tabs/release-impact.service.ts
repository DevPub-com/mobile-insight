import { buildCrashHistory } from "../crash-history.service";
import { displayReleaseVersion } from "../common/release-version";
import { calculateReleaseImpact } from "@/domain/releases/release-impact";
import type { AppRelease, AppReview, DashboardData, Platform } from "@/domain/types";
import { addDays } from "@/lib/date";
import { calculateAverage } from "@/lib/number";
import { reviewHasMajorTopic, VOC_GROUPS } from "../common/voc-keywords";

const dayCount = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);

export function releaseImpactToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(now);
}

const roundedDifference = (before: number | null, after: number | null) =>
  before === null || after === null
    ? null
    : Number((after - before).toFixed(2));

const percentChange = (before: number | null, after: number | null) =>
  before === null || after === null || before === 0
    ? null
    : Number((((after - before) / before) * 100).toFixed(1));

const rateDifference = (before: number | null, after: number | null) =>
  before === null || after === null
    ? null
    : Number((after - before).toFixed(3));

const inWindow = (date: string, from: string, to: string) =>
  date >= from && date <= to;

const comparison = (before: number | null, after: number | null) => ({
  before,
  after,
  change: roundedDifference(before, after),
  changePercent: percentChange(before, after),
});

function newDownloadValue(
  data: DashboardData,
  platform: Platform,
  date: string,
  fallback: number | null,
) {
  if (data.metricObservations === undefined) return fallback;
  const metricKey =
    platform === "android" ? "daily_user_installs" : "first_time_downloads";
  return (
    data.metricObservations.find(
      (observation) =>
        observation.platform === platform &&
        observation.date === date &&
        observation.metricKey === metricKey,
    )?.value ?? null
  );
}

export function buildReleaseImpact(
  data: DashboardData,
  version: string,
  platform: Platform,
  beforeDays = 7,
  afterDays = 7,
  includeReleaseDay = false,
  previousVersion?: string,
) {
  const matching = data.releases.filter(
    (release) => release.version === version && release.platform === platform,
  );
  if (!matching.length) return null;
  const releasedAt = matching[0].releasedAt.slice(0, 10);
  const byDate = new Map<
    string,
    { downloads: number; ratings: number[]; hasDownloads: boolean }
  >();
  for (const metric of data.metrics.filter(
    (item) => item.platform === platform,
  )) {
    const point = byDate.get(metric.date) ?? {
      downloads: 0,
      ratings: [],
      hasDownloads: false,
    };
    const downloads = newDownloadValue(
      data,
      platform,
      metric.date,
      metric.downloads,
    );
    if (downloads !== null) {
      point.downloads += downloads;
      point.hasDownloads = true;
    }
    // Store-wide rating snapshots cannot be attributed to this release.
    byDate.set(metric.date, point);
  }

  return calculateReleaseImpact({
    releasedAt,
    beforeDays,
    afterDays,
    includeReleaseDay,
    metrics: [...byDate].map(([date, point]) => ({
      date,
      downloads: point.hasDownloads ? point.downloads : null,
      rating: point.ratings.length
        ? point.ratings.reduce((total, rating) => total + rating, 0) /
          point.ratings.length
        : null,
    })),
    reviews: data.reviews
      .filter((review) => {
        const targetVersion = review.reviewedAt.slice(0, 10) < releasedAt
          ? previousVersion ?? version : version;
        return review.platform === platform && review.version != null &&
          displayReleaseVersion(platform, review.version) === displayReleaseVersion(platform, targetVersion);
      })
      .map((review) => ({
        reviewedAt: review.reviewedAt.slice(0, 10),
        rating: review.rating,
      })),
  });
}

export function buildReleaseImpactWorkspace(
  data: DashboardData,
  release: AppRelease,
  today = releaseImpactToday(),
) {
  const releasedAt = release.releasedAt.slice(0, 10);
  const siblings = data.releases.filter((item) =>
    item.appId === release.appId && item.platform === release.platform,
  ).sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
  const previous = siblings.filter((item) => item.releasedAt.slice(0, 10) < releasedAt && displayReleaseVersion(item.platform, item.version) !== displayReleaseVersion(release.platform, release.version)).at(-1);
  const next = siblings.find((item) => item.releasedAt.slice(0, 10) > releasedAt);
  const windows = {
    before: { from: previous?.releasedAt.slice(0, 10) ?? releasedAt, to: addDays(releasedAt, -1) },
    after: { from: releasedAt, to: next ? [addDays(next.releasedAt.slice(0, 10), -1), today].sort()[0] : today },
  };
  const expectedBeforeDays = dayCount(windows.before.from, windows.before.to);
  const expectedAfterDays = dayCount(windows.after.from, windows.after.to);
  // All cards, reviews and trends use the selected app and OS.
  data = { ...data,
    metrics: data.metrics.filter((item) => item.appId === release.appId && item.platform === release.platform),
    reviews: data.reviews.filter((item) => item.appId === release.appId && item.platform === release.platform && item.version != null),
  };

  const metricsIn = (from: string, to: string) =>
    data.metrics.filter((item) => inWindow(item.date, from, to));
  const reviewsIn = (from: string, to: string) =>
    data.reviews.filter((item) =>
      inWindow(item.reviewedAt.slice(0, 10), from, to),
    );

  const beforeMetrics = metricsIn(windows.before.from, windows.before.to);
  const afterMetrics = metricsIn(windows.after.from, windows.after.to);
  const matchesVersion = (review: AppReview, version: string) => displayReleaseVersion(review.platform, review.version!) === displayReleaseVersion(release.platform, version);
  const beforeReviews = previous ? reviewsIn(windows.before.from, windows.before.to).filter(review => matchesVersion(review, previous.version)) : [];
  const afterReviews = reviewsIn(windows.after.from, windows.after.to).filter(review => matchesVersion(review, release.version));
  const coverage = {
    beforeDays: new Set(beforeMetrics.filter((item) => item.downloads !== null).map((item) => item.date)).size,
    afterDays: new Set(afterMetrics.filter((item) => item.downloads !== null).map((item) => item.date)).size,
    expectedDays: expectedAfterDays,
    expectedBeforeDays,
  };
  const hasCompleteMetricWindows =
    expectedBeforeDays > 0 && expectedAfterDays > 0 &&
    coverage.beforeDays === expectedBeforeDays && coverage.afterDays === expectedAfterDays;

  const downloadTotal = (rows: typeof data.metrics) => {
    const values = rows.flatMap((item) =>
      item.downloads === null ? [] : [item.downloads],
    );
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const ratingAverage = (rows: typeof data.reviews, platform: Platform) =>
    calculateAverage(rows.filter(row => row.platform === platform).map(row => row.rating));
  const negativeRate = (rows: typeof data.reviews) =>
    rows.length
      ? (rows.filter((item) => item.rating <= 2).length / rows.length) * 100
      : null;

  const downloadsComparison = comparison(
    downloadTotal(beforeMetrics),
    downloadTotal(afterMetrics),
  );
  const downloads = {
    ...downloadsComparison,
    changePercent: hasCompleteMetricWindows
      ? downloadsComparison.changePercent
      : null,
  };
  const downloadDailyAverage = {
    ...comparison(coverage.beforeDays ? downloads.before! / coverage.beforeDays : null,
      coverage.afterDays ? downloads.after! / coverage.afterDays : null),
  };
  if (!hasCompleteMetricWindows) {
    downloadDailyAverage.change = null;
    downloadDailyAverage.changePercent = null;
  }
  const crashScope = "version";
  const crashSummary = (version: string, range: { from: string; to: string }) => buildCrashHistory({ ...data,
    metricObservations: (data.metricObservations ?? []).filter(row => row.appId === release.appId && row.platform === release.platform &&
      row.metricKey.startsWith("crash_report_count:version:") && displayReleaseVersion(release.platform, row.metricKey.slice("crash_report_count:version:".length)) === displayReleaseVersion(release.platform, version))
      .map(row => ({ ...row, metricKey: "crash_report_count" })),
  }, { startDate: range.from, endDate: range.to })[release.platform];
  const crashAfter = crashSummary(release.version, windows.after);
  const crashBefore = previous ? crashSummary(previous.version, windows.before) : null;
  const crashReports = { before: crashBefore?.value ?? null, after: crashAfter.value,
    scope: crashScope, afterDays: crashAfter.days, latestDate: crashAfter.latestDate,
    change: crashBefore && crashBefore.days === expectedBeforeDays && crashAfter.days === expectedAfterDays
      ? roundedDifference(crashBefore.value, crashAfter.value) : null,
  };
  const ratings = {
    android: comparison(
      ratingAverage(beforeReviews, "android"),
      ratingAverage(afterReviews, "android"),
    ),
    ios: comparison(
      ratingAverage(beforeReviews, "ios"),
      ratingAverage(afterReviews, "ios"),
    ),
  };
  const negativeReviews = comparison(
    data.reviewDataTruncated ? null : negativeRate(beforeReviews),
    data.reviewDataTruncated ? null : negativeRate(afterReviews),
  );
  const newReviews = comparison(expectedBeforeDays && !data.reviewDataTruncated ? beforeReviews.length : null,
    expectedAfterDays && !data.reviewDataTruncated ? afterReviews.length : null);

  const stabilityRate = (metricKey: string) => {
    const observations =
      release.platform === "android"
        ? (data.metricObservations ?? [])
            .filter(
              (item) =>
                item.appId === release.appId &&
                item.platform === "android" &&
                item.metricKey === metricKey &&
                item.value !== null,
            )
            .sort((left, right) => left.date.localeCompare(right.date))
        : [];
    const before = observations.filter((item) =>
      inWindow(item.date, windows.before.from, windows.before.to),
    );
    const after = observations.filter((item) =>
      inWindow(item.date, windows.after.from, windows.after.to),
    );
    const beforeLatest = before.at(-1) ?? null;
    const afterLatest = after.at(-1) ?? null;
    const beforeValue = beforeLatest?.value ?? null;
    const afterValue = afterLatest?.value ?? null;
    return {
      before: beforeValue,
      after: afterValue,
      changePoints: rateDifference(beforeValue, afterValue),
      beforeAsOfDate: beforeLatest?.date ?? null,
      afterAsOfDate: afterLatest?.date ?? null,
      coverage: {
        before: new Set(before.map((item) => item.date)).size,
        after: new Set(after.map((item) => item.date)).size,
        expected: expectedAfterDays,
      },
    };
  };
  const stability = {
    crashRate: stabilityRate("user_perceived_crash_rate_28d"),
    anrRate: stabilityRate("user_perceived_anr_rate_28d"),
  };

  const versionCrashPoints = (version: string | undefined) => new Map((data.metricObservations ?? [])
    .filter(row => version !== undefined && row.appId === release.appId && row.platform === release.platform &&
      row.metricKey.startsWith("crash_report_count:version:") && displayReleaseVersion(release.platform, row.metricKey.slice("crash_report_count:version:".length)) === displayReleaseVersion(release.platform, version) &&
      row.quality !== "unavailable" && row.value !== null && Number.isSafeInteger(row.value) && row.value >= 0)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt)).map(row => [row.date, row.value!]));
  const currentCrashPoints = versionCrashPoints(release.version);
  const previousCrashPoints = versionCrashPoints(previous?.version);
  const daily = Array.from({ length: expectedBeforeDays + expectedAfterDays }, (_, index) => {
    const offset = index - expectedBeforeDays;
    const date = addDays(releasedAt, offset);
    const rows = data.metrics.filter((item) => item.date === date);
    const reviews = (offset < 0 ? beforeReviews : afterReviews).filter(row => row.reviewedAt.slice(0, 10) === date);
    return { offset, date, downloads: downloadTotal(rows),
      rating: calculateAverage(reviews.map(row => row.rating)),
      crashes: (offset < 0 ? previousCrashPoints : currentCrashPoints).get(date) ?? null,
    };
  });

  const voc = VOC_GROUPS.map(({ label }) => {
    const before = beforeReviews.reduce(
      (total, item) =>
        total + (reviewHasMajorTopic(item, label) ? 1 : 0),
      0,
    );
    const after = afterReviews.reduce(
      (total, item) =>
        total + (reviewHasMajorTopic(item, label) ? 1 : 0),
      0,
    );
    return {
      label,
      before,
      after,
      changePercent: beforeReviews.length && afterReviews.length ? percentChange(before, after) : null,
    };
  }).sort((a, b) => b.after - a.after || b.before - a.before);

  const insights = [
    {
      tone:
        hasCompleteMetricWindows &&
        downloads.change !== null &&
        downloadDailyAverage.change! >= 0
          ? "good"
          : "warn",
      title: !hasCompleteMetricWindows
        ? "다운로드 비교 기간 미완료"
        : downloads.change === null
          ? "다운로드 비교 데이터 부족"
          : `다운로드 ${downloadDailyAverage.change! >= 0 ? "증가" : "감소"}`,
      detail: !hasCompleteMetricWindows
        ? `배포 후 데이터가 ${coverage.afterDays}/${coverage.expectedDays}일 수집되어 증감률 판단을 보류합니다.`
        : downloads.change === null
          ? "스토어 다운로드 데이터가 충분히 쌓인 뒤 비교할 수 있습니다."
          : `수집된 일평균이 ${downloadDailyAverage.before?.toFixed(1)}건에서 ${downloadDailyAverage.after?.toFixed(1)}건으로 변했습니다. 앱 전체 지표입니다.`,
    },
    {
      tone: ratings[release.platform].change !== null && ratings[release.platform].change! >= 0 ? "good" : "warn",
      title: ratings[release.platform].change === null ? "평점 비교 데이터 부족" : "평점 변화",
      detail: `${release.platform === "android" ? "Android" : "iOS"} ${ratings[release.platform].change?.toFixed(2) ?? "—"}점 변화입니다.`,
    },
    {
      tone:
        negativeReviews.change !== null && negativeReviews.change <= 0
          ? "good"
          : "warn",
      title: "1~2점 리뷰 비율 변화",
      detail: `${negativeReviews.before?.toFixed(1) ?? "—"}%에서 ${negativeReviews.after?.toFixed(1) ?? "—"}%로 변했습니다.`,
    },
  ];

  const platforms = [release.platform];

  return {
    release,
    previousRelease: previous ?? null,
    releasedAt,
    windows,
    downloads,
    downloadDailyAverage,
    crashReports,
    ratings,
    negativeReviews,
    newReviews,
    stability,
    daily,
    voc,
    insights,
    representativeReviews: [...afterReviews]
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
      .slice(0, 3),
    platforms,
    coverage,
  };
}

export type ReleaseImpactWorkspaceView = ReturnType<
  typeof buildReleaseImpactWorkspace
>;
