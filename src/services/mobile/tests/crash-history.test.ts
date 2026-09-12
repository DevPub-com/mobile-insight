import { expect, it } from 'vitest';
import { buildCrashHistory } from '../crash-history.service';
import { demoDashboardData } from '@/data/demo';
import type { MetricObservation } from '@/domain/types';

it('filters by platform and period, preserves gaps, and avoids comparing incomplete periods', () => {
 const point = (platform:'android'|'ios',date:string,value:number):MetricObservation => ({appId:'app',platform,date,value,metricKey:'crash_report_count',source:platform==='ios'?'app_store_analytics':'google_play_api',quality:'exact',observedAt:'2026-09-10T00:00:00Z'});
 const data = {...demoDashboardData,metricObservations:[point('android','2026-09-07',50),point('android','2026-09-08',3),point('ios','2026-09-08',9),point('android','2026-09-10',0)]};
 const result=buildCrashHistory(data,{startDate:'2026-09-08',endDate:'2026-09-10'});
 expect(result.android).toMatchObject({value:3,days:2,change:null});
 expect(result.ios.value).toBe(9);
 expect(result.trend).toEqual([{date:'2026-09-08',android:3,ios:9},{date:'2026-09-09',android:null,ios:null},{date:'2026-09-10',android:0,ios:null}]);
});

it('compares each platform latest collected day with its calendar predecessor, including outside the range', () => {
 const point = (platform:'android'|'ios',date:string,value:number):MetricObservation => ({appId:'app',platform,date,value,metricKey:'crash_report_count',source:'app_store_analytics',quality:'exact',observedAt:'2026-09-10T00:00:00Z'});
 const data = {...demoDashboardData,metricObservations:[point('android','2026-09-09',0),point('android','2026-09-10',12),point('ios','2026-09-07',9),point('ios','2026-09-08',3)]};
 const result=buildCrashHistory(data,{startDate:'2026-09-08',endDate:'2026-09-10'});
 expect(result.android.dailyChange).toBe(12);
 expect(result.ios.dailyChange).toBe(-6);
});

it('does not compare across missing days and preserves zero change', () => {
 const point = (date:string,value:number):MetricObservation => ({appId:'app',platform:'android',date,value,metricKey:'crash_report_count',source:'google_play_api',quality:'exact',observedAt:'2026-09-10T00:00:00Z'});
 const range={startDate:'2026-09-08',endDate:'2026-09-10'};
 const data={...demoDashboardData,metricObservations:[point('2026-09-08',5),point('2026-09-10',5)]};
 expect(buildCrashHistory(data,range).android.dailyChange).toBeNull();
 expect(buildCrashHistory(data,range).ios.dailyChange).toBeNull();
 data.metricObservations.push(point('2026-09-09',5));
 expect(buildCrashHistory(data,range).android.dailyChange).toBe(0);
});
