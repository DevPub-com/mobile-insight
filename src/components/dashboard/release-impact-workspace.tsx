"use client";

import { useMemo, useState, type ReactNode } from "react";

import { PlatformIcon } from "@/components/dashboard/platform-icon";
import { ReleaseImpactTrendChart } from "@/components/dashboard/release-impact-trend-chart";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpSelect } from "@/components/ui/dp/DpSelect";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import type { DashboardData } from "@/domain/types";
import {
  buildReleaseImpactWorkspace,
  classifyVersionChange,
  compareVersionsDescending,
  selectLatestMatureRelease,
} from "@/services/mobile";

const formatNumber = (value: number | null, decimals = 0) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("ko-KR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);

const formatRate = (value: number | null, decimals = 1) =>
  value === null ? "—" : `${formatNumber(value, decimals)}%`;

const signed = (value: number | null, suffix = "", decimals = 0) =>
  value === null
    ? "—"
    : `${value >= 0 ? "+" : ""}${formatNumber(value, decimals)}${suffix}`;

const shortDate = (value: string) => value.replaceAll("-", ".");

function Delta({
  value,
  suffix = "%",
  lowerIsBetter = false,
  decimals = 1,
}: {
  value: number | null;
  suffix?: string;
  lowerIsBetter?: boolean;
  decimals?: number;
}) {
  if (value === null) return <span className="ri-muted">비교 불가</span>;
  const good = lowerIsBetter ? value <= 0 : value >= 0;
  return (
    <span className={good ? "ri-good" : "ri-bad"}>
      <KoboyoIcon
        name="arrow-up"
        size={13}
        className={value < 0 ? "is-down" : undefined}
      />{" "}
      {signed(value, suffix, decimals)}
    </span>
  );
}

function KpiCard({
  icon,
  title,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: ReactNode;
  tone: string;
}) {
  return (
    <DpCard as="article" className={`ri-kpi ri-kpi--${tone}`}>
      <DpLayout align="center" justify="center" className="ri-kpi-icon">
        {icon}
      </DpLayout>
      <DpLayout className="ri-kpi-copy">
        <DpText as="span">{title}</DpText>
        <DpText as="strong">{value}</DpText>
        <DpText as="small">{detail}</DpText>
      </DpLayout>
    </DpCard>
  );
}

export function ReleaseImpactWorkspace({ data }: { data: DashboardData }) {
  const releases = useMemo(
    () =>
      [...data.releases].sort(
        (a, b) =>
          b.releasedAt.localeCompare(a.releasedAt) ||
          compareVersionsDescending(a.version, b.version),
      ),
    [data.releases],
  );
  const versions = useMemo(
    () =>
      releases.filter(
        (release, index, all) =>
          all.findIndex((item) => item.version === release.version) === index,
      ),
    [releases],
  );
  const defaultRelease = useMemo(() => selectLatestMatureRelease(data), [data]);
  const [version, setVersion] = useState(defaultRelease?.version ?? "");
  const release =
    releases.find((item) => item.version === version) ?? releases[0] ?? null;
  const view = useMemo(
    () => (release ? buildReleaseImpactWorkspace(data, release) : null),
    [data, release],
  );

  if (!view || !release) {
    return (
      <DpCard className="ri-empty">
        <DpText>분석할 릴리즈 데이터가 없습니다.</DpText>
      </DpCard>
    );
  }

  const platformReleases = releases.filter(
    (item) => item.platform === release.platform,
  );
  const releaseIndex = platformReleases.findIndex(
    (item) => item.id === release.id,
  );
  const versionChange = classifyVersionChange(
    release.version,
    releaseIndex < 0
      ? null
      : (platformReleases[releaseIndex + 1]?.version ?? null),
  );
  const changeLabels = {
    major: "Major",
    minor: "Minor",
    patch: "Patch",
    unknown: "분류 불가",
  };

  const exportCsv = () => {
    const rows = [
      ["지표", "배포 전", "배포 후", "변화"],
      [
        "다운로드",
        view.downloads.before,
        view.downloads.after,
        view.downloads.change,
      ],
      [
        "Android 평점",
        view.ratings.android.before,
        view.ratings.android.after,
        view.ratings.android.change,
      ],
      [
        "iOS 평점",
        view.ratings.ios.before,
        view.ratings.ios.after,
        view.ratings.ios.change,
      ],
      [
        "부정 리뷰 비율",
        view.negativeReviews.before,
        view.negativeReviews.after,
        view.negativeReviews.change,
      ],
      [
        "신규 리뷰",
        view.newReviews.before,
        view.newReviews.after,
        view.newReviews.change,
      ],
      [
        "비정상 종료율",
        view.stability.crashRate.before,
        view.stability.crashRate.after,
        view.stability.crashRate.changePoints,
      ],
      [
        "ANR 발생률",
        view.stability.anrRate.before,
        view.stability.anrRate.after,
        view.stability.anrRate.changePoints,
      ],
    ];
    const csv = rows
      .map((row) => row.map((cell) => cell ?? "").join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `release-impact-${release.version}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const maxVoc = Math.max(
    1,
    ...view.voc.flatMap((item) => [item.before, item.after]),
  );
  const comparisonRows = [
    {
      label: "다운로드",
      before: formatNumber(view.downloads.before),
      after: formatNumber(view.downloads.after),
      change: signed(view.downloads.change),
      percent: view.downloads.changePercent,
      direction: view.downloads.changePercent,
      lowerIsBetter: false,
    },
    {
      label: "Android 평점",
      before: formatNumber(view.ratings.android.before, 2),
      after: formatNumber(view.ratings.android.after, 2),
      change: signed(view.ratings.android.change, "", 2),
      percent: view.ratings.android.changePercent,
      direction: view.ratings.android.changePercent,
      lowerIsBetter: false,
    },
    {
      label: "iOS 평점",
      before: formatNumber(view.ratings.ios.before, 2),
      after: formatNumber(view.ratings.ios.after, 2),
      change: signed(view.ratings.ios.change, "", 2),
      percent: view.ratings.ios.changePercent,
      direction: view.ratings.ios.changePercent,
      lowerIsBetter: false,
    },
    {
      label: "부정 리뷰 비율",
      before: formatRate(view.negativeReviews.before),
      after: formatRate(view.negativeReviews.after),
      change: signed(view.negativeReviews.change, "%p", 1),
      percent: view.negativeReviews.changePercent,
      direction: view.negativeReviews.change,
      lowerIsBetter: true,
    },
    {
      label: "신규 리뷰",
      before: `${formatNumber(view.newReviews.before)}건`,
      after: `${formatNumber(view.newReviews.after)}건`,
      change: signed(view.newReviews.change, "건"),
      percent: view.newReviews.changePercent,
      direction: view.newReviews.change,
      lowerIsBetter: false,
    },
    {
      label: "비정상 종료율",
      before: formatRate(view.stability.crashRate.before, 3),
      after: formatRate(view.stability.crashRate.after, 3),
      change: signed(view.stability.crashRate.changePoints, "%p", 3),
      percent: null,
      direction: view.stability.crashRate.changePoints,
      lowerIsBetter: true,
    },
    {
      label: "ANR 발생률",
      before: formatRate(view.stability.anrRate.before, 3),
      after: formatRate(view.stability.anrRate.after, 3),
      change: signed(view.stability.anrRate.changePoints, "%p", 3),
      percent: null,
      direction: view.stability.anrRate.changePoints,
      lowerIsBetter: true,
    },
  ];

  const stabilityDetail = (metric: typeof view.stability.crashRate) => (
    <>
      <Delta
        value={metric.changePoints}
        suffix="%p"
        lowerIsBetter
        decimals={3}
      />
      <span className="ri-kpi-coverage">
        {metric.afterAsOfDate
          ? `${shortDate(metric.afterAsOfDate)} 기준 · 배포 후 ${metric.coverage.after}/${metric.coverage.expected}일`
          : "배포 후 데이터 없음"}
      </span>
    </>
  );

  return (
    <DpLayout className="ri-workspace">
      <DpLayout
        direction="row"
        align="center"
        justify="between"
        className="ri-toolbar"
      >
        <DpLayout direction="row" className="ri-toolbar-controls">
          <DpLayout direction="row" align="center" className="ri-app-chip">
            <KoboyoIcon name="database" size={14} />
            <DpText as="strong">{data.app.name}</DpText>
          </DpLayout>
          <DpSelect
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            aria-label="분석할 릴리즈 버전"
          >
            {versions.map((item) => (
              <option key={item.id} value={item.version}>
                v{item.version.replace(/^v/, "")}
              </option>
            ))}
          </DpSelect>
          <DpLayout direction="row" align="center" className="ri-window-chip">
            배포 전 7일 vs 배포 후 7일
          </DpLayout>
          <DpLayout direction="row" align="center" className="ri-date-chip">
            {shortDate(view.windows.before.from)} ~{" "}
            {shortDate(view.windows.after.to)}
            {release.releaseDateEstimated && <DpBadge>추정일 기준</DpBadge>}
            <KoboyoIcon name="calendar" size={14} />
          </DpLayout>
        </DpLayout>
        <DpButton className="ri-export" onClick={exportCsv}>
          <KoboyoIcon name="download" size={15} /> 내보내기
        </DpButton>
      </DpLayout>

      <DpLayout as="section" className="ri-kpi-grid">
        <KpiCard
          icon={<KoboyoIcon name="download" size={21} />}
          title="다운로드 변화"
          value={signed(view.downloads.change)}
          detail={<Delta value={view.downloads.changePercent} />}
          tone="blue"
        />
        <KpiCard
          icon={<KoboyoIcon name="star" size={20} />}
          title="평점 변화 (Android)"
          value={signed(view.ratings.android.change, "", 2)}
          detail={`${formatNumber(view.ratings.android.before, 2)} → ${formatNumber(view.ratings.android.after, 2)}`}
          tone="green"
        />
        <KpiCard
          icon={<KoboyoIcon name="star" size={20} />}
          title="평점 변화 (iOS)"
          value={signed(view.ratings.ios.change, "", 2)}
          detail={`${formatNumber(view.ratings.ios.before, 2)} → ${formatNumber(view.ratings.ios.after, 2)}`}
          tone="violet"
        />
        <KpiCard
          icon={<KoboyoIcon name="shield-alert" size={20} />}
          title="부정 리뷰 비율"
          value={signed(view.negativeReviews.change, "%p", 1)}
          detail={`${formatNumber(view.negativeReviews.before, 1)}% → ${formatNumber(view.negativeReviews.after, 1)}%`}
          tone="orange"
        />
        <KpiCard
          icon={<KoboyoIcon name="message-square" size={20} />}
          title="신규 리뷰"
          value={signed(view.newReviews.change)}
          detail={<Delta value={view.newReviews.changePercent} />}
          tone="blue"
        />
        <KpiCard
          icon={<KoboyoIcon name="bug" size={20} />}
          title="배포 후 비정상 종료율"
          value={formatRate(view.stability.crashRate.after, 3)}
          detail={stabilityDetail(view.stability.crashRate)}
          tone="red"
        />
        <KpiCard
          icon={<KoboyoIcon name="shield-alert" size={20} />}
          title="배포 후 ANR 발생률"
          value={formatRate(view.stability.anrRate.after, 3)}
          detail={stabilityDetail(view.stability.anrRate)}
          tone="red"
        />
      </DpLayout>

      <DpLayout as="section" className="ri-main-grid">
        <DpCard className="ri-card ri-trend-card">
          <DpLayout className="ri-card-head">
            <DpText as="h3">배포 전후 추이</DpText>
            <DpText>
              배포일을 0일로 맞춰 일별 다운로드 흐름을 비교합니다.
            </DpText>
          </DpLayout>
          <ReleaseImpactTrendChart data={view.daily} />
          <DpText as="small" className="ri-coverage">
            수집 범위: 배포 전 {view.coverage.beforeDays}/7일 · 배포 후{" "}
            {view.coverage.afterDays}/7일
          </DpText>
        </DpCard>

        <DpCard className="ri-card ri-insights">
          <DpLayout direction="row" align="center" className="ri-card-title">
            <KoboyoIcon name="lightbulb" size={16} />{" "}
            <DpText as="h3">핵심 인사이트</DpText>
          </DpLayout>
          {view.insights.map((insight, index) => (
            <DpLayout as="article" direction="row" key={insight.title}>
              <DpLayout
                align="center"
                justify="center"
                className={`ri-insight-icon ri-insight-icon--${insight.tone}`}
              >
                {index === 0 ? (
                  <KoboyoIcon name="trending-up" size={15} />
                ) : index === 1 ? (
                  <KoboyoIcon name="sparkles" size={15} />
                ) : (
                  <KoboyoIcon name="shield-alert" size={15} />
                )}
              </DpLayout>
              <DpLayout>
                <DpText as="strong">{insight.title}</DpText>
                <DpText as="small">{insight.detail}</DpText>
              </DpLayout>
            </DpLayout>
          ))}
        </DpCard>

        <DpCard className="ri-card ri-summary">
          <DpText as="h3">릴리즈 요약</DpText>
          <dl>
            <div>
              <dt>버전</dt>
              <dd>v{release.version.replace(/^v/, "")}</dd>
            </div>
            <div>
              <dt>배포일</dt>
              <dd>{shortDate(view.releasedAt)}</dd>
            </div>
            <div>
              <dt>플랫폼</dt>
              <dd>
                {view.platforms.map((platform) => (
                  <span key={platform}>
                    <PlatformIcon platform={platform} size={13} />
                    {platform === "android" ? "Android" : "iOS"}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>빌드 식별자</dt>
              <dd>
                {release.buildNumber
                  ? `build ${release.buildNumber}`
                  : "미수집"}
              </dd>
            </div>
            <div>
              <dt>변경 유형</dt>
              <dd>
                {changeLabels[versionChange]} <small>버전 비교</small>
              </dd>
            </div>
            <div>
              <dt>배포 채널</dt>
              <dd>
                {release.platform === "android"
                  ? release.track === "production"
                    ? "Production"
                    : (release.track ?? "Production")
                  : "App Store"}
              </dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>
                <DpBadge className="ri-status">
                  <KoboyoIcon name="star" size={12} /> 배포 완료
                </DpBadge>
              </dd>
            </div>
          </dl>
          <DpText as="small" className="ri-summary-note">
            {release.releaseDateEstimated
              ? "스토어가 정확한 배포일을 제공하지 않아 버전 생성일 또는 최초 관측일을 기준으로 분석했습니다."
              : "배포일을 제외한 전후 7일 데이터를 기준으로 분석했습니다."}
          </DpText>
        </DpCard>
      </DpLayout>

      <DpLayout as="section" className="ri-bottom-grid">
        <DpCard className="ri-card ri-comparison">
          <DpText as="h3">Before vs After 비교</DpText>
          <div className="ri-table-scroll">
            <div className="ri-table ri-table-head">
              <span>지표</span>
              <span>배포 전</span>
              <span>배포 후</span>
              <span>변화</span>
              <span>판단</span>
            </div>
            {comparisonRows.map(
              ({
                label,
                before,
                after,
                change,
                percent,
                direction,
                lowerIsBetter,
              }) => {
                const improved =
                  direction !== null &&
                  (lowerIsBetter ? direction <= 0 : direction >= 0);
                return (
                  <div className="ri-table ri-table-row" key={label}>
                    <strong>{label}</strong>
                    <span>{before}</span>
                    <span>{after}</span>
                    <span
                      className={
                        direction === null
                          ? "ri-muted"
                          : improved
                            ? "ri-good"
                            : "ri-bad"
                      }
                    >
                      {change}
                      {percent === null ? "" : ` (${signed(percent, "%", 1)})`}
                    </span>
                    <em className={improved ? "is-good" : "is-watch"}>
                      {direction === null ? "대기" : improved ? "개선" : "확인"}
                    </em>
                  </div>
                );
              },
            )}
          </div>
        </DpCard>

        <DpCard className="ri-card ri-voc">
          <DpText as="h3">VOC 변화</DpText>
          <DpLayout className="ri-voc-head">
            <span>키워드</span>
            <span>배포 전 / 배포 후</span>
            <span>변화</span>
          </DpLayout>
          {view.voc.map((item) => (
            <DpLayout
              as="article"
              direction="row"
              align="center"
              key={item.label}
            >
              <DpText as="strong">{item.label}</DpText>
              <DpLayout className="ri-voc-bars">
                <i style={{ width: `${(item.before / maxVoc) * 100}%` }} />
                <b style={{ width: `${(item.after / maxVoc) * 100}%` }} />
              </DpLayout>
              <DpText as="span">
                <Delta
                  value={item.changePercent}
                  lowerIsBetter={item.label === "안정성"}
                />
              </DpText>
            </DpLayout>
          ))}
          <DpLayout direction="row" className="ri-voc-legend">
            <span>
              <i />
              배포 전
            </span>
            <span>
              <b />
              배포 후
            </span>
          </DpLayout>
        </DpCard>

        <DpCard className="ri-card ri-representative-reviews">
          <DpText as="h3">대표 리뷰</DpText>
          {view.representativeReviews.length ? (
            view.representativeReviews.map((review) => (
              <DpLayout as="article" key={review.id}>
                <DpLayout
                  direction="row"
                  align="center"
                  className="ri-review-meta"
                >
                  <DpText as="strong">
                    {"★".repeat(review.rating)}
                    <span>{"★".repeat(5 - review.rating)}</span>
                  </DpText>
                  <DpBadge>
                    <PlatformIcon platform={review.platform} size={11} />
                    {review.platform === "android" ? "Android" : "iOS"}
                  </DpBadge>
                  <DpText as="time">
                    {shortDate(review.reviewedAt.slice(0, 10))}
                  </DpText>
                </DpLayout>
                <DpText>{review.content}</DpText>
              </DpLayout>
            ))
          ) : (
            <DpText className="ri-muted">배포 후 리뷰가 없습니다.</DpText>
          )}
        </DpCard>
      </DpLayout>
    </DpLayout>
  );
}
