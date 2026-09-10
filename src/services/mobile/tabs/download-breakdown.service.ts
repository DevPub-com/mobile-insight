import { parseModelMetricKey } from "@/domain/model-downloads";
import type { MetricObservation, Platform } from "@/domain/types";
import type { MetricDateRange } from "../common/metrics-calculator";

export type ModelDownloadRow = {
  model: string;
  platform: Platform;
  downloads: number | null;
  installs: number | null;
  days: number;
};

export function buildModelDownloads(observations: Array<Pick<MetricObservation, "appId" | "platform" | "date" | "metricKey" | "value" | "quality">>, range: MetricDateRange, appId: string): ModelDownloadRow[] {
  const grouped = new Map<string, ModelDownloadRow & { dates: Set<string> }>();
  for (const item of observations) {
    if (item.appId !== appId || item.date < range.startDate || item.date > range.endDate || item.value === null || !Number.isFinite(item.value) || item.value < 0 || item.quality === "unavailable") continue;
    const dimension = parseModelMetricKey(item.metricKey);
    if (!dimension) continue;
    const key = JSON.stringify([item.platform, dimension.model]);
    const row = grouped.get(key) ?? { model: dimension.model, platform: item.platform, downloads: null, installs: null, days: 0, dates: new Set<string>() };
    row[dimension.measure] = (row[dimension.measure] ?? 0) + item.value;
    row.dates.add(item.date);
    grouped.set(key, row);
  }
  return [...grouped.values()].map(({ dates, ...row }) => ({ ...row, days: dates.size }))
    .sort((a, b) => (b.installs ?? -1) - (a.installs ?? -1) || a.model.localeCompare(b.model));
}

export function buildOsDownloadShare(android: number | null, ios: number | null) {
  const total = android === null || ios === null ? null : android + ios;
  return [
    { platform: "android" as const, label: "Android", downloads: android },
    { platform: "ios" as const, label: "iOS", downloads: ios },
  ].map((row) => ({
    ...row,
    share: total !== null && total > 0 && row.downloads !== null
      ? (row.downloads / total) * 100
      : null,
  }));
}
