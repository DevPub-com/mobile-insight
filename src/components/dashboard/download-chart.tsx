"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useMemo } from "react";

import { EChart } from "@/components/dashboard/echart";
import type {
  AppRelease,
  Platform,
  ReleaseVersionMapping,
} from "@/domain/types";

type ChartRow = {
  date: string;
  android: number | null;
  ios: number | null;
  total: number | null;
};
const formatNumber = (value: number) =>
  new Intl.NumberFormat("ko-KR").format(value);
const formatAxisNumber = (value: number) => {
  if (value === 0) return "0";
  if (value >= 10_000) return `${Number((value / 10_000).toFixed(1))}만`;
  if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}천`;
  return formatNumber(value);
};

type ReleaseMarker = {
  xAxis: number;
  label: string;
};

const platformLabel: Record<Platform, string> = {
  android: "Android",
  ios: "iOS",
};

function canonicalSemanticVersion(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^v?(\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?)$/i,
  );
  return match?.[1] ?? null;
}

function semanticVersionForRelease(
  release: AppRelease,
  versionMappings: ReleaseVersionMapping[],
): string | null {
  const rawVersion = release.version.trim();
  const semanticVersion = canonicalSemanticVersion(rawVersion);
  if (semanticVersion) return semanticVersion;
  if (!/^\d+$/.test(rawVersion)) return null;
  if (release.platform !== "android") return null;

  const buildNumbers = new Set(
    (release.buildNumber ?? rawVersion)
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite),
  );
  const matchedVersions = new Set(
    versionMappings.flatMap((mapping) => {
      if (
        mapping.platform !== "android" ||
        !buildNumbers.has(mapping.appVersionCode)
      ) {
        return [];
      }
      const mappedVersion = canonicalSemanticVersion(mapping.version);
      return mappedVersion ? [mappedVersion] : [];
    }),
  );
  return matchedVersions.size === 1 ? [...matchedVersions][0] : null;
}

function releaseMarkerLabel(
  release: AppRelease,
  versionMappings: ReleaseVersionMapping[],
) {
  const rawVersion = release.version.trim();
  const semanticVersion = semanticVersionForRelease(release, versionMappings);
  const versionLabel = semanticVersion
    ? `v${semanticVersion.replace(/^v/i, "")}`
    : /^\d+$/.test(rawVersion)
      ? `build ${rawVersion}`
      : rawVersion;
  return `${platformLabel[release.platform]} · ${versionLabel}`;
}

export function buildReleaseMarkers(
  dates: string[],
  releases: AppRelease[],
  versionMappings: ReleaseVersionMapping[],
): ReleaseMarker[] {
  const visibleDates = new Set(dates);
  const labelsByDate = new Map<string, string[]>();

  for (const release of releases) {
    const releasedAt = release.releasedAt.slice(0, 10);
    if (!visibleDates.has(releasedAt)) continue;
    const labels = labelsByDate.get(releasedAt) ?? [];
    const label = releaseMarkerLabel(release, versionMappings);
    if (!labels.includes(label)) labels.push(label);
    labelsByDate.set(releasedAt, labels);
  }

  return [...labelsByDate]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([releasedAt, labels]) => ({
      xAxis: dates.indexOf(releasedAt),
      label: labels.sort((left, right) => {
        const leftOrder = left.startsWith("Android") ? 0 : 1;
        const rightOrder = right.startsWith("Android") ? 0 : 1;
        return leftOrder - rightOrder || left.localeCompare(right);
      }).join("\n"),
    }));
}

export function DownloadChart({
  data,
  releases,
  versionMappings = [],
}: {
  data: ChartRow[];
  releases: AppRelease[];
  versionMappings?: ReleaseVersionMapping[];
}) {
  const option = useMemo<EChartsCoreOption>(() => {
    const releaseMarkers = buildReleaseMarkers(
      data.map((item) => item.date),
      releases,
      versionMappings,
    );
    const xAxisLabelInterval = Math.max(0, Math.ceil(data.length / 8) - 1);
    const series = (
      [
        ["전체", "total", "#8993A7"],
        ["Android", "android", "#16B84E"],
        ["iOS", "ios", "#8B3DFF"],
      ] as const
    ).map(([name, key, color]) => ({
      name,
      type: "line" as const,
      data: data.map((row) => row[key]),
      connectNulls: true,
      smooth: 0.2,
      symbol: "circle",
      symbolSize: 5,
      showSymbol: true,
      lineStyle: { color, width: 2.25, type: "solid" as const },
      itemStyle: { color, borderColor: color, borderWidth: 0 },
      markLine:
        name === "전체" && releaseMarkers.length
          ? {
              silent: true,
              symbol: "none",
              lineStyle: {
                color: "#b8c0cc",
                type: "dashed" as const,
                width: 1,
              },
              label: {
                color: "#465267",
                fontSize: 9,
                fontWeight: 600,
                lineHeight: 13,
                formatter: (params: { data?: { label?: string } }) =>
                  params.data?.label ?? "",
              },
              data: releaseMarkers.map((marker) => ({
                xAxis: marker.xAxis,
                label: marker.label,
              })),
            }
          : undefined,
    }));

    return {
      animationDuration: 350,
      aria: { enabled: true },
      color: ["#8993A7", "#16B84E", "#8B3DFF"],
      grid: { top: 62, right: 22, bottom: 38, left: 50 },
      legend: {
        top: 12,
        left: 12,
        itemWidth: 20,
        itemHeight: 6,
        itemGap: 20,
        textStyle: { color: "#465267", fontSize: 10 },
      },
      tooltip: {
        trigger: "axis",
        borderColor: "#dfe4ec",
        borderWidth: 1,
        backgroundColor: "rgba(255,255,255,.96)",
        textStyle: { color: "#1d2939", fontSize: 11 },
        valueFormatter: (value: unknown) =>
          value == null ? "데이터 없음" : formatNumber(Number(value)),
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((row) => row.date.slice(5).replace("-", ".")),
        axisLine: { lineStyle: { color: "#dfe5ed" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#7b8798",
          fontSize: 10,
          hideOverlap: true,
          interval: xAxisLabelInterval,
          showMinLabel: true,
          showMaxLabel: true,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        splitNumber: 5,
        axisLabel: {
          color: "#7b8798",
          fontSize: 10,
          formatter: formatAxisNumber,
        },
        splitLine: { lineStyle: { color: "#e8edf5", type: "dashed" } },
      },
      series,
    };
  }, [data, releases, versionMappings]);

  if (!data.length)
    return (
      <div className="chart-empty">
        선택한 기간의 다운로드 데이터가 없습니다.
      </div>
    );
  return <EChart option={option} ariaLabel="Android 및 iOS 다운로드 추이" />;
}
