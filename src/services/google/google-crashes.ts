import type { MetricObservation } from '@/domain/types';

type GoogleDate = { year: number; month: number; day: number };
type CrashRow = {
  startTime?: GoogleDate;
  dimensions?: Array<{ dimension?: string; stringValue?: string }>;
  metrics?: Array<{ metric?: string; decimalValue?: { value?: string | number } | string | number }>;
};
type Request = <T>(options: { url: string; method?: 'GET' | 'POST'; data?: unknown }) => Promise<{ data: T }>;
const googleDate = (date: Date): GoogleDate => ({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });

export function normalizeGoogleCrashCounts(appId: string, rows: CrashRow[], observedAt: string): MetricObservation[] {
  return rows.flatMap((row) => {
    if (!row.startTime || !row.dimensions?.some(d => d.dimension === 'reportType' && d.stringValue === 'CRASH')) return [];
    const raw = row.metrics?.find(m => m.metric === 'errorReportCount')?.decimalValue;
    const value = typeof raw === 'object' ? raw?.value : raw;
    if (value === undefined || value === null || value === '') return [];
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) return [];
    const {year, month, day} = row.startTime;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return [];
    return [{ appId, platform: 'android' as const, date: date.toISOString().slice(0, 10), metricKey: 'crash_report_count', value: count, source: 'google_play_api' as const, quality: 'exact' as const, observedAt, description: 'Google Play 크래시 보고 건수 · America/Los_Angeles 날짜 기준 · 신규 고유 이슈 수가 아님' }];
  });
}

export async function fetchGoogleCrashCounts(app: {id: string; packageName: string}, request: Request, now = new Date(), days = 90): Promise<MetricObservation[]> {
  const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(app.packageName)}/errorCountMetricSet`;
  const set = await request<{freshnessInfo?: {freshnesses?: Array<{aggregationPeriod?: string; latestEndTime?: GoogleDate}>}}>({url});
  const end = set.data.freshnessInfo?.freshnesses?.find(f => f.aggregationPeriod === 'DAILY')?.latestEndTime;
  if (!end) throw new Error('Google Play 크래시 보고서의 일별 수집 기준일이 없습니다.');
  const start = new Date(Date.UTC(end.year, end.month - 1, end.day));
  start.setUTCDate(start.getUTCDate() - days);
  const rows: CrashRow[] = [];
  let pageToken: string | undefined;
  do {
    const response = await request<{rows?: CrashRow[]; nextPageToken?: string}>({url: `${url}:query`, method: 'POST', data: {
      timelineSpec: {aggregationPeriod: 'DAILY', startTime: googleDate(start), endTime: {year: end.year, month: end.month, day: end.day}},
      dimensions: ['reportType'], metrics: ['errorReportCount'], pageSize: 1000,
      ...(pageToken ? {pageToken} : {}),
    }});
    rows.push(...(response.data.rows ?? []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  return normalizeGoogleCrashCounts(app.id, rows, now.toISOString());
}
