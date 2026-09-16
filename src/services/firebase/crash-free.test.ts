import { describe, expect, it, vi } from 'vitest';
import { crashFreePercentage, crashFreeQuery, fetchCrashFree, summarizeCrashFree, type CrashFreeRow } from './crash-free';
import type { ReportingRequest } from '@/services/google/google-nonfatal';

const range={startDate:'2026-09-09',endDate:'2026-09-10'};
const config={projectId:'project',dataset:'firebase_crashlytics',location:'asia-northeast3',tables:{android:'app_ANDROID_REALTIME',ios:'app_IOS_REALTIME'},serviceAccountJsonEnv:'TEST'};
const row=(period:'current'|'previous',date:string|null,users:number,crashedUsers:number):CrashFreeRow=>({period,date,users,crashedUsers});

describe('Firebase crash-free users',()=>{
 it('uses period-wide unique counts, not daily averages or summed daily users',()=>{
  const result=summarizeCrashFree([
   row('current','2026-09-09',100,10),row('current','2026-09-10',100,20),row('current',null,150,25),
   row('previous','2026-09-07',100,5),row('previous','2026-09-08',100,5),row('previous',null,100,5),
  ],range);
  expect(result.value).toBeCloseTo(83.333333);
  expect(result.value).not.toBe(85);
  expect(result.change).toBeCloseTo(-11.666667);
  expect(result.trend.map(p=>p.value)).toEqual([90,80]);
 });
 it('does not invent 100% when sessions are missing, and preserves zero-crash data',()=>{
  expect(crashFreePercentage(0,0)).toBeNull();
  expect(crashFreePercentage(10,11)).toBeNull();
  expect(crashFreePercentage(100,0)).toBe(100);
  expect(crashFreePercentage(100,100)).toBe(0);
  expect(summarizeCrashFree([],range).status).toBe('no_data');
 });
 it('preserves missing days and withholds incomplete period totals and comparisons',()=>{
  const result=summarizeCrashFree([row('current','2026-09-10',100,1),row('current',null,100,1)],range);
  expect(result).toMatchObject({value:null,change:null,status:'partial',days:1});
  expect(result.trend).toEqual([{date:'2026-09-09',value:null},{date:'2026-09-10',value:99}]);
 });
 it('queries fatal events, collection-enabled sessions, and deduplicates overlapping exports',()=>{
  const query=crashFreeQuery(config,['app_ANDROID','app_ANDROID_REALTIME'],['app_ANDROID','app_ANDROID_REALTIME'],range);
  expect(query.query).toContain('COUNT(DISTINCT user_id)');
  expect(query.query).toContain('COUNT(DISTINCT crash_id)');
  expect(query.query).toContain('GROUPING SETS ((period,date),(period))');
  expect(query.query).toContain("error_type = 'FATAL'");
  expect(query.query).toContain('crashlytics_data_collection_enabled = TRUE');
  expect(query.query).toContain('`project.firebase_sessions.app_ANDROID`');
  expect(query.query).toContain('`project.firebase_sessions.app_ANDROID_REALTIME`');
  expect(query.queryParameters.find(p=>p.name==='from')?.parameterValue.value).toBe('2026-09-07');
 });
 it('returns pending for both platforms without querying crash events if sessions export is empty',async()=>{
  const request=vi.fn().mockResolvedValue({data:{}});
  const result=await fetchCrashFree(config,range,request as ReportingRequest);
  expect(result.android.status).toBe('sessions_missing');
  expect(result.ios.value).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
 });
 it('paginates metadata and query results, and supports iOS independently of Android',async()=>{
  const request=vi.fn()
   .mockResolvedValueOnce({data:{tables:[],nextPageToken:'next'}})
   .mockResolvedValueOnce({data:{tables:[{tableReference:{tableId:'app_IOS'}}]}})
   .mockResolvedValueOnce({data:{tables:[{tableReference:{tableId:'app_IOS_REALTIME'}}]}})
   .mockResolvedValueOnce({data:{jobComplete:false,jobReference:{jobId:'job'}}})
   .mockResolvedValueOnce({data:{jobComplete:true,pageToken:'page',rows:[{f:[{v:JSON.stringify(row('current',null,100,1))}]}]}})
   .mockResolvedValueOnce({data:{jobComplete:true,rows:['2026-09-09','2026-09-10'].map(date=>({f:[{v:JSON.stringify(row('current',date,100,1))}]}))}});
  const result=await fetchCrashFree(config,range,request as ReportingRequest);
  expect(result.android.status).toBe('sessions_missing');
  expect(result.ios.value).toBe(99);
  expect(request.mock.calls[3][0].data.query).toContain('`project.firebase_sessions.app_IOS`');
  expect(request.mock.calls[5][0].url).toContain('/job?');
 });
 it('does not disguise permission failures as missing sessions',async()=>{
  const request=vi.fn().mockRejectedValue({response:{status:403}});
  await expect(fetchCrashFree(config,range,request as ReportingRequest)).rejects.toEqual({response:{status:403}});
 });
});
