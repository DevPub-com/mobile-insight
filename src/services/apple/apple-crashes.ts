import type { MetricObservation } from '@/domain/types';
import { fetchAppleAnalyticsRows, type AppleAnalyticsJson, type AppleAnalyticsOptions } from './apple-installs';

export function parseAppleCrashRows(appId: string, appleAppId: string, rows: Record<string, string>[], observedAt = new Date().toISOString()): MetricObservation[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row['App Apple Identifier'] !== appleAppId || !/^\d{4}-\d{2}-\d{2}$/.test(row.Date ?? '') || !row.Crashes?.trim()) continue;
    const date = new Date(`${row.Date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.Date) continue;
    const count = Number(row.Crashes);
    if (!Number.isSafeInteger(count) || count < 0) continue;
    totals.set(row.Date, (totals.get(row.Date) ?? 0) + count);
  }
  return [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({appId, platform:'ios', date, metricKey:'crash_report_count', value, source:'app_store_analytics', quality:'estimated', observedAt, description:'App Store App Crashes · 공유 동의 사용자 기준 · 개인정보 보호 임계값 적용 · 신규 고유 이슈 수가 아님'}));
}

export async function fetchAppleCrashCounts(appId: string, appleAppId: string, appleJson: AppleAnalyticsJson, options: AppleAnalyticsOptions = {}) {
  const rows = await fetchAppleAnalyticsRows(appleAppId, appleJson, {...options, category:'APP_USAGE', reportNameIncludes:'app crashes'});
  return parseAppleCrashRows(appId, appleAppId, rows);
}
