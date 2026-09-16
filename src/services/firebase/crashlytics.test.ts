import {describe,it,expect,vi} from 'vitest';
import {crashlyticsQuery,formatCrashlyticsTrace,fetchCrashlyticsNonfatal} from './crashlytics';
import type {ReportingRequest} from '../google/google-nonfatal';
const config={projectId:'project',dataset:'firebase_crashlytics',location:'asia-northeast3',tables:{android:'prod_ANDROID_REALTIME',ios:'prod_IOS_REALTIME'},serviceAccountJsonEnv:'TEST'};
const options={platform:'android' as const,version:'v2.27.05',releasedAt:'2026-09-12T00:00:00Z'};
describe('Firebase non-fatal',()=>{
 it('isolates platform, release, error type and OS with bound parameters',()=>{
  const q=crashlyticsQuery(config,{...options,os:"15'",issueId:"id'"});
  expect(q.query).toContain('prod_ANDROID_REALTIME');expect(q.query).toContain("error_type = 'NON_FATAL'");
  expect(q.query).toContain('application.display_version = @version');expect(q.query).toContain('issue_id = @issue');
  expect(q.query).not.toContain("15'");expect(q.queryParameters.find(p=>p.name==='version')?.parameterValue.value).toBe('2.27.05');
  expect(crashlyticsQuery(config,{...options,platform:'ios'}).query).toContain('prod_IOS_REALTIME');
 });
 it('counts distinct events and installations and ranks by event count',()=>{
  const q=crashlyticsQuery(config,options).query;
  expect(q).toContain('COUNT(DISTINCT event_id)');expect(q).toContain('COUNT(DISTINCT installation_uuid)');expect(q).toContain('ORDER BY r.count DESC,r.name');expect(q).not.toContain('LIMIT 10');expect(q).toContain('device_counts');expect(q).toContain('os_counts');
 });
 it('formats both Android exceptions and iOS error frames',()=>{
  expect(formatCrashlyticsTrace({exceptions:[{type:'IOException',frames:[{symbol:'send',file:'Client.kt',line:3}]}],error:[{title:'NSError',frames:[{symbol:'request'}]}]})).toBe('IOException\n  at send (Client.kt:3)\n\nNSError\n  at request');
  expect(formatCrashlyticsTrace({})).toBeNull();
 });
 it('limits stack columns to the latest event day',async()=>{
  const request=vi.fn().mockResolvedValueOnce({data:{jobComplete:true,rows:[{f:[{v:'"2026-09-16"'}]}]}}).mockResolvedValueOnce({data:{jobComplete:true,rows:[{f:[{v:JSON.stringify({exceptions:[{type:'IOException',frames:[{symbol:'send'}]}]})}]}]}});
  expect(await fetchCrashlyticsNonfatal(config,{...options,issueId:'issue1'},request as ReportingRequest)).toEqual({trace:'IOException\n  at send'});
  expect(request.mock.calls[0][0].data.query).not.toContain('STRUCT(exceptions');
  expect(request.mock.calls[1][0].data.query).toContain('TIMESTAMP(@traceDay');
  expect(request.mock.calls[1][0].data.query).toContain('errors AS error');
 });
 it('collects every result page rather than truncating at ten issues',async()=>{
  const issue={name:'a',cause:'log',location:'message',version:'2.27.05',count:42,users:3,daily:[],os:[],devices:[]};
  const request=vi.fn().mockResolvedValueOnce({data:{jobComplete:true,jobReference:{jobId:'job1'},pageToken:'page2',rows:[{f:[{v:JSON.stringify(issue)}]}]}}).mockResolvedValueOnce({data:{jobComplete:true,rows:[{f:[{v:JSON.stringify({...issue,name:'b'})}]}]}});
  const result=await fetchCrashlyticsNonfatal(config,options,request as ReportingRequest);
  expect(result).toEqual({issues:[issue,{...issue,name:'b'}]});
  expect(request.mock.calls[1][0].url).toContain('pageToken=page2');
 });
 it('polls the same job when an aggregate is not ready',async()=>{
  const request=vi.fn().mockResolvedValueOnce({data:{jobComplete:false,jobReference:{jobId:'job1'}}}).mockResolvedValueOnce({data:{jobComplete:true,rows:[]}});
  expect(await fetchCrashlyticsNonfatal(config,options,request as ReportingRequest)).toEqual({issues:[]});
  expect(request.mock.calls[1][0].url).toContain('/queries/job1?');
 });
});
