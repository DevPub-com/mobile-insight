"use client";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpBadge } from "@/components/ui/dp/DpBadge";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import { displayReleaseVersion } from "@/services/mobile/common/release-version";
import { date, releaseDate } from "../../utils/dashboard-formatters";

import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "latestRelease"
  | "releaseCadence"
  | "timelineScale"
  | "setTimelineScale"
  | "timelineDates"
  | "releasePlatform"
  | "setReleasePlatform"
  | "releaseSearch"
  | "setReleaseSearch"
  | "filteredReleases"
>;

export function ReleasesView({
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
}: Props) {
  return (
    <DpLayout className="mi-release-workspace">
      <DpLayout as="section" className="mi-release-summary-grid">
        {(
          [
            [
              "최신 Android 버전",
              latestRelease("android")?.version ?? "—",
              latestRelease("android")
                ? `${releaseDate(latestRelease("android")!)} 출시`
                : "릴리스 없음",
              "android",
              <PlatformIcon platform="android" size={26} key="android" />,
            ],
            [
              "최신 iOS 버전",
              latestRelease("ios")?.version ?? "—",
              latestRelease("ios")
                ? `${releaseDate(latestRelease("ios")!)} 출시`
                : "릴리스 없음",
              "ios",
              <PlatformIcon platform="ios" size={25} key="ios" />,
            ],
            [
              "최근 30일 배포 수",
              `${releaseCadence.recentCount}회`,
              releaseCadence.platforms
                .map(
                  (item) =>
                    `${item.platform === "android" ? "Android" : "iOS"} ${item.recentCount}회`,
                )
                .join(" · "),
              "deploy",
              <KoboyoIcon name="send" size={22} key="deploy" />,
            ],
            [
              "평균 배포 주기",
              <DpLayout
                as="span"
                display="grid"
                className="mi-release-cycle-values"
                key="cycles"
              >
                {releaseCadence.platforms.map((item) => (
                  <DpText as="span" wrap="inherit" key={item.platform}>
                    <DpText as="span" wrap="inherit">
                      {item.platform === "android" ? "Android" : "iOS"}
                    </DpText>
                    <DpText as="span" wrap="inherit">
                      {item.averageCycleDays === null
                        ? "—"
                        : `${item.averageCycleDays.toFixed(1)}일`}
                    </DpText>
                  </DpText>
                ))}
              </DpLayout>,
              null,
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
              {detail && <DpText as="small">{detail}</DpText>}
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
            <DpText as="h3">릴리스 타임라인</DpText>
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
                <DpText as="time">{date(releasedAt).slice(5)}</DpText>
              </DpLayout>
            ))}
          </DpLayout>
        ) : (
          <DpText className="mi-empty">릴리스 이력이 없습니다.</DpText>
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
                <DpLayout>
                  <DpLayout
                    direction="row"
                    align="center"
                    className="mi-release-version-heading"
                  >
                    <DpText as="strong">
                      {displayReleaseVersion(item.platform, item.version)}
                    </DpText>
                    {latestRelease(item.platform)?.id === item.id && (
                      <DpBadge className="mi-release-latest-badge">
                        최신
                      </DpBadge>
                    )}
                  </DpLayout>
                  <DpText as="small">
                    {item.buildNumber
                      ? `build ${item.buildNumber}`
                      : "빌드 식별자 미수집"}
                  </DpText>
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
            <DpText className="mi-empty">조건에 맞는 릴리스가 없습니다.</DpText>
          )}
        </DpLayout>
        <DpLayout
          direction="row"
          align="center"
          justify="between"
          className="mi-release-table-foot"
        >
          <DpText as="span">총 {filteredReleases.length}개 릴리스</DpText>
          <DpText as="span">최신순</DpText>
        </DpLayout>
      </DpCard>
    </DpLayout>
  );
}
