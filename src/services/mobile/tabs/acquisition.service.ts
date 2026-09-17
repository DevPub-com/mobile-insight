import type { DashboardData, Platform } from '@/domain/types';
import { buildFirstOpenTrend } from './downloads.service';
import type { MetricDateRange } from '../common/metrics-calculator';
export const acquisitionPlatforms = ['android','ios'] as const;
export type AcquisitionValues = {firstOpen:number|null;removals:number|null;newUsers:number|null;dau:number|null;sessions:number|null;engagedSessions:number|null;engagement:number|null};
export type AcquisitionDay = {date:string} & Record<Platform,AcquisitionValues>;
const valid=(n:number|null|undefined)=>n!=null&&Number.isFinite(n)&&n>=0?n:null;
export const sumCollected=(values:(number|null)[])=>{const rows=values.filter((n):n is number=>n!==null);return rows.length?rows.reduce((a,b)=>a+b,0):null;};
export function buildAcquisitionDays(data:Pick<DashboardData,'app'|'metrics'|'metricObservations'>,range:MetricDateRange):AcquisitionDay[] {
 const first=buildFirstOpenTrend(data.metricObservations??[],data.app.id,range);
 const removals=new Map(buildFirstOpenTrend(data.metricObservations??[],data.app.id,range,'app_remove').map(row=>[row.date,row.android]));
 const apple=new Map<string,{value:number|null;observedAt:string}>();
 for(const row of data.metricObservations??[]) {
  if(row.appId!==data.app.id||row.platform!=='ios'||row.source!=='app_store_analytics'||row.metricKey!=='uninstalls'||row.quality==='unavailable') continue;
  if(!apple.has(row.date)||row.observedAt>apple.get(row.date)!.observedAt) apple.set(row.date,{value:valid(row.value),observedAt:row.observedAt});
 }
 const metrics=new Map(data.metrics.filter(row=>row.appId===data.app.id).map(row=>[`${row.date}:${row.platform}`,row]));
 return first.map(row=>{
  const platform=(p:Platform):AcquisitionValues=>{
   const m=metrics.get(`${row.date}:${p}`),sessions=valid(m?.sessions),engaged=valid(m?.engagedSessions);
   const paired=sessions!==null&&sessions>0&&engaged!==null&&engaged<=sessions;
   return {firstOpen:row[p],removals:p==='android'?removals.get(row.date)??null:apple.get(row.date)?.value??null,newUsers:valid(m?.newUsers),dau:valid(m?.active1DayUsers),sessions:paired?sessions:null,engagedSessions:paired?engaged:null,engagement:paired?engaged/sessions*100:null};
  };
  return {date:row.date,android:platform('android'),ios:platform('ios')};
 });
}
export function acquisitionSummary(rows:AcquisitionDay[],platform:Platform) {
 const values=rows.map(row=>row[platform]);
 const dau=values.map(row=>row.dau).filter((n):n is number=>n!==null);
 const sessions=sumCollected(values.map(row=>row.sessions)),engaged=sumCollected(values.map(row=>row.engagedSessions));
 return {firstOpen:sumCollected(values.map(row=>row.firstOpen)),removals:sumCollected(values.map(row=>row.removals)),newUsers:sumCollected(values.map(row=>row.newUsers)),dau:dau.length?dau.reduce((a,b)=>a+b,0)/dau.length:null,engagement:sessions!==null&&sessions>0&&engaged!==null?engaged/sessions*100:null};
}

// A missing platform is not zero. Only show a combined point when both exist.
export function acquisitionTotal(row:AcquisitionDay,key:keyof AcquisitionValues):number|null {
 const a=row.android[key],b=row.ios[key];
 if(a===null||b===null) return null;
 if(key==='engagement') {
  const sessions=row.android.sessions!+row.ios.sessions!;
  return sessions>0?(row.android.engagedSessions!+row.ios.engagedSessions!)/sessions*100:null;
 }
 return a+b;
}
