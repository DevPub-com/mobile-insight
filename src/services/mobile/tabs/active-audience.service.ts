import type { DailyMetric, Platform } from "@/domain/types";
import { shiftDate, type MetricDateRange } from "../common/metrics-calculator";

export type AudiencePoint = { date: string; androidDau: number | null; iosDau: number | null; androidMau: number | null; iosMau: number | null };
export function buildActiveAudience(metrics: DailyMetric[], appId: string, range: MetricDateRange) {
  const rows = new Map<string, AudiencePoint>();
  const latest: Record<Platform, { date: string; dau: number; mau: number } | null> = { android: null, ios: null };
  for (let date = range.startDate; date <= range.endDate; date = shiftDate(date, 1)) {
    rows.set(date, { date, androidDau: null, iosDau: null, androidMau: null, iosMau: null });
  }
  for (const metric of metrics) {
    if (metric.appId !== appId || metric.date > range.endDate) continue;
    const row = rows.get(metric.date);
    if (row) {
      row[`${metric.platform}Dau`] = metric.active1DayUsers;
      row[`${metric.platform}Mau`] = metric.active28DayUsers;
    }
    if (metric.active1DayUsers !== null && metric.active28DayUsers !== null && (!latest[metric.platform] || latest[metric.platform]!.date < metric.date)) {
      latest[metric.platform] = { date: metric.date, dau: metric.active1DayUsers, mau: metric.active28DayUsers };
    }
  }
  return { trend: [...rows.values()], latest };
}

export function audienceDailyDifference(metrics: DailyMetric[], appId: string, date: string | undefined, platform: Platform | 'total', metric: 'dau' | 'mau'): number | null {
  if (!date) return null;
  const field = metric === 'dau' ? 'active1DayUsers' : 'active28DayUsers';
  const platforms: Platform[] = platform === 'total' ? ['android', 'ios'] : [platform];
  const total = (day: string) => {
    const values = platforms.map(os => metrics.find(row => row.appId === appId && row.platform === os && row.date === day)?.[field]);
    return values.some(value => value == null) ? null : values.reduce<number>((sum, value) => sum + value!, 0);
  };
  const current = total(date);
  const previous = total(shiftDate(date, -1));
  return current === null || previous === null ? null : current - previous;
}
