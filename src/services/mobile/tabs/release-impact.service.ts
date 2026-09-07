import { calculateReleaseImpact } from "@/domain/releases/release-impact";
import type { AppRelease, DashboardData, Platform } from "@/domain/types";
import { addDays } from "@/lib/date";
import { calculateAverage } from "@/lib/number";
import { contentMatchesTerms, VOC_GROUPS } from "../common/voc-keywords";

const WINDOW_DAYS = 7;

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
    if (metric.rating !== null) point.ratings.push(metric.rating);
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
      .filter((review) => review.platform === platform)
      .map((review) => ({
        reviewedAt: review.reviewedAt.slice(0, 10),
        rating: review.rating,
      })),
  });
}

export function buildReleaseImpactWorkspace(
  data: DashboardData,
  release: AppRelease,
) {
  const releasedAt = release.releasedAt.slice(0, 10);
  const windows = {
    before: {
      from: addDays(releasedAt, -WINDOW_DAYS),
      to: addDays(releasedAt, -1),
    },
    after: {
      from: addDays(releasedAt, 1),
      to: addDays(releasedAt, WINDOW_DAYS),
    },
  };

  const metricsIn = (from: string, to: string) =>
    data.metrics.filter((item) => inWindow(item.date, from, to));
  const reviewsIn = (from: string, to: string) =>
    data.reviews.filter((item) =>
      inWindow(item.reviewedAt.slice(0, 10), from, to),
    );

  const beforeMetrics = metricsIn(windows.before.from, windows.before.to);
  const afterMetrics = metricsIn(windows.after.from, windows.after.to);
  const beforeReviews = reviewsIn(windows.before.from, windows.before.to);
  const afterReviews = reviewsIn(windows.after.from, windows.after.to);
  const coverage = {
    beforeDays: new Set(beforeMetrics.map((item) => item.date)).size,
    afterDays: new Set(afterMetrics.map((item) => item.date)).size,
    expectedDays: WINDOW_DAYS,
  };
  const hasCompleteMetricWindows =
    coverage.beforeDays === WINDOW_DAYS && coverage.afterDays === WINDOW_DAYS;

  const downloadTotal = (rows: typeof data.metrics) => {
    const values = rows.flatMap((item) =>
      item.downloads === null ? [] : [item.downloads],
    );
    return values.length
      ? values.reduce((total, value) => total + value, 0)
      : null;
  };
  const ratingAverage = (rows: typeof data.metrics, platform: Platform) =>
    calculateAverage(
      rows.flatMap((item) =>
        item.platform === platform && item.rating !== null ? [item.rating] : [],
      ),
    );
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
  const ratings = {
    android: comparison(
      ratingAverage(beforeMetrics, "android"),
      ratingAverage(afterMetrics, "android"),
    ),
    ios: comparison(
      ratingAverage(beforeMetrics, "ios"),
      ratingAverage(afterMetrics, "ios"),
    ),
  };
  const negativeReviews = comparison(
    negativeRate(beforeReviews),
    negativeRate(afterReviews),
  );
  const newReviews = comparison(beforeReviews.length, afterReviews.length);

  const stabilityRate = (metricKey: string) => {
    const observations =
      release.platform === "android"
        ? (data.metricObservations ?? [])
            .filter(
              (item) =>
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
        expected: WINDOW_DAYS,
      },
    };
  };
  const stability = {
    crashRate: stabilityRate("user_perceived_crash_rate_28d"),
    anrRate: stabilityRate("user_perceived_anr_rate_28d"),
  };

  const daily = Array.from({ length: WINDOW_DAYS * 2 + 1 }, (_, index) => {
    const offset = index - WINDOW_DAYS;
    const date = addDays(releasedAt, offset);
    const rows = data.metrics.filter((item) => item.date === date);
    return { offset, date, downloads: downloadTotal(rows) };
  });

  const voc = VOC_GROUPS.map(({ label, terms }) => {
    const before = beforeReviews.reduce(
      (total, item) =>
        total + (contentMatchesTerms(item.content, terms) ? 1 : 0),
      0,
    );
    const after = afterReviews.reduce(
      (total, item) =>
        total + (contentMatchesTerms(item.content, terms) ? 1 : 0),
      0,
    );
    return {
      label,
      before,
      after,
      changePercent: percentChange(before, after),
    };
  }).sort((a, b) => b.after - a.after || b.before - a.before);

  const insights = [
    {
      tone:
        hasCompleteMetricWindows &&
        downloads.change !== null &&
        downloads.change >= 0
          ? "good"
          : "warn",
      title: !hasCompleteMetricWindows
        ? "다운로드 비교 기간 미완료"
        : downloads.change === null
          ? "다운로드 비교 데이터 부족"
          : `다운로드 ${downloads.change >= 0 ? "증가" : "감소"}`,
      detail: !hasCompleteMetricWindows
        ? `배포 후 데이터가 ${coverage.afterDays}/${coverage.expectedDays}일 수집되어 증감률 판단을 보류합니다.`
        : downloads.change === null
          ? "스토어 다운로드 데이터가 충분히 쌓인 뒤 비교할 수 있습니다."
          : `배포 전후 합계가 ${Math.abs(downloads.change).toLocaleString("ko-KR")}건 변했습니다.`,
    },
    {
      tone: "good",
      title: `평점 개선 폭 ${ratings.ios.change !== null && ratings.android.change !== null && ratings.ios.change > ratings.android.change ? "iOS 우세" : "Android 우세"}`,
      detail: `Android ${ratings.android.change?.toFixed(2) ?? "—"}, iOS ${ratings.ios.change?.toFixed(2) ?? "—"} 변화입니다.`,
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

  const platforms = Array.from(
    new Set(
      data.releases
        .filter((item) => item.version === release.version)
        .map((item) => item.platform),
    ),
  );

  return {
    release,
    releasedAt,
    windows,
    downloads,
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
