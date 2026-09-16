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
    const type = row.dimensions?.find(d => d.dimension === 'reportType')?.stringValue;
    if (!row.startTime || (type !== 'CRASH' && type !== 'ANR' && type !== 'NON_FATAL')) return [];
    const version = row.dimensions?.find(d => d.dimension === 'versionCode')?.stringValue;
    if (version !== undefined && !/^\d+$/.test(version)) return [];
    const {year, month, day} = row.startTime;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return [];
    return (['errorReportCount', 'distinctUsers'] as const).flatMap(metric => {
      const raw = row.metrics?.find(m => m.metric === metric)?.decimalValue;
      const value = typeof raw === 'object' ? raw?.value : raw;
      if (value === undefined || value === null || value === '') return [];
      const count = Number(value);
      if (!Number.isSafeInteger(count) || count < 0) return [];
      const key = `${type === 'CRASH' ? 'crash' : type === 'ANR' ? 'anr' : 'nonfatal'}_${metric === 'errorReportCount' ? 'report_count' : 'affected_users'}`;
      return [{ appId, platform: 'android' as const, date: date.toISOString().slice(0, 10),
        metricKey: key + (version ? `:version_code:${version}` : ''), value: count,
        source: 'google_play_api' as const, quality: metric === 'distinctUsers' ? 'estimated' as const : 'exact' as const, observedAt,
        description: `Google Play ${type} · America/Los_Angeles 날짜 기준 · ${metric === 'distinctUsers' ? '일별 영향받은 사용자, 날짜·버전 간 합산 불가' : '보고 건수'}` }];
    });
  });
}

export async function fetchGoogleCrashCounts(app: {id: string; packageName: string}, request: Request, now = new Date(), days = 90): Promise<MetricObservation[]> {
  const url = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(app.packageName)}/errorCountMetricSet`;
  const set = await request<{freshnessInfo?: {freshnesses?: Array<{aggregationPeriod?: string; latestEndTime?: GoogleDate}>}}>({url});
  const end = set.data.freshnessInfo?.freshnesses?.find(f => f.aggregationPeriod === 'DAILY')?.latestEndTime;
  if (!end) throw new Error('Google Play 크래시 보고서의 일별 수집 기준일이 없습니다.');
  const start = new Date(Date.UTC(end.year, end.month - 1, end.day));
  start.setUTCDate(start.getUTCDate() - days);
  const observations: MetricObservation[] = [];
  // Query app totals independently: distinct users cannot be summed across versions.
  for (const dimensions of [['reportType'], ['reportType', 'versionCode']]) {
    const rows: CrashRow[] = [];
    let pageToken: string | undefined;
    do {
      const response = await request<{rows?: CrashRow[]; nextPageToken?: string}>({url: `${url}:query`, method: 'POST', data: {
        timelineSpec: {aggregationPeriod: 'DAILY', startTime: googleDate(start), endTime: {year: end.year, month: end.month, day: end.day}},
        dimensions, metrics: ['errorReportCount', 'distinctUsers'], pageSize: 1000,
        ...(pageToken ? {pageToken} : {}),
      }});
      rows.push(...(response.data.rows ?? []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    observations.push(...normalizeGoogleCrashCounts(app.id, rows, now.toISOString()));
  }
  return observations;
}
