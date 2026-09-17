import {expect,it} from 'vitest';
import {buildAcquisitionDays,acquisitionSummary,acquisitionTotal} from '../tabs/acquisition.service';
import type {DashboardData,DailyMetric,MetricObservation} from '@/domain/types';
const obs=(value:number,observedAt:string):MetricObservation=>({appId:'a',platform:'ios',date:'2026-09-14',metricKey:'uninstalls',source:'app_store_analytics',quality:'estimated',value,observedAt});
it('uses the latest Apple deletion observation, preserves zero and missing dates',()=>{
 const rows=buildAcquisitionDays({app:{id:'a'} as DashboardData['app'],metrics:[],metricObservations:[obs(4,'2026-09-14T01:00:00Z'),obs(0,'2026-09-15T01:00:00Z'),{...obs(99,'2026-09-16T01:00:00Z'),appId:'other'}]},{startDate:'2026-09-14',endDate:'2026-09-15'});
 expect(rows[0].ios.removals).toBe(0);expect(rows[1].ios.removals).toBeNull();expect(acquisitionSummary(rows,'ios').removals).toBe(0);
});
it('weights engagement by paired sessions and averages DAU over collected days only',()=>{
 const metrics=[{appId:'a',platform:'android',date:'2026-09-14',active1DayUsers:100,newUsers:10,sessions:10,engagedSessions:10},{appId:'a',platform:'android',date:'2026-09-15',active1DayUsers:200,newUsers:20,sessions:90,engagedSessions:0}] as DailyMetric[];
 const rows=buildAcquisitionDays({app:{id:'a'} as DashboardData['app'],metrics,metricObservations:[]},{startDate:'2026-09-13',endDate:'2026-09-15'});
 expect(acquisitionSummary(rows,'android')).toMatchObject({dau:150,newUsers:30,engagement:10});
 expect(acquisitionSummary(rows,'ios').engagement).toBeNull();
});
it('does not include unmatched or invalid session denominators',()=>{
 const metrics=[{appId:'a',platform:'ios',date:'2026-09-14',sessions:100,engagedSessions:null},{appId:'a',platform:'ios',date:'2026-09-15',sessions:10,engagedSessions:20}] as DailyMetric[];
 const rows=buildAcquisitionDays({app:{id:'a'} as DashboardData['app'],metrics,metricObservations:[]},{startDate:'2026-09-14',endDate:'2026-09-15'});
 expect(acquisitionSummary(rows,'ios').engagement).toBeNull();
});

it('combines engagement with session weights and leaves incomplete totals empty',()=>{
 const metrics=[{appId:'a',platform:'android',date:'2026-09-14',active1DayUsers:100,sessions:10,engagedSessions:10},{appId:'a',platform:'ios',date:'2026-09-14',active1DayUsers:200,sessions:90,engagedSessions:0}] as DailyMetric[];
 const rows=buildAcquisitionDays({app:{id:'a'} as DashboardData['app'],metrics,metricObservations:[]},{startDate:'2026-09-14',endDate:'2026-09-14'});
 expect(acquisitionTotal(rows[0],'dau')).toBe(300);
 expect(acquisitionTotal(rows[0],'engagement')).toBe(10);
 expect(acquisitionTotal(rows[0],'removals')).toBeNull();
});
