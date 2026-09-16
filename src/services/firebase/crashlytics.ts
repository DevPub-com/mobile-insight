import type {ReportingRequest} from '../google/google-nonfatal';

export type CustomLogIssue = {name:string; cause:string; location:string; version:string; count:number; users:number; daily:{date:string; count:number}[]; os:{label:string; count:number}[]; devices:{label:string; count:number}[]};
export type CustomLogData = {issues:CustomLogIssue[]};
export type CrashlyticsConfig = {projectId:string; dataset:string; location:string; tables:{android:string; ios:string}; serviceAccountJsonEnv:string};
type QueryResult = {jobComplete?:boolean; jobReference?:{jobId:string}; rows?:{f:{v:string}[]}[]; pageToken?:string; errors?:{message:string}[]};
export type CrashlyticsOptions = {platform:'android'|'ios'; version:string; releasedAt:string; os?:string; issueId?:string; traceDay?:string};

export function crashlyticsQuery(config:CrashlyticsConfig, options:CrashlyticsOptions) {
 const table=[config.projectId,config.dataset,config.tables[options.platform]];
 if(table.some(v=>!v||!/^[a-zA-Z0-9_-]+$/.test(v))) throw Error('Invalid Crashlytics table');
 if(!/^\d{4}-\d{2}-\d{2}/.test(options.releasedAt)) throw Error('Invalid release date');
 const where=`FROM \`${table.join('.')}\` WHERE event_timestamp >= TIMESTAMP(@start, 'Asia/Seoul') AND event_timestamp < CURRENT_TIMESTAMP() AND error_type = 'NON_FATAL' AND application.display_version = @version AND (@os = '' OR operating_system.display_version = @os)`;
 const query=options.issueId ? options.traceDay ? `SELECT TO_JSON_STRING(STRUCT(exceptions, errors AS error)) ${where} AND event_timestamp >= TIMESTAMP(@traceDay, 'Asia/Seoul') AND event_timestamp < TIMESTAMP(DATE_ADD(DATE(@traceDay), INTERVAL 1 DAY), 'Asia/Seoul') AND issue_id = @issue ORDER BY event_timestamp DESC LIMIT 1` : `SELECT TO_JSON_STRING(MAX(DATE(event_timestamp, 'Asia/Seoul'))) ${where} AND issue_id = @issue` : `
 WITH events AS (
 SELECT event_id, DATE(event_timestamp, 'Asia/Seoul') AS day, COALESCE(operating_system.display_version, '알 수 없음') AS os,
 COALESCE(NULLIF(CONCAT(COALESCE(device.manufacturer, ''), ' ', COALESCE(device.model, '')), ' '), '알 수 없음') AS device,
 application.display_version AS version, issue_id, issue_title, issue_subtitle, installation_uuid ${where}
 ), ranked AS (
 SELECT issue_id AS name, ANY_VALUE(issue_title) AS cause, ANY_VALUE(issue_subtitle) AS location, ANY_VALUE(version) AS version,
 COUNT(DISTINCT event_id) AS count, COUNT(DISTINCT installation_uuid) AS users
 FROM events GROUP BY issue_id
 ), daily_counts AS (SELECT issue_id, day, COUNT(DISTINCT event_id) AS count FROM events GROUP BY issue_id,day),
 os_counts AS (SELECT issue_id, os AS label, COUNT(DISTINCT event_id) AS count FROM events GROUP BY issue_id,os),
 device_counts AS (SELECT issue_id, device AS label, COUNT(DISTINCT event_id) AS count FROM events GROUP BY issue_id,device),
 daily_groups AS (SELECT issue_id, ARRAY_AGG(STRUCT(CAST(day AS STRING) AS date, count) ORDER BY day) AS daily FROM daily_counts GROUP BY issue_id),
 os_groups AS (SELECT issue_id, ARRAY_AGG(STRUCT(label,count) ORDER BY count DESC,label) AS os FROM os_counts GROUP BY issue_id),
 device_groups AS (SELECT issue_id, ARRAY_AGG(STRUCT(label,count) ORDER BY count DESC,label) AS devices FROM device_counts GROUP BY issue_id)
 SELECT TO_JSON_STRING(STRUCT(r.name, r.cause, r.location, r.version, r.count, r.users, d.daily, o.os, v.devices))
 FROM ranked r JOIN daily_groups d ON d.issue_id = r.name JOIN os_groups o ON o.issue_id = r.name JOIN device_groups v ON v.issue_id = r.name
 ORDER BY r.count DESC,r.name

 `;
 return {query,useLegacySql:false,location:config.location,maximumBytesBilled:'10000000000',timeoutMs:20000,parameterMode:'NAMED',queryParameters:Object.entries({start:options.releasedAt.slice(0,10),version:options.version.replace(/^v/,''),os:options.os??'',issue:options.issueId??'',traceDay:options.traceDay??''}).map(([name,value])=>({name,parameterType:{type:'STRING'},parameterValue:{value}}))};
}

type Frame = {symbol?:string; file?:string; line?:number|string; library?:string};
type TraceGroup = {type?:string; exception_message?:string; title?:string; subtitle?:string; frames?:Frame[]};
export function formatCrashlyticsTrace(value:{exceptions?:TraceGroup[]; error?:TraceGroup[]}) {
 return [...(value.exceptions??[]),...(value.error??[])].map(group=>[
 [group.type??group.title,group.exception_message??group.subtitle].filter(Boolean).join(': '),
 ...(group.frames??[]).map(frame=>`  at ${frame.symbol??frame.library??'unknown'}${frame.file?` (${frame.file}${frame.line?`:${frame.line}`:''})`:''}`)
 ].filter(Boolean).join('\n')).filter(Boolean).join('\n\n') || null;
}
export async function fetchCrashlyticsNonfatal(config:CrashlyticsConfig, options:CrashlyticsOptions, request:ReportingRequest):Promise<CustomLogData|{trace:string|null}> {
 const base=`https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`;
 let {data}=await request<QueryResult>({url:base,method:'POST',data:crashlyticsQuery(config,options)});
 // Queries can outlive the initial BigQuery response; fetch that job rather than starting another scan.
 for(let attempt=0;!data.jobComplete&&attempt<3;attempt++) {
  if(!data.jobReference?.jobId) throw Error('Crashlytics query job missing');
  data=(await request<QueryResult>({url:`${base}/${encodeURIComponent(data.jobReference.jobId)}?location=${encodeURIComponent(config.location)}&timeoutMs=10000`})).data;
 }
 if(!data.jobComplete||data.errors?.length) throw Error('Crashlytics query incomplete');
 const json=data.rows?.[0]?.f[0]?.v;
 if(options.issueId) {
  if(!options.traceDay) {
   const traceDay=json?JSON.parse(json) as string|null:null;
   if(!traceDay) return {trace:null};
   // Restrict expensive nested stack columns to the latest event's daily partition.
   return fetchCrashlyticsNonfatal(config,{...options,traceDay},request);
  }
  return {trace:json?formatCrashlyticsTrace(JSON.parse(json)):null};
 }
 const issues:CustomLogIssue[]=[];
 while(true) {
  for(const row of data.rows??[]) issues.push(JSON.parse(row.f[0].v) as CustomLogIssue);
  if(!data.pageToken) break;
  if(!data.jobReference?.jobId) throw Error('Crashlytics result job missing');
  data=(await request<QueryResult>({url:`${base}/${encodeURIComponent(data.jobReference.jobId)}?location=${encodeURIComponent(config.location)}&pageToken=${encodeURIComponent(data.pageToken)}`})).data;
  if(data.errors?.length) throw Error('Crashlytics result page failed');
 }
 return {issues};
}
