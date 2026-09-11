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
