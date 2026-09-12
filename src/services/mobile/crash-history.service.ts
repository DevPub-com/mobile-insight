import type { DashboardData, Platform } from '@/domain/types';
import { dateRangeDays, previousDateRange, shiftDate, type MetricDateRange } from './common/metrics-calculator';

export function buildCrashHistory(data: DashboardData, range: MetricDateRange) {
  const previous = previousDateRange(range);
  const rows = (data.metricObservations ?? []).filter(row => row.metricKey === 'crash_report_count' && row.quality !== 'unavailable' && row.value !== null && Number.isSafeInteger(row.value) && row.value >= 0)
    .toSorted((a,b)=>a.observedAt.localeCompare(b.observedAt));
  const platformRows = (platform: Platform) => new Map(rows.filter(row=>row.platform===platform).map(row=>[row.date,row.value!]));
  const androidRows = platformRows('android');
  const iosRows = platformRows('ios');
  const summarize = (points: Map<string,number>) => {
    const current = [...points].filter(([date])=>date>=range.startDate&&date<=range.endDate);
    const before = [...points].filter(([date])=>date>=previous.startDate&&date<=previous.endDate);
    const total = current.reduce((sum,[,value])=>sum+value,0);
    const complete = current.length===dateRangeDays(range)&&before.length===dateRangeDays(previous);
    const latestDate = current.map(([date]) => date).sort().at(-1) ?? null;
    const previousDayValue = latestDate ? points.get(shiftDate(latestDate, -1)) : undefined;
    const dailyChange = latestDate !== null && previousDayValue !== undefined
      ? points.get(latestDate)! - previousDayValue
      : null;
    return {value:current.length?total:null, change:complete?total-before.reduce((sum,[,value])=>sum+value,0):null, dailyChange, days:current.length, latestDate};
  };
  const trend: Array<{date:string;android:number|null;ios:number|null}> = [];
  for(let date=range.startDate;date<=range.endDate;date=shiftDate(date,1)) trend.push({date,android:androidRows.get(date)??null,ios:iosRows.get(date)??null});
  return {android:summarize(androidRows),ios:summarize(iosRows),trend};
}
