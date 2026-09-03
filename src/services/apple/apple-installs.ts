import { gunzipSync } from "node:zlib";

import { parse } from "csv-parse/sync";

import type { DailyMetric, MetricObservation } from "@/domain/types";
import { parseNumber } from "@/lib/number";

type Row = Record<string, string>;
type JsonResource<T> = { id: string; attributes: T };
type ListResponse<T> = {
  data: Array<JsonResource<T>>;
  links?: { next?: string };
};
type RequestResponse = ListResponse<{
  accessType: string;
  stoppedDueToInactivity?: boolean;
}>;
type ReportResponse = ListResponse<{ name: string; category: string }>;
type InstanceResponse = ListResponse<{
  granularity: string;
  processingDate?: string;
}>;
type SegmentResponse = ListResponse<{
  url: string;
  checksum?: string;
  sizeInBytes?: number;
}>;

export type AppleAnalyticsJson = <T>(
  path: string,
  init?: RequestInit,
) => Promise<T>;

export type AppleAnalyticsOptions = {
  accessType?: "ONGOING" | "ONE_TIME_SNAPSHOT";
  maxInstances?: number | null;
};

export type AppleAnalyticsReportOptions = AppleAnalyticsOptions & {
  category: string;
  reportNameIncludes: string;
};

export function parseAppleInstallRows(
  appId: string,
  appleAppId: string,
  rows: Row[],
): DailyMetric[] {
  const byDate = new Map<
    string,
    { installs: number; uninstalls: number; hasInstalls: boolean; hasUninstalls: boolean }
  >();
  for (const row of rows) {
    if (row["App Apple Identifier"] !== appleAppId || !row.Date) continue;
    const count = parseNumber(row.Counts);
    if (count === null) continue;
    const point = byDate.get(row.Date) ?? {
      installs: 0,
      uninstalls: 0,
      hasInstalls: false,
      hasUninstalls: false,
    };
    if (row.Event === "Install") {
      point.installs += count;
      point.hasInstalls = true;
    } else if (row.Event === "Delete") {
      point.uninstalls += count;
      point.hasUninstalls = true;
    }
    byDate.set(row.Date, point);
  }
  return [...byDate]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, point]) => ({
      appId,
      platform: "ios" as const,
      date,
      downloads: null,
      installs: point.hasInstalls ? point.installs : null,
      uninstalls: point.hasUninstalls ? point.uninstalls : null,
      crashes: null,
      anrs: null,
      rating: null,
      ratingCount: null,
      reviewCount: null,
      active1DayUsers: null,
      active7DayUsers: null,
      active28DayUsers: null,
      sessions: null,
    }));
}

export function parseAppleInstallReport(
  appId: string,
  appleAppId: string,
  rows: Row[],
  observedAt = new Date().toISOString(),
): { metrics: DailyMetric[]; observations: MetricObservation[] } {
  const metrics = parseAppleInstallRows(appId, appleAppId, rows);
  const observations: MetricObservation[] = [];
  for (const metric of metrics) {
    if (metric.installs !== null && metric.installs !== undefined) {
      observations.push({
        appId,
        platform: "ios",
        date: metric.date,
        metricKey: "installs",
        value: metric.installs,
        source: "app_store_analytics",
        quality: "estimated",
        observedAt,
        description: "Usage analytics based on opted-in devices; privacy thresholds may apply.",
      });
    }
    if (metric.uninstalls !== null && metric.uninstalls !== undefined) {
      observations.push({
        appId,
        platform: "ios",
        date: metric.date,
        metricKey: "uninstalls",
        value: metric.uninstalls,
        source: "app_store_analytics",
        quality: "estimated",
        observedAt,
        description: "Usage analytics based on opted-in devices; privacy thresholds may apply.",
      });
    }
  }
  return { metrics, observations };
}

type DownloadPoint = {
  firstTime: number;
  redownloads: number;
  manualUpdates: number;
  autoUpdates: number;
  hasFirstTime: boolean;
  hasRedownloads: boolean;
  hasManualUpdates: boolean;
  hasAutoUpdates: boolean;
};

export function parseAppleDownloadRows(
  appId: string,
  appleAppId: string,
  rows: Row[],
  observedAt = new Date().toISOString(),
): { metrics: DailyMetric[]; observations: MetricObservation[] } {
  const byDate = new Map<string, DownloadPoint>();
  for (const row of rows) {
    if (row["App Apple Identifier"] !== appleAppId || !row.Date) continue;
    const count = parseNumber(row.Counts);
    if (count === null) continue;
    const point = byDate.get(row.Date) ?? {
      firstTime: 0,
      redownloads: 0,
      manualUpdates: 0,
      autoUpdates: 0,
      hasFirstTime: false,
      hasRedownloads: false,
      hasManualUpdates: false,
      hasAutoUpdates: false,
    };
    switch (row["Download Type"].trim().toLowerCase()) {
      case "first-time download":
        point.firstTime += count;
        point.hasFirstTime = true;
        break;
      case "redownload":
        point.redownloads += count;
        point.hasRedownloads = true;
        break;
      case "manual update":
        point.manualUpdates += count;
        point.hasManualUpdates = true;
        break;
      case "auto-update":
        point.autoUpdates += count;
        point.hasAutoUpdates = true;
        break;
    }
    byDate.set(row.Date, point);
  }

  const metrics: DailyMetric[] = [];
  const observations: MetricObservation[] = [];
  const addObservation = (date: string, metricKey: string, value: number) => {
    observations.push({
      appId,
      platform: "ios",
      date,
      metricKey,
      value,
      source: "app_store_analytics",
      quality: "exact",
      observedAt,
    });
  };

  for (const [date, point] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const hasDownloads = point.hasFirstTime || point.hasRedownloads;
    const totalDownloads = point.firstTime + point.redownloads;
    if (hasDownloads) {
      metrics.push({
        appId,
        platform: "ios",
        date,
        downloads: totalDownloads,
        installs: null,
        uninstalls: null,
        crashes: null,
        anrs: null,
        rating: null,
        ratingCount: null,
        reviewCount: null,
        active1DayUsers: null,
        active7DayUsers: null,
        active28DayUsers: null,
        sessions: null,
      });
      addObservation(date, "total_downloads", totalDownloads);
    }
    if (point.hasFirstTime) addObservation(date, "first_time_downloads", point.firstTime);
    if (point.hasRedownloads) addObservation(date, "redownloads", point.redownloads);
    if (point.hasManualUpdates) addObservation(date, "manual_updates", point.manualUpdates);
    if (point.hasAutoUpdates) addObservation(date, "auto_updates", point.autoUpdates);
    if (point.hasManualUpdates || point.hasAutoUpdates) {
      addObservation(date, "updates", point.manualUpdates + point.autoUpdates);
    }
  }
  return { metrics, observations };
}

async function readAll<T>(
  firstPath: string,
  appleJson: AppleAnalyticsJson,
): Promise<Array<JsonResource<T>>> {
  const rows: Array<JsonResource<T>> = [];
  let next: string | undefined = firstPath;
  while (next) {
    const response: ListResponse<T> = await appleJson<ListResponse<T>>(next);
    rows.push(...response.data);
    next = response.links?.next;
  }
  return rows;
}

function decodeSegment(buffer: Buffer): Row[] {
  const decoded =
    buffer[0] === 0x1f && buffer[1] === 0x8b
      ? gunzipSync(buffer).toString("utf8")
      : buffer.toString("utf8");
  const firstLine = decoded.split(/\r?\n/, 1)[0] ?? "";
  return parse(decoded.replace(/^\uFEFF/, ""), {
    columns: true,
    delimiter: firstLine.includes("\t") ? "\t" : ",",
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Row[];
}

export async function fetchAppleAnalyticsRows(
  appleAppId: string,
  appleJson: AppleAnalyticsJson,
  options: AppleAnalyticsReportOptions,
): Promise<Row[]> {
  const accessType = options.accessType ?? "ONGOING";
  const maxInstances = options.maxInstances === undefined ? 45 : options.maxInstances;
  let requests = await readAll<RequestResponse["data"][number]["attributes"]>(
    `/v1/apps/${encodeURIComponent(appleAppId)}/analyticsReportRequests?limit=200`,
    appleJson,
  );
  requests = requests.filter(
    (item) => item.attributes.accessType === accessType && !item.attributes.stoppedDueToInactivity,
  );
  if (!requests.length) {
    await appleJson("/v1/analyticsReportRequests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          type: "analyticsReportRequests",
          attributes: { accessType },
          relationships: { app: { data: { type: "apps", id: appleAppId } } },
        },
      }),
    });
    throw new Error(
      "Analytics Report Request를 생성했습니다. Apple이 첫 보고서를 준비하는 데 1~2일이 걸립니다.",
    );
  }

  const reports = await readAll<ReportResponse["data"][number]["attributes"]>(
    `/v1/analyticsReportRequests/${encodeURIComponent(requests[0].id)}/reports?limit=200&filter[category]=${encodeURIComponent(options.category)}`,
    appleJson,
  );
  const report = reports.find((item) =>
    item.attributes.name.toLowerCase().includes(options.reportNameIncludes.toLowerCase()),
  );
  if (!report) {
    throw new Error(
      `Apple Analytics report unavailable: ${options.reportNameIncludes}`,
    );
  }

  const instances = await readAll<InstanceResponse["data"][number]["attributes"]>(
    `/v1/analyticsReports/${encodeURIComponent(report.id)}/instances?limit=200&filter[granularity]=DAILY`,
    appleJson,
  );
  const sortedInstances = instances.sort((a, b) =>
    (a.attributes.processingDate ?? "").localeCompare(b.attributes.processingDate ?? ""),
  );
  const selected = maxInstances === null ? sortedInstances : sortedInstances.slice(-maxInstances);
  const rowsByDate = new Map<string, Row[]>();
  for (const instance of selected) {
    const segments = await readAll<SegmentResponse["data"][number]["attributes"]>(
      `/v1/analyticsReportInstances/${encodeURIComponent(instance.id)}/segments?limit=200&fields[analyticsReportSegments]=checksum,sizeInBytes,url`,
      appleJson,
    );
    const instanceRows: Row[] = [];
    for (const segment of segments) {
      const response = await fetch(segment.attributes.url);
      if (!response.ok) throw new Error(`Apple Analytics segment ${response.status}`);
      instanceRows.push(...decodeSegment(Buffer.from(await response.arrayBuffer())));
    }
    for (const date of new Set(instanceRows.map((row) => row.Date).filter(Boolean))) {
      rowsByDate.set(date, instanceRows.filter((row) => row.Date === date));
    }
  }
  return [...rowsByDate.values()].flat();
}

export async function fetchAppleInstallAnalytics(
  appId: string,
  appleAppId: string,
  appleJson: AppleAnalyticsJson,
  options: AppleAnalyticsOptions = {},
): Promise<DailyMetric[]> {
  const rows = await fetchAppleAnalyticsRows(appleAppId, appleJson, {
    ...options,
    category: "APP_USAGE",
    reportNameIncludes: "app store installation and deletion standard",
  });
  return parseAppleInstallRows(appId, appleAppId, rows);
}

export async function fetchAppleInstallAnalyticsReport(
  appId: string,
  appleAppId: string,
  appleJson: AppleAnalyticsJson,
  options: AppleAnalyticsOptions = {},
) {
  const observedAt = new Date().toISOString();
  const rows = await fetchAppleAnalyticsRows(appleAppId, appleJson, {
    ...options,
    category: "APP_USAGE",
    reportNameIncludes: "app store installation and deletion standard",
  });
  return parseAppleInstallReport(appId, appleAppId, rows, observedAt);
}

export async function fetchAppleDownloadAnalytics(
  appId: string,
  appleAppId: string,
  appleJson: AppleAnalyticsJson,
  options: AppleAnalyticsOptions = {},
) {
  const observedAt = new Date().toISOString();
  const rows = await fetchAppleAnalyticsRows(appleAppId, appleJson, {
    ...options,
    category: "COMMERCE",
    reportNameIncludes: "app downloads standard",
  });
  return parseAppleDownloadRows(appId, appleAppId, rows, observedAt);
}
