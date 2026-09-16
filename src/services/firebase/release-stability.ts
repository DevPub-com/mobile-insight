import {GoogleAuth} from 'google-auth-library';
import {getStoreCredentialProfile} from '@/config/store-config';
import type {ReleaseImpactWorkspaceView} from '@/services/mobile/tabs/release-impact.service';
import type {CrashlyticsConfig} from './crashlytics';
import type {ReportingRequest} from '../google/google-nonfatal';
export type StabilityDay={date:string;version:string;crashes:number;anrs:number;crashUsers:number;anrUsers:number};
export function stabilityQuery(config:CrashlyticsConfig,view:ReleaseImpactWorkspaceView){
 const table=`${config.projectId}.${config.dataset}.${config.tables[view.release.platform]}`;
 if(!/^[\w.-]+$/.test(table))throw Error('Invalid table');
 const values={beforeVersion:view.previousRelease?.version.replace(/^v/,'')??'',afterVersion:view.release.version.replace(/^v/,''),beforeStart:view.windows.before.from,beforeEnd:view.windows.before.to,afterStart:view.windows.after.from,afterEnd:view.windows.after.to};
 return {query:`SELECT TO_JSON_STRING(t) FROM (SELECT CAST(DATE(event_timestamp,'Asia/Seoul') AS STRING) AS date, application.display_version AS version,
 COUNT(DISTINCT IF(error_type='FATAL',event_id,NULL)) AS crashes,
 COUNT(DISTINCT IF(error_type='ANR',event_id,NULL)) AS anrs,
 COUNT(DISTINCT IF(error_type='FATAL',installation_uuid,NULL)) AS crashUsers,
 COUNT(DISTINCT IF(error_type='ANR',installation_uuid,NULL)) AS anrUsers
 FROM \`${table}\`
 WHERE event_timestamp >= TIMESTAMP(@beforeStart,'Asia/Seoul') AND event_timestamp < TIMESTAMP(DATE_ADD(DATE(@afterEnd),INTERVAL 1 DAY),'Asia/Seoul')
 AND ((application.display_version=@beforeVersion AND DATE(event_timestamp,'Asia/Seoul') BETWEEN DATE(@beforeStart) AND DATE(@beforeEnd))
 OR (application.display_version=@afterVersion AND DATE(event_timestamp,'Asia/Seoul') BETWEEN DATE(@afterStart) AND DATE(@afterEnd)))
 GROUP BY date,version ORDER BY date) t`,
 useLegacySql:false,location:config.location,maximumBytesBilled:'10000000000',timeoutMs:20000,parameterMode:'NAMED',queryParameters:Object.entries(values).map(([name,value])=>({name,parameterType:{type:'STRING'},parameterValue:{value}}))};
}
export function applyFirebaseStability(view:ReleaseImpactWorkspaceView,rows:StabilityDay[]):ReleaseImpactWorkspaceView {
 const daily=view.daily.map(point=>{
  const version=(point.offset<0?view.previousRelease?.version:view.release.version)?.replace(/^v/,'');
  const row=rows.find(r=>r.date===point.date&&r.version===version);
  return {...point,crashes:row?.crashes??null,anrs:row?.anrs??null,crashUsers:row?.crashUsers??null,anrUsers:row?.anrUsers??null};
 });
 const before=daily.filter(d=>d.offset<0&&d.crashes!==null),after=daily.filter(d=>d.offset>=0&&d.crashes!==null);
 const sum=(days:typeof daily,key:'crashes'|'anrs')=>days.length?days.reduce((n,d)=>n+(d[key]??0),0):null;
 return {...view,daily,crashReports:{before:sum(before,'crashes'),after:sum(after,'crashes'),scope:'version',change:null,afterDays:after.length,latestDate:after.at(-1)?.date??null},anrReports:{before:sum(before,'anrs'),after:sum(after,'anrs')}};
}
export async function fetchStabilityDays(config:CrashlyticsConfig,view:ReleaseImpactWorkspaceView,request:ReportingRequest){
 type Result={jobComplete?:boolean;jobReference?:{jobId:string};pageToken?:string;errors?:unknown[];rows?:{f:{v:string}[]}[]};
 const base=`https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`;
 let {data}=await request<Result>({url:base,method:'POST',data:stabilityQuery(config,view)});
 const jobId=data.jobReference?.jobId;
 for(let i=0;!data.jobComplete&&i<3;i++){
  if(!jobId)throw Error('Missing query job');
  data=(await request<Result>({url:`${base}/${encodeURIComponent(jobId)}?location=${config.location}&timeoutMs=10000`})).data;
 }
 if(!data.jobComplete||data.errors?.length)throw Error('Firebase stability query failed');
 const rows:StabilityDay[]=[];
 while(true){
  rows.push(...(data.rows??[]).map(r=>JSON.parse(r.f[0].v) as StabilityDay));
  if(!data.pageToken)break;
  if(!jobId)throw Error('Missing query job');
  data=(await request<Result>({url:`${base}/${encodeURIComponent(jobId)}?location=${config.location}&pageToken=${encodeURIComponent(data.pageToken)}`})).data;
  if(data.errors?.length)throw Error('Firebase stability page failed');
 }
 return rows;
}
export async function loadFirebaseStability(appCode:string,view:ReleaseImpactWorkspaceView){
 const config=getStoreCredentialProfile(appCode)?.crashlytics;
 const raw=config&&process.env[config.serviceAccountJsonEnv];
 if(!config||!raw)throw Error('Firebase Crashlytics connection required');
 const client=await new GoogleAuth({credentials:JSON.parse(raw),scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 return applyFirebaseStability(view,await fetchStabilityDays(config,view,options=>client.request({...options,timeout:30000})));
}
