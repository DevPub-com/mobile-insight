"use client";
import {
  MetricSparkline,
  metricTrendTone,
} from "@/components/dashboard/charts/metric-sparkline";
import { PlatformIcon } from "@/components/dashboard/shared/platform-icon";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";
import {
  reviewDeviceLabel,
  reviewDeviceSpecs,
} from "@/domain/reviews/review.service";
import type { DashboardData, Platform } from "@/domain/types";
import { type ReactNode } from "react";
import { number } from "../utils/dashboard-formatters";
export function Change({
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
      {comparisonLabel && (
        <DpText as="small" wrap="inherit">
          ({comparisonLabel})
        </DpText>
      )}
    </DpText>
  );
}

export function DashboardCardTitle({
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

export function AudienceDifference({ value }: { value: number | null }) {
  return (
    <DpText as="span" className={`mi-platform-delta ${metricTrendTone(value)}`}>
      {value === null
        ? "전날 대비 비교 불가"
        : `전날 대비 ${value > 0 ? "▲" : value < 0 ? "▼" : "—"} ${number(Math.abs(value))}명`}
    </DpText>
  );
}

export function PlatformMetric({
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

export function ReviewStars({ rating }: { rating: number }) {
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

export function ReviewDevice({
  review,
}: {
  review: DashboardData["reviews"][number];
}) {
  const label = reviewDeviceLabel(review);
  if (!label && !review.deviceMetadata && !review.androidOsVersion) return null;
  const details = [label, ...reviewDeviceSpecs(review)]
    .filter(Boolean)
    .join(" · ");
  return (
    <DpText
      as="span"
      wrap="inherit"
      className="mi-review-device"
      title={`작성 단말: ${details}`}
      aria-label={`작성 단말: ${details}`}
    >
      <svg
        width="13"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M10 5h4M11 19h2" />
      </svg>
      <DpText as="span" wrap="inherit">
        {details}
      </DpText>
    </DpText>
  );
}
