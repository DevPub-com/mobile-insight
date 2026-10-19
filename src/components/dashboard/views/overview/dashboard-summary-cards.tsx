"use client";
import {
  MetricSparkline,
  metricTrendTone,
} from "@/components/dashboard/charts/metric-sparkline";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import { audienceDailyDifference } from "@/services/mobile/tabs/active-audience.service";
import {
  date,
  number,
  percent,
  rating,
  ratingSparklineValues,
  signedDelta,
} from "../../utils/dashboard-formatters";
import {
  AudienceDifference,
  DashboardCardTitle,
  PlatformMetric,
} from "../../shared/dashboard-presentation";
import { FirebaseCrashImpactMetrics } from "../../shared/firebase-crash-impact-metrics";

import type { DashboardModel } from "../../hooks/use-dashboard-model";

type Props = Pick<
  DashboardModel,
  | "combinedAudience"
  | "data"
  | "audience"
  | "dateRange"
  | "storeRatings"
  | "periodLabel"
  | "periodSummary"
  | "ratingTrend"
  | "androidNegativeReviews"
  | "dashboardSummary"
  | "iosNegativeReviews"
>;

export function DashboardSummaryCards({
  combinedAudience,
  data,
  audience,
  dateRange,
  storeRatings,
  periodLabel,
  periodSummary,
  ratingTrend,
  androidNegativeReviews,
  dashboardSummary,
  iosNegativeReviews,
}: Props) {
  return (
    <>
      <DpLayout as="section" className="mi-dashboard-kpi-grid">
        <DpCard className="mi-dashboard-kpi-card">
          <DpLayout
            display="grid"
            className="mi-audience-values mi-audience-values--divided"
          >
            <DpLayout direction="col" title="최근 28일 활성 사용자 합계">
              <DpText as="span">MAU</DpText>
              <DpText as="strong">
                {number(
                  combinedAudience
                    ? combinedAudience.androidMau! + combinedAudience.iosMau!
                    : null,
                )}
              </DpText>
              <AudienceDifference
                value={audienceDailyDifference(
                  data.metrics,
                  data.app.id,
                  combinedAudience?.date,
                  "total",
                  "mau",
                )}
              />
              <div
                className="mi-audience-sparkline"
                aria-label="통합 MAU 일별 추이"
              >
                <MetricSparkline
                  values={audience.trend.flatMap((row) =>
                    row.androidMau === null || row.iosMau === null
                      ? []
                      : [row.androidMau + row.iosMau],
                  )}
                  color="#4B5563"
                  smooth={false}
                  singlePoint
                />
              </div>
            </DpLayout>
            <DpLayout direction="col">
              <DpText as="span">DAU</DpText>
              <DpText as="strong">
                {number(
                  combinedAudience
                    ? combinedAudience.androidDau! + combinedAudience.iosDau!
                    : null,
                )}
              </DpText>
              <AudienceDifference
                value={audienceDailyDifference(
                  data.metrics,
                  data.app.id,
                  combinedAudience?.date,
                  "total",
                  "dau",
                )}
              />
              <div
                className="mi-audience-sparkline"
                aria-label="통합 DAU 일별 추이"
              >
                <MetricSparkline
                  values={audience.trend.flatMap((row) =>
                    row.androidDau === null || row.iosDau === null
                      ? []
                      : [row.androidDau + row.iosDau],
                  )}
                  color="#F97316"
                  smooth={false}
                  singlePoint
                />
              </div>
            </DpLayout>
          </DpLayout>
        </DpCard>
        <DpCard className="mi-dashboard-kpi-card">
          <DashboardCardTitle
            icon={<KoboyoIcon name="bug" size={18} />}
            tone="red"
            tooltip="일별 Firebase Crashlytics 크래시 영향 고유 설치 수 ÷ GA4 DAU × 100. 플랫폼·전체 버전·GA4 속성 시간대를 맞춰 계산합니다. 대표값은 선택 기간 내 두 데이터가 있는 최근 완료일이며 전날 대비 %p를 표시합니다. 사용자 식별·수집 기준이 달라 Firebase 공식 비율과 차이가 있을 수 있으며, 일별 고유 사용자를 합산하지 않습니다."
          >
            크래시 사용자 비율
          </DashboardCardTitle>
          <DpLayout direction="row" className="mi-dashboard-platform-split">
            <FirebaseCrashImpactMetrics
              appId={data.app.id}
              range={dateRange}
              observations={data.metricObservations ?? []}
            />
          </DpLayout>
        </DpCard>
        <DpCard className="mi-dashboard-kpi-card mi-dashboard-overall-card mi-store-rating-card">
          <DashboardCardTitle
            icon={<KoboyoIcon name="star" size={17} />}
            tone="blue"
            tooltip="Android는 기본 Google Play 평점, iOS는 App Store 평점입니다. Google Play 기본 평점은 전체 기간 단순 평균과 다른 지표입니다."
          >
            스토어 평점
          </DashboardCardTitle>
          <DpLayout direction="row" className="mi-dashboard-platform-split">
            {(["android", "ios"] as const).map((platform) => (
              <DpLayout
                key={platform}
                className={`mi-platform-metric mi-platform-metric--${platform}`}
              >
                <DpLayout
                  direction="row"
                  align="center"
                  className="mi-platform-metric-label"
                >
                  <PlatformIcon platform={platform} size={17} />
                  <DpText as="span">
                    {platform === "android" ? "Android" : "iOS"}
                  </DpText>
                </DpLayout>
                <DpText as="strong">
                  {storeRatings[platform]?.value.toFixed(
                    platform === "android" ? 3 : 2,
                  ) ?? "—"}
                </DpText>
                <DpText
                  as="span"
                  className={`mi-platform-delta ${metricTrendTone(storeRatings[platform]?.change ?? null)}`}
                  title={
                    storeRatings[platform]
                      ? `${date(storeRatings[platform].date)} · ${storeRatings[platform].source === "manual" ? "수동 확인" : "수집 기준"} · 직전 기록 대비`
                      : "미수집"
                  }
                >
                  {storeRatings[platform]?.change == null
                    ? "—"
                    : `${storeRatings[platform].change > 0 ? "▲" : storeRatings[platform].change < 0 ? "▼" : "—"} ${Math.abs(storeRatings[platform].change).toFixed(3)}`}
                </DpText>
                <MetricSparkline
                  values={storeRatings[platform]?.trend ?? []}
                  color={platform === "android" ? "#22A447" : "#8B5CF6"}
                  singlePoint
                  smooth={false}
                />
              </DpLayout>
            ))}
          </DpLayout>
        </DpCard>
      </DpLayout>
      <DpLayout
        as="section"
        className="mi-dashboard-overall-grid"
        aria-label="전체 기간 지표"
      >
        <DpCard className="mi-dashboard-kpi-card mi-dashboard-overall-card">
          <DpLayout direction="row" className="mi-dashboard-platform-split">
            {(["android", "ios"] as const).map((platform) => (
              <DpLayout
                key={platform}
                className={`mi-platform-metric mi-platform-metric--${platform}`}
              >
                <DpLayout
                  direction="row"
                  align="center"
                  className="mi-platform-metric-label"
                >
                  <PlatformIcon platform={platform} size={17} />
                  <DpText>{platform === "android" ? "Android" : "iOS"}</DpText>
                </DpLayout>
                <DpLayout display="grid" className="mi-audience-values">
                  <DpLayout direction="col" title="최근 28일 활성 사용자">
                    <DpText as="span">MAU</DpText>
                    <DpText as="strong">
                      {number(audience.latest[platform]?.mau ?? null)}
                    </DpText>
                    <AudienceDifference
                      value={audienceDailyDifference(
                        data.metrics,
                        data.app.id,
                        audience.latest[platform]?.date,
                        platform,
                        "mau",
                      )}
                    />
                    <div
                      className="mi-audience-sparkline"
                      aria-label={`${platform} MAU 일별 추이`}
                    >
                      <MetricSparkline
                        values={audience.trend.flatMap((row) =>
                          row[`${platform}Mau`] === null
                            ? []
                            : [row[`${platform}Mau`]!],
                        )}
                        color={platform === "android" ? "#22A447" : "#8B5CF6"}
                        smooth={false}
                        singlePoint
                      />
                    </div>
                  </DpLayout>
                  <DpLayout direction="col">
                    <DpText as="span">DAU</DpText>
                    <DpText as="strong">
                      {number(audience.latest[platform]?.dau ?? null)}
                    </DpText>
                    <AudienceDifference
                      value={audienceDailyDifference(
                        data.metrics,
                        data.app.id,
                        audience.latest[platform]?.date,
                        platform,
                        "dau",
                      )}
                    />
                    <div
                      className="mi-audience-sparkline"
                      aria-label={`${platform} DAU 일별 추이`}
                    >
                      <MetricSparkline
                        values={audience.trend.flatMap((row) =>
                          row[`${platform}Dau`] === null
                            ? []
                            : [row[`${platform}Dau`]!],
                        )}
                        color={platform === "android" ? "#22A447" : "#8B5CF6"}
                        smooth={false}
                        singlePoint
                      />
                    </div>
                  </DpLayout>
                </DpLayout>
              </DpLayout>
            ))}
          </DpLayout>
        </DpCard>
        <DpLayout display="grid" className="mi-rating-summary-pair">
          <DpCard className="mi-dashboard-kpi-card">
            <DashboardCardTitle
              icon={<KoboyoIcon name="star" size={17} />}
              tone="blue"
            >
              최근 {periodLabel} 평점
            </DashboardCardTitle>
            <DpLayout direction="row" className="mi-dashboard-platform-split">
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
              icon={<KoboyoIcon name="shield-alert" size={17} />}
              tone="red"
              tooltip="선택 기간에 수집된 플랫폼별 작성 리뷰 중 1~2점 리뷰 수 ÷ 전체 작성 리뷰 수 × 100. 선택 기간을 하루 앞당긴 전날 기준 동일 길이 기간과 비교합니다. 별점만 남긴 평가는 포함하지 않습니다."
            >
              부정 리뷰 비율
            </DashboardCardTitle>
            <DpLayout direction="row" className="mi-dashboard-platform-split">
              <PlatformMetric
                platform="android"
                value={percent(androidNegativeReviews.current)}
                change={androidNegativeReviews.change}
                statusLabel={
                  androidNegativeReviews.change === null
                    ? "이전 리뷰 없음"
                    : `전날 대비 ${signedDelta(androidNegativeReviews.change, 1, "%p")}`
                }
                changeSuffix="%p"
                sparkline={
                  dashboardSummary.kpis.negativeReviews.android.sparkline
                }
              />
              <PlatformMetric
                platform="ios"
                value={percent(iosNegativeReviews.current)}
                change={iosNegativeReviews.change}
                statusLabel={
                  iosNegativeReviews.change === null
                    ? "이전 리뷰 없음"
                    : `전날 대비 ${signedDelta(iosNegativeReviews.change, 1, "%p")}`
                }
                changeSuffix="%p"
                sparkline={dashboardSummary.kpis.negativeReviews.ios.sparkline}
              />
            </DpLayout>
          </DpCard>
        </DpLayout>
      </DpLayout>
    </>
  );
}
