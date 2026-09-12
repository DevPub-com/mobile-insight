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

export function buildFirstOpenSeries(dates: string[], rows: ChartRow[]) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return ([
    ["android", "#0284C7"],
    ["ios", "#EA580C"],
  ] as const).map(([platform, color]) => ({
    name: `${platformLabel[platform]} 최초 실행`,
    type: "line" as const,
    data: dates.map((date) => byDate.get(date)?.[platform] ?? null),
    connectNulls: false,
    smooth: 0.2,
    symbol: "diamond",
    symbolSize: 6,
    lineStyle: { color, width: 2.25, type: "dashed" as const },
    itemStyle: { color },
  }));
}

export function DownloadChart({
  data,
  releases,
  versionMappings = [],
  metric = "downloads",
  firstOpenData,
}: {
  data: ChartRow[];
  releases: AppRelease[];
  versionMappings?: ReleaseVersionMapping[];
  metric?: "downloads" | "first_open";
  firstOpenData?: ChartRow[];
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
        ["Android 일별 사용자 설치", "android", "#16B84E"],
        ["iOS 총 다운로드", "ios", "#8B3DFF"],
      ] as const
    ).map(([name, key, color]) => ({
      name: metric === "first_open" ? `${platformLabel[key]} 최초 실행` : name,
      type: "line" as const,
      data: data.map((row) => row[key]),
      connectNulls: false,
      smooth: 0.2,
      symbol: "circle",
      symbolSize: 5,
      showSymbol: true,
      lineStyle: { color, width: 2.25, type: "solid" as const },
      itemStyle: { color, borderColor: color, borderWidth: 0 },
      markLine:
        name === "Android 일별 사용자 설치" && releaseMarkers.length
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
      color: ["#16B84E", "#8B3DFF"],
      grid: { top: firstOpenData ? 88 : 62, right: 22, bottom: 38, left: 50 },
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
      series: [...series, ...(firstOpenData ? buildFirstOpenSeries(data.map((row) => row.date), firstOpenData) : [])],
    };
  }, [data, releases, versionMappings, metric, firstOpenData]);

  if (!data.length)
    return (
      <div className="chart-empty">
        선택한 기간의 {metric === "first_open" ? "최초 실행" : "다운로드"} 데이터가 없습니다.
      </div>
    );
  return <EChart option={option} ariaLabel={metric === "first_open" ? "Firebase 최초 실행 추이" : "플랫폼별 획득 추이"} />;
}
