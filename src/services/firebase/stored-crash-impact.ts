import type { MetricObservation } from '@/domain/types';
import type { CrashImpactData } from './crash-impact';
import { shiftDate, type MetricDateRange } from '@/services/mobile/common/metrics-calculator';

export const CRASH_IMPACT_KEY = 'crash_user_ratio_daily';
export function crashImpactObservations(appId:string,data:CrashImpactData,observedAt:string):MetricObservation[] {
  return (['android','ios'] as const).flatMap(platform=>data[platform].status==='error'||data[platform].status==='not_configured'?[]:data[platform].trend.flatMap(point=>
    point.value===null?[]:[{appId,platform,date:point.date,metricKey:CRASH_IMPACT_KEY,value:point.value,source:'firebase' as const,quality:'derived' as const,observedAt,description:'Daily fatal distinct installations / same-day GA4 DAU × 100; GA4 property time zone, all versions. Cross-source identities differ.'}]
  ));
}
export function storedCrashImpact(appId:string,observations:MetricObservation[],range:MetricDateRange):CrashImpactData {
  const summarize=(platform:'android'|'ios')=>{
    const values=new Map<string,MetricObservation>();
    for(const row of observations) {
      if(row.appId!==appId||row.platform!==platform||row.metricKey!==CRASH_IMPACT_KEY||row.source!=='firebase'||row.quality==='unavailable') continue;
      if(!values.has(row.date)||row.observedAt>values.get(row.date)!.observedAt) values.set(row.date,row);
    }
    const valueAt=(date:string)=>{const v=values.get(date)?.value;return v!=null&&Number.isFinite(v)&&v>=0&&v<=100?v:null;};
    const trend=[];
    for(let date=range.startDate;date<=range.endDate;date=shiftDate(date,1)) trend.push({date,value:valueAt(date)});
    const latest=trend.filter(point=>point.value!==null).at(-1);
    const previous=latest?valueAt(shiftDate(latest.date,-1)):null;
    return {date:latest?.date??null,value:latest?.value??null,change:latest?.value!=null&&previous!==null?latest.value-previous:null,status:latest?'available' as const:'no_data' as const,trend};
  };
  return {android:summarize('android'),ios:summarize('ios')};
}
