"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bug,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  FileDown,
  Lightbulb,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { PlatformIcon } from "@/components/dashboard/platform-icon";
import { ReleaseImpactTrendChart } from "@/components/dashboard/release-impact-trend-chart";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpSelect } from "@/components/ui/dp/DpSelect";
import { DpText } from "@/components/ui/dp/DpText";
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

const signed = (value: number | null, suffix = "", decimals = 0) =>
  value === null
    ? "—"
    : `${value >= 0 ? "+" : ""}${formatNumber(value, decimals)}${suffix}`;

const shortDate = (value: string) => value.replaceAll("-", ".");

function Delta({
  value,
  suffix = "%",
  lowerIsBetter = false,
}: {
  value: number | null;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  if (value === null) return <span className="ri-muted">비교 불가</span>;
  const good = lowerIsBetter ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={good ? "ri-good" : "ri-bad"}>
      <Icon size={13} /> {signed(value, suffix, 1)}
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
      [...data.releases].sort((a, b) =>
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
  const releaseIndex = platformReleases.findIndex((item) => item.id === release.id);
  const versionChange = classifyVersionChange(
    release.version,
    releaseIndex < 0 ? null : platformReleases[releaseIndex + 1]?.version ?? null,
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
      ["다운로드", view.downloads.before, view.downloads.after, view.downloads.change],
      ["Android 평점", view.ratings.android.before, view.ratings.android.after, view.ratings.android.change],
      ["iOS 평점", view.ratings.ios.before, view.ratings.ios.after, view.ratings.ios.change],
      ["부정 리뷰 비율", view.negativeReviews.before, view.negativeReviews.after, view.negativeReviews.change],
      ["신규 리뷰", view.newReviews.before, view.newReviews.after, view.newReviews.change],
    ];
    const csv = rows.map((row) => row.map((cell) => cell ?? "").join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `release-impact-${release.version}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const maxVoc = Math.max(1, ...view.voc.flatMap((item) => [item.before, item.after]));
  const comparisonRows = [
    ["다운로드", formatNumber(view.downloads.before), formatNumber(view.downloads.after), signed(view.downloads.change), view.downloads.changePercent, false],
    ["Android 평점", formatNumber(view.ratings.android.before, 2), formatNumber(view.ratings.android.after, 2), signed(view.ratings.android.change, "", 2), view.ratings.android.changePercent, false],
    ["iOS 평점", formatNumber(view.ratings.ios.before, 2), formatNumber(view.ratings.ios.after, 2), signed(view.ratings.ios.change, "", 2), view.ratings.ios.changePercent, false],
    ["부정 리뷰 비율", `${formatNumber(view.negativeReviews.before, 1)}%`, `${formatNumber(view.negativeReviews.after, 1)}%`, signed(view.negativeReviews.change, "%p", 1), view.negativeReviews.changePercent, true],
    ["신규 리뷰", `${formatNumber(view.newReviews.before)}건`, `${formatNumber(view.newReviews.after)}건`, signed(view.newReviews.change, "건"), view.newReviews.changePercent, false],
  ] as const;

  return (
    <DpLayout className="ri-workspace">
      <DpLayout direction="row" align="center" justify="between" className="ri-toolbar">
        <DpLayout direction="row" className="ri-toolbar-controls">
          <DpLayout direction="row" align="center" className="ri-app-chip">
            <Database size={14} />
            <DpText as="strong">{data.app.name}</DpText>
          </DpLayout>
          <DpSelect value={version} onChange={(event) => setVersion(event.target.value)} aria-label="분석할 릴리즈 버전">
            {versions.map((item) => (
              <option key={item.id} value={item.version}>v{item.version.replace(/^v/, "")}</option>
            ))}
          </DpSelect>
          <DpLayout direction="row" align="center" className="ri-window-chip">
            배포 전 7일 vs 배포 후 7일
          </DpLayout>
          <DpLayout direction="row" align="center" className="ri-date-chip">
            {shortDate(view.windows.before.from)} ~ {shortDate(view.windows.after.to)}
            {release.releaseDateEstimated && <DpBadge>추정일 기준</DpBadge>}
            <CalendarDays size={14} />
          </DpLayout>
        </DpLayout>
        <DpButton className="ri-export" onClick={exportCsv}>
          <FileDown size={15} /> 내보내기
        </DpButton>
      </DpLayout>

      <DpLayout as="section" className="ri-kpi-grid">
        <KpiCard icon={<Download size={21} />} title="다운로드 변화" value={signed(view.downloads.change)} detail={<Delta value={view.downloads.changePercent} />} tone="blue" />
        <KpiCard icon={<Star size={20} />} title="평점 변화 (Android)" value={signed(view.ratings.android.change, "", 2)} detail={`${formatNumber(view.ratings.android.before, 2)} → ${formatNumber(view.ratings.android.after, 2)}`} tone="green" />
        <KpiCard icon={<Star size={20} />} title="평점 변화 (iOS)" value={signed(view.ratings.ios.change, "", 2)} detail={`${formatNumber(view.ratings.ios.before, 2)} → ${formatNumber(view.ratings.ios.after, 2)}`} tone="violet" />
        <KpiCard icon={<ShieldAlert size={20} />} title="부정 리뷰 비율" value={signed(view.negativeReviews.change, "%p", 1)} detail={`${formatNumber(view.negativeReviews.before, 1)}% → ${formatNumber(view.negativeReviews.after, 1)}%`} tone="orange" />
        <KpiCard icon={<MessageSquareText size={20} />} title="신규 리뷰" value={signed(view.newReviews.change)} detail={<Delta value={view.newReviews.changePercent} />} tone="blue" />
        <KpiCard icon={<Bug size={20} />} title="크래시율" value="연동 필요" detail="Firebase · Sentry 데이터 없음" tone="red" />
      </DpLayout>

      <DpLayout as="section" className="ri-main-grid">
        <DpCard className="ri-card ri-trend-card">
          <DpLayout className="ri-card-head">
            <DpText as="h3">배포 전후 추이</DpText>
            <DpText>배포일을 0일로 맞춰 일별 다운로드 흐름을 비교합니다.</DpText>
          </DpLayout>
          <ReleaseImpactTrendChart data={view.daily} />
          <DpText as="small" className="ri-coverage">
            수집 범위: 배포 전 {view.coverage.beforeDays}/7일 · 배포 후 {view.coverage.afterDays}/7일
          </DpText>
        </DpCard>

        <DpCard className="ri-card ri-insights">
          <DpLayout direction="row" align="center" className="ri-card-title">
            <Lightbulb size={16} /> <DpText as="h3">핵심 인사이트</DpText>
          </DpLayout>
          {view.insights.map((insight, index) => (
            <DpLayout as="article" direction="row" key={insight.title}>
              <DpLayout align="center" justify="center" className={`ri-insight-icon ri-insight-icon--${insight.tone}`}>
                {index === 0 ? <TrendingUp size={15} /> : index === 1 ? <Sparkles size={15} /> : <ShieldAlert size={15} />}
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
            <div><dt>버전</dt><dd>v{release.version.replace(/^v/, "")}</dd></div>
            <div>
              <dt>배포일</dt>
              <dd>
                {shortDate(view.releasedAt)}
                {release.releaseDateEstimated && <DpBadge>추정</DpBadge>}
              </dd>
            </div>
            <div><dt>플랫폼</dt><dd>{view.platforms.map((platform) => <span key={platform}><PlatformIcon platform={platform} size={13} />{platform === "android" ? "Android" : "iOS"}</span>)}</dd></div>
            <div><dt>빌드 식별자</dt><dd>{release.buildNumber ? `build ${release.buildNumber}` : "미수집"}</dd></div>
            <div><dt>변경 유형</dt><dd>{changeLabels[versionChange]} <small>버전 비교</small></dd></div>
            <div><dt>배포 채널</dt><dd>{release.platform === "android" ? (release.track === "production" ? "Production" : release.track ?? "Production") : "App Store"}</dd></div>
            <div><dt>상태</dt><dd><DpBadge className="ri-status"><CheckCircle2 size={12} /> 배포 완료</DpBadge></dd></div>
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
            <div className="ri-table ri-table-head"><span>지표</span><span>배포 전</span><span>배포 후</span><span>변화</span><span>판단</span></div>
            {comparisonRows.map(([label, before, after, change, percent, lowerIsBetter]) => {
              const improved = percent !== null && (lowerIsBetter ? percent <= 0 : percent >= 0);
              return <div className="ri-table ri-table-row" key={label}><strong>{label}</strong><span>{before}</span><span>{after}</span><span className={improved ? "ri-good" : "ri-bad"}>{change}{percent === null ? "" : ` (${signed(percent, "%", 1)})`}</span><em className={improved ? "is-good" : "is-watch"}>{percent === null ? "대기" : improved ? "개선" : "확인"}</em></div>;
            })}
          </div>
        </DpCard>

        <DpCard className="ri-card ri-voc">
          <DpText as="h3">VOC 변화</DpText>
          <DpLayout className="ri-voc-head"><span>키워드</span><span>배포 전 / 배포 후</span><span>변화</span></DpLayout>
          {view.voc.map((item) => (
            <DpLayout as="article" direction="row" align="center" key={item.label}>
              <DpText as="strong">{item.label}</DpText>
              <DpLayout className="ri-voc-bars">
                <i style={{ width: `${(item.before / maxVoc) * 100}%` }} />
                <b style={{ width: `${(item.after / maxVoc) * 100}%` }} />
              </DpLayout>
              <DpText as="span"><Delta value={item.changePercent} lowerIsBetter={item.label === "안정성"} /></DpText>
            </DpLayout>
          ))}
          <DpLayout direction="row" className="ri-voc-legend"><span><i />배포 전</span><span><b />배포 후</span></DpLayout>
        </DpCard>

        <DpCard className="ri-card ri-representative-reviews">
          <DpText as="h3">대표 리뷰</DpText>
          {view.representativeReviews.length ? view.representativeReviews.map((review) => (
            <DpLayout as="article" key={review.id}>
              <DpLayout direction="row" align="center" className="ri-review-meta">
                <DpText as="strong">{"★".repeat(review.rating)}<span>{"★".repeat(5 - review.rating)}</span></DpText>
                <DpBadge><PlatformIcon platform={review.platform} size={11} />{review.platform === "android" ? "Android" : "iOS"}</DpBadge>
                <DpText as="time">{shortDate(review.reviewedAt.slice(0, 10))}</DpText>
              </DpLayout>
              <DpText>{review.content}</DpText>
            </DpLayout>
          )) : <DpText className="ri-muted">배포 후 리뷰가 없습니다.</DpText>}
        </DpCard>
      </DpLayout>
    </DpLayout>
  );
}
