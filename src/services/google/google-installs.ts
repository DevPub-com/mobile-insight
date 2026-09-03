import type { GoogleInstallRow } from "@/domain/models/google.model";
import type { AppInfo, DailyMetric, MetricObservation } from "@/domain/types";
import { parseNumber } from "@/lib/number";

export type { GoogleInstallRow } from "@/domain/models/google.model";

export function parseGoogleInstallReport(
  app: AppInfo,
  rows: GoogleInstallRow[],
  observedAt: string,
) {
  const metrics = parseGoogleInstallMetrics(app, rows);
  const fields = [
    ["Daily User Installs", "daily_user_installs", "일별 사용자 설치"],
    ["Daily User Uninstalls", "daily_user_uninstalls", "일별 사용자 삭제"],
    ["Daily Device Installs", "daily_device_installs", "일별 기기 설치"],
    ["Daily Device Uninstalls", "daily_device_uninstalls", "일별 기기 삭제"],
    ["Current User Installs", "current_user_installs", "현재 사용자 설치"],
    ["Total User Installs", "total_user_installs", "누적 사용자 설치"],
  ] as const;
  const values = new Map<string, number>();
  for (const row of rows) {
    if (!row.Date) continue;
    for (const [column, metricKey] of fields) {
      const value = parseNumber(row[column]);
      if (value !== null) {
        const key = `${row.Date}\u0000${metricKey}`;
        values.set(key, (values.get(key) ?? 0) + value);
      }
    }
  }
  const descriptions = new Map<string, string>(
    fields.map(([, key, description]) => [key, description]),
  );
  const observations: MetricObservation[] = [...values].map(([key, value]) => {
    const [date, metricKey] = key.split("\u0000");
    return {
      appId: app.id,
      platform: "android",
      date,
      metricKey,
      value,
      source: "google_play_gcs",
      quality: "exact",
      observedAt,
      description: descriptions.get(metricKey) ?? null,
    };
  });
  return { metrics, observations };
}

type Aggregated = DailyMetric & {
  hasDownloads: boolean;
  hasInstalls: boolean;
  hasUninstalls: boolean;
};

export function parseGoogleInstallMetrics(
  app: AppInfo,
  rows: GoogleInstallRow[],
): DailyMetric[] {
  const byDate = new Map<string, Aggregated>();

  for (const row of rows) {
    const date = row.Date;
    if (!date) {
      continue;
    }
    const downloads = parseNumber(row["Daily User Installs"]);
    const installs = parseNumber(row["Daily Device Installs"]);
    const uninstalls = parseNumber(row["Daily Device Uninstalls"]);
    if (downloads === null && installs === null && uninstalls === null) {
      continue;
    }

    const current = byDate.get(date) ?? {
      appId: app.id,
      platform: "android" as const,
      date,
      downloads: 0,
      installs: 0,
      uninstalls: 0,
      crashes: null,
      anrs: null,
      rating: null,
      ratingCount: null,
      reviewCount: null,
      active1DayUsers: null,
      active7DayUsers: null,
      active28DayUsers: null,
      sessions: null,
      hasDownloads: false,
      hasInstalls: false,
      hasUninstalls: false,
    };
    if (downloads !== null) {
      current.downloads = (current.downloads ?? 0) + downloads;
      current.hasDownloads = true;
    }
    if (installs !== null) {
      current.installs = (current.installs ?? 0) + installs;
      current.hasInstalls = true;
    }
    if (uninstalls !== null) {
      current.uninstalls = (current.uninstalls ?? 0) + uninstalls;
      current.hasUninstalls = true;
    }
    byDate.set(date, current);
  }

  return [...byDate.values()].map(
    ({ hasDownloads, hasInstalls, hasUninstalls, ...metric }) => ({
      ...metric,
      downloads: hasDownloads ? metric.downloads : null,
      installs: hasInstalls ? metric.installs : null,
      uninstalls: hasUninstalls ? metric.uninstalls : null,
    }),
  );
}
