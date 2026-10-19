"use client";
import {
  MetricSparkline,
  metricTrendTone,
  releaseImpactSparklineColor,
} from "@/components/dashboard/charts/metric-sparkline";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import type { Platform } from "@/domain/types";
import { displayReleaseVersion } from "@/services/mobile/common/release-version";
import { displayedDifference, signedDelta } from "../../utils/dashboard-formatters";

import { DashboardPanelHeader } from "../../shared/dashboard-panel-header";
import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  "setView" | "platformImpacts" | "firebaseReleaseCrashes"
>;

export function DashboardImpactPanel({
  setView,
  platformImpacts,
  firebaseReleaseCrashes,
}: Props) {
  return (
    <DpCard className="mi-panel mi-dashboard-impact-panel">
      <DashboardPanelHeader title="최근 업데이트 후 달라진 점">
        <DpButton
          className="mi-dashboard-link"
          onClick={() => setView("impact")}
        >
          상세보기 <KoboyoIcon name="arrow-right" size={13} />
        </DpButton>
      </DashboardPanelHeader>
      {platformImpacts.android || platformImpacts.ios ? (
        <>
          <DpLayout className="mi-dashboard-platform-impact-grid">
            {(["android", "ios"] as Platform[]).map((platform) => {
              const releaseImpact = platformImpacts[platform];
              const crashIssue = firebaseReleaseCrashes[platform];
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
                  sparkline: releaseImpact?.sparklines.rating ?? [],
                },
                {
                  label: "부정 리뷰",
                  current: releaseImpact?.negativeReviews.after ?? null,
                  currentSuffix: "%",
                  currentDecimals: 1,
                  change: releaseImpact?.negativeReviews.changePoints ?? null,
                  changeSuffix: "%p",
                  changeDecimals: 1,
                  sparkline: releaseImpact?.sparklines.negativeReviews ?? [],
                },
                {
                  label: "리뷰 건수",
                  current: releaseImpact?.reviewCount.after ?? null,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: releaseImpact?.reviewCount.change ?? null,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: releaseImpact?.sparklines.reviewCount ?? [],
                },
                {
                  label: "배포 후 크래시 발생 건수",
                  current: crashIssue?.value ?? null,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: crashIssue?.change ?? null,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: crashIssue?.sparkline ?? [],
                },
                {
                  label: "배포 후 다운로드",
                  current: releaseImpact?.downloads.after ?? null,
                  currentSuffix: "건",
                  currentDecimals: 0,
                  change: releaseImpact?.downloads.change ?? null,
                  changeSuffix: "건",
                  changeDecimals: 0,
                  sparkline: releaseImpact?.sparklines.downloads ?? [],
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
                            v
                            {displayReleaseVersion(
                              platform,
                              releaseImpact.release.version,
                            )}
                          </DpText>
                          <DpText as="span">이전버전 대비</DpText>
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
                        <DpText
                          as="span"
                          title={
                            row.label === "배포 후 다운로드"
                              ? "배포 이후 앱 전체의 다운로드입니다. 버전별 다운로드가 아니며 iOS는 최초 다운로드를 우선 사용합니다."
                              : row.label === "배포 후 크래시 발생 건수"
                                ? "Firebase Crashlytics의 해당 버전 배포 후 FATAL 이벤트 수입니다. 한국시간 일별 기준입니다."
                                : undefined
                          }
                        >
                          {row.label}
                        </DpText>
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
                              ? row.label === "배포 후 크래시 발생 건수" &&
                                releaseImpact?.release
                                ? !crashIssue
                                  ? "불러오는 중…"
                                  : crashIssue.status === "error"
                                    ? "조회 실패"
                                    : "수집 데이터 없음"
                                : "데이터 없음"
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
                          values={row.current === null ? [] : row.sparkline}
                          singlePoint
                          smooth={false}
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
        <DpText className="mi-empty">표시할 릴리스가 없습니다.</DpText>
      )}
    </DpCard>
  );
}
