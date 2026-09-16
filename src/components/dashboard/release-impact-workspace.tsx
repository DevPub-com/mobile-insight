"use client";
import { NonfatalPanel } from "./nonfatal-panel";

import { displayReleaseVersion } from "@/services/mobile/common/release-version";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { PlatformIcon } from "@/components/dashboard/platform-icon";
import { ReleaseImpactTrendChart } from "@/components/dashboard/release-impact-trend-chart";
import { ReleaseImpactAiBriefingCard } from "@/components/dashboard/release-impact-ai-briefing";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import * as Select from "@radix-ui/react-select";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import type { DashboardData } from "@/domain/types";
import {
  buildReleaseImpactWorkspace,
  compareVersionsDescending,
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
    <DpCard as="article" className={`mi-dashboard-kpi-card ri-kpi ri-kpi--${tone}`}>
      <DpLayout direction="row" align="center" className="ri-kpi-heading">
        <span className="ri-kpi-icon" aria-hidden="true">{icon}</span>
        <DpText as="h3">{title}</DpText>
      </DpLayout>
      <DpLayout className="ri-kpi-copy">
        <DpText as="strong" className={value === "수집 데이터 없음" ? "ri-kpi-no-data" : undefined}>{value}</DpText>
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
  const [releaseId, setReleaseId] = useState(releases[0]?.id ?? "");
  const release = releases.find((item) => item.id === releaseId) ?? releases[0] ?? null;
  const baseView = useMemo(
    () => (release ? buildReleaseImpactWorkspace(data, release) : null),
    [data, release],
  );

  const syncRevision=data.syncRuns.map(r=>r.finishedAt??'').sort().at(-1)??'';
  const requestKey=`${release?.id}:${syncRevision}`;
  const [firebase,setFirebase]=useState<{key:string;view?:NonNullable<typeof baseView>;error?:string}|null>(null);
  useEffect(()=>{
    if(!release)return;
    const controller=new AbortController();
    const url=`/api/dashboard/${encodeURIComponent(data.app.code)}/release-impact?platform=${release.platform}&version=${encodeURIComponent(release.version)}`;
    fetch(url,{signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw Error(body.error);if(!controller.signal.aborted)setFirebase({key:requestKey,view:body.data});}).catch(()=>{if(!controller.signal.aborted)setFirebase({key:requestKey,error:'Firebase 데이터를 불러오지 못했습니다.'});});
    return()=>controller.abort();
  },[data.app.code,release,requestKey]);
  const firebaseView=firebase?.key===requestKey?firebase.view:undefined;
  const firebaseError=firebase?.key===requestKey?firebase.error:undefined;
  const view=firebaseView??(baseView?{...baseView,crashReports:{...baseView.crashReports,before:null,after:null,change:null,latestDate:null,afterDays:0},anrReports:{before:null,after:null},daily:baseView.daily.map(d=>({...d,crashes:null,anrs:null,crashUsers:null,anrUsers:null}))}:null);

  if (!view || !release) {
    return (
      <DpCard className="ri-empty">
        <DpText>분석할 릴리즈 데이터가 없습니다.</DpText>
      </DpCard>
    );
  }

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
    rows.push(["일평균 다운로드", view.downloadDailyAverage.before, view.downloadDailyAverage.after, view.downloadDailyAverage.change]);
    rows.push(["ANR 보고 건수 (버전별)", view.anrReports.before, view.anrReports.after, null]);
    rows.push([`크래시 보고 건수 (${view.crashReports.scope})`, view.crashReports.before, view.crashReports.after, view.crashReports.change]);
    const csv = rows.filter(row => row[0] !== (release.platform === "android" ? "iOS 평점" : "Android 평점") && (release.platform === "android" || !["비정상 종료율", "ANR 발생률"].includes(String(row[0]))))
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
    ...(release.platform === "android" ? [{ label: "ANR 보고 건수 (버전별)", before: formatNumber(view.anrReports.before), after: formatNumber(view.anrReports.after), change: "—", percent: null, direction: null, lowerIsBetter: true }] : []),
    { label: `크래시 보고 건수 (${view.crashReports.scope === "version" ? "버전별" : "앱 전체"})`, before: formatNumber(view.crashReports.before), after: formatNumber(view.crashReports.after), change: signed(view.crashReports.change, "건"), percent: null, direction: null, lowerIsBetter: true },
    {
      label: "일평균 다운로드 (앱 전체)",
      before: formatNumber(view.downloadDailyAverage.before, 1),
      after: formatNumber(view.downloadDailyAverage.after, 1),
      change: signed(view.downloadDailyAverage.change, "건", 1),
      percent: view.downloadDailyAverage.changePercent,
      direction: view.downloadDailyAverage.changePercent,
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
      label: "수집 리뷰 수 (표본)",
      before: `${formatNumber(view.newReviews.before)}건`,
      after: `${formatNumber(view.newReviews.after)}건`,
      change: signed(view.newReviews.change, "건"),
      percent: view.newReviews.changePercent,
      direction: null,
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
  ].filter(row => row.label !== (release.platform === "android" ? "iOS 평점" : "Android 평점") && (release.platform === "android" || !["비정상 종료율", "ANR 발생률"].includes(row.label)));


  return (
    <DpLayout className="ri-workspace">
      <DpLayout
        direction="row"
        align="center"
        justify="between"
        className="ri-toolbar"
      >
        <DpLayout direction="row" className="ri-toolbar-controls">
          <Select.Root value={release.id} onValueChange={setReleaseId}>
            <Select.Trigger className="app-selector" aria-label="분석할 릴리즈 버전">
              <Select.Value />
              <Select.Icon><KoboyoIcon name="chevron-down" size={14} /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="select-content" position="popper" sideOffset={8}>
                <Select.Viewport>
                  {releases.map((item) => (
                    <Select.Item className="select-item" key={item.id} value={item.id}>
                      <Select.ItemText>
                        <span className={`select-item__app ri-release-option ri-release-option--${item.platform}`}>
                          <PlatformIcon platform={item.platform} size={16} />
                          {item.platform === "android" ? "Android" : "iOS"} · v{item.version.replace(/^v/, "")}
                        </span>
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </DpLayout>
        <DpButton className="ri-export" onClick={exportCsv}>
          <KoboyoIcon name="download" size={15} /> 내보내기
        </DpButton>
      </DpLayout>

      <ReleaseImpactAiBriefingCard
        appCode={data.app.code}
        key={`${data.app.code}:${release.id}:${data.syncRuns.map(run => run.finishedAt ?? "").sort().at(-1) ?? ""}`}
        releaseId={release.id}
      />

      <DpLayout as="section" className="ri-kpi-grid">
        <KpiCard icon={<KoboyoIcon name="star" size={20} />} title="버전 리뷰 평점"
          value={view.ratings[release.platform].after === null ? "수집 데이터 없음" : formatNumber(view.ratings[release.platform].after, 2)}
          detail={<><Delta value={view.ratings[release.platform].change} suffix="점" decimals={2} /><span className="ri-kpi-coverage">수집 리뷰 {formatNumber(view.newReviews.after)}건 · 이전버전 대비</span></>} tone="green" />
        <KpiCard icon={<KoboyoIcon name="message-square" size={20} />} title="부정 리뷰 비율"
          value={view.negativeReviews.after === null ? "수집 데이터 없음" : formatRate(view.negativeReviews.after)}
          detail={<><Delta value={view.negativeReviews.change} suffix="%p" lowerIsBetter /><span className="ri-kpi-coverage">해당 버전의 1~2점 리뷰 비율</span></>} tone="orange" />
        <KpiCard icon={<KoboyoIcon name="bug" size={20} />} title="배포 후 크래시 보고 건수"
          value={view.crashReports.after === null ? (!firebaseView ? (firebaseError ? "조회 실패" : "불러오는 중…") : "기록 없음") : `${formatNumber(view.crashReports.after)}건`}
          detail={<>{"Firebase Crashlytics"}<span className="ri-kpi-coverage">{view.crashReports.latestDate ? `${shortDate(view.crashReports.latestDate)}까지 · ${view.crashReports.afterDays}일 수집` : "해당 기간 보고서 없음"}</span></>} tone="red" />
        <KpiCard icon={<KoboyoIcon name="download" size={20} />} title="배포 후 다운로드"
          value={view.downloads.after === null ? "미수집" : formatNumber(view.downloads.after)}
          detail={<>앱 전체 · 일평균 {formatNumber(view.downloadDailyAverage.after, 1)}건<span className="ri-kpi-coverage">{view.coverage.afterDays}/{view.coverage.expectedDays}일 수집 · <Delta value={view.downloadDailyAverage.changePercent} /></span></>} tone="blue" />
      </DpLayout>

      <DpLayout as="section" className={`ri-main-grid ${release.platform === "android" ? "ri-three-column-grid" : "ri-two-column-grid"}`}>
        {(release.platform === "android" ? ["rating", "crashes", "anrs"] as const : ["rating", "crashes"] as const).map(metric => (
          <DpCard className="ri-card ri-trend-card" key={metric}>
            <DpLayout className="ri-card-head">
              <DpText as="h3">{{rating: "평균 리뷰 평점", crashes: "크래시 건수 / 영향받은 사용자", anrs: "ANR 건수 / 영향받은 사용자"}[metric]}</DpText>
              <DpText title={metric === "rating" ? undefined : "Firebase Crashlytics · 사용자: 고유 앱 설치 ID 기준 · 한국시간 일별 집계"}>{metric !== "rating" ? "Firebase · " : ""}이전 {view.previousRelease ? `v${displayReleaseVersion(release.platform, view.previousRelease.version)}` : "버전 없음"} / 선택 v{displayReleaseVersion(release.platform, release.version)} · 각 버전 배포일 0일 기준</DpText>
            </DpLayout>
            {view.daily.some(point => point[metric] != null || (metric === "crashes" && point.crashUsers != null) || (metric === "anrs" && point.anrUsers != null)) ? (
              <ReleaseImpactTrendChart data={view.daily} metric={metric}
                beforeLabel={view.previousRelease ? `v${displayReleaseVersion(release.platform, view.previousRelease.version)}` : "이전 버전"}
                afterLabel={`v${displayReleaseVersion(release.platform, release.version)}`} />
            ) : <DpText className="ri-chart-empty">{metric === "rating" ? "비교 기간에 해당 버전의 리뷰가 없습니다." : (firebaseError ?? (!firebaseView ? "Firebase 데이터를 불러오는 중…" : "해당 기간의 Firebase 기록이 없습니다."))}</DpText>}
          </DpCard>
        ))}
      </DpLayout>

      <DpLayout as="section" className={`ri-bottom-grid ri-two-column-grid ri-change-grid ri-change-grid--${release.platform}`}>
        <DpCard className="ri-card ri-comparison">
          <div className="ri-change-header"><DpText as="h3">최근 업데이트 후 달라진 점</DpText></div>
          <div className="ri-table-scroll">
            <div className="ri-table ri-table-head">
              <span>지표</span>
              <span>이전</span>
              <span>현재</span>
              <span>변화</span>
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
                    <strong title={label}>{label.replace(/ \(.*\)$/, "").replace("ANR 보고 건수", "ANR 건수").replace("크래시 보고 건수", "크래시 건수").replace("수집 리뷰 수", "리뷰 수")}</strong>
                    <span>{before}</span>
                    <span>{after}</span>
                    <span
                      className={
                        direction === null || direction === 0
                          ? "ri-muted"
                          : improved
                            ? "ri-good"
                            : "ri-bad"
                      }
                    title={percent === null ? undefined : `증감률 ${signed(percent, "%", 1)}`}
                    >
                      {change}
                    </span>

                  </div>
                );
              },
            )}
          </div>
        </DpCard>

        <DpCard className="ri-card ri-voc">
          <div className="ri-change-header"><DpText as="h3">VOC 변화</DpText><div className="ri-voc-legend"><span><i/>이전</span><span><b/>현재</span></div></div>
          {view.voc.map((item) => (
            <DpLayout
              as="article"
              direction="row"
              align="center"
              key={item.label}
            >
              <DpText as="strong">{item.label}</DpText>
              <DpLayout className="ri-voc-bars" title={`이전 ${item.before}건 · 현재 ${item.after}건`} aria-label={`이전 ${item.before}건, 현재 ${item.after}건`}>
                <i style={{ width: `${(item.before / maxVoc) * 100}%` }} />
                <b style={{ width: `${(item.after / maxVoc) * 100}%` }} />
              </DpLayout>
              <DpText as="span">
                <span className="ri-voc-change" title={item.changePercent === null ? "비교할 데이터가 없습니다." : undefined}>{item.changePercent === null ? "—" : item.changePercent === 0 ? "0.0%" : signed(item.changePercent,"%",1)}</span>
              </DpText>
            </DpLayout>
          ))}

        </DpCard>


      </DpLayout>

      <NonfatalPanel key={`${release.id}:${data.syncRuns.map(r=>r.finishedAt??'').sort().at(-1)??''}`} appId={data.app.id} releaseId={release.id} platform={release.platform} releasedAt={release.releasedAt} />
    </DpLayout>
  );
}
