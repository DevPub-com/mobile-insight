import { GoogleAuth } from 'google-auth-library';
import { getStoreCredentialProfile } from '@/config/store-config';
import type { Platform } from '@/domain/types';
import { rollingDateRange } from '@/lib/date';
import { shiftDate, type MetricDateRange } from '@/services/mobile/common/metrics-calculator';
import type { ReportingRequest } from '@/services/google/google-nonfatal';
import type { CrashlyticsConfig } from './crashlytics';

export type ImpactDay = {date:string;users:number};
export type CrashImpactMetric = {
  value:number|null;change:number|null;date:string|null;
  status:'available'|'no_data'|'inconsistent'|'error'|'not_configured';
  trend:Array<{date:string;value:number|null}>;
};
export type CrashImpactData = Record<Platform,CrashImpactMetric>;
export const emptyImpact = (status:CrashImpactMetric['status']):CrashImpactMetric => ({value:null,change:null,date:null,status,trend:[]});
export function summarizeCrashImpact(crashes:ImpactDay[],active:ImpactDay[],range:MetricDateRange):CrashImpactMetric {
  const numerator=new Map(crashes.map(row=>[row.date,row.users]));
  const denominator=new Map(active.map(row=>[row.date,row.users]));
  const rate=(date:string) => {
    const users=numerator.get(date),dau=denominator.get(date);
    return users!==undefined && dau!==undefined && Number.isSafeInteger(users) && Number.isSafeInteger(dau) && users>=0 && dau>0 && users<=dau ? users/dau*100 : null;
  };
  const trend:CrashImpactMetric['trend']=[];
  for(let date=range.startDate;date<=range.endDate;date=shiftDate(date,1)) trend.push({date,value:rate(date)});
  // Never add daily unique users to manufacture a period-wide user percentage.
  const latest=trend.filter(point=>numerator.has(point.date)&&denominator.has(point.date)).at(-1);
  if(!latest) return {...emptyImpact('no_data'),trend};
  const previous=rate(shiftDate(latest.date,-1));
  return {date:latest.date,value:latest.value,change:latest.value!==null&&previous!==null?latest.value-previous:null,status:latest.value===null?'inconsistent':'available',trend};
}
export function crashImpactQuery(config:CrashlyticsConfig,platform:Platform,range:MetricDateRange,timeZone:string) {
  const parts=[config.projectId,config.dataset,config.tables[platform]];
  if(parts.some(value=>!value||!/^[-\w]+$/.test(value))) throw Error('Invalid Firebase table');
  return {query:`SELECT TO_JSON_STRING(t) FROM (SELECT CAST(DATE(event_timestamp,@zone) AS STRING) AS date,
    COUNT(DISTINCT IF(error_type='FATAL',NULLIF(installation_uuid,''),NULL)) AS users
    FROM \`${parts.join('.')}\`
    WHERE event_timestamp >= TIMESTAMP(@from,@zone)
    AND event_timestamp < TIMESTAMP(DATE_ADD(DATE(@to),INTERVAL 1 DAY),@zone)
    GROUP BY date) t`,useLegacySql:false,location:config.location,maximumBytesBilled:'10000000000',timeoutMs:10000,parameterMode:'NAMED',
    queryParameters:Object.entries({from:shiftDate(range.startDate,-1),to:range.endDate,zone:timeZone}).map(([name,value])=>({name,parameterType:{type:'STRING'},parameterValue:{value}}))};
}
async function queryCrashUsers(config:CrashlyticsConfig,platform:Platform,range:MetricDateRange,zone:string,request:ReportingRequest) {
  type Result={jobComplete?:boolean;jobReference?:{jobId:string};errors?:unknown[];pageToken?:string;rows?:Array<{f:Array<{v:string}>}>};
  const base=`https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`;
  let {data}=await request<Result>({url:base,method:'POST',data:crashImpactQuery(config,platform,range,zone)});
  const job=data.jobReference?.jobId;
  for(let i=0;!data.jobComplete&&i<3;i++) {
    if(!job||data.errors?.length) throw Error('Firebase query failed');
    data=(await request<Result>({url:`${base}/${encodeURIComponent(job)}?location=${config.location}&timeoutMs=10000`})).data;
  }
  if(!data.jobComplete||data.errors?.length) throw Error('Firebase query incomplete');
  const rows:ImpactDay[]=[];
  while(true) {
    rows.push(...(data.rows??[]).map(row=>JSON.parse(row.f[0].v) as ImpactDay));
    if(!data.pageToken) break;
    if(!job) throw Error('Missing Firebase job');
    data=(await request<Result>({url:`${base}/${encodeURIComponent(job)}?location=${config.location}&pageToken=${encodeURIComponent(data.pageToken)}`})).data;
    if(data.errors?.length) throw Error('Firebase page failed');
  }
  return rows;
}
const cache=new Map<string,{expires:number;value:Promise<CrashImpactData>}>();
export async function loadCrashImpact(appCode:string,range:MetricDateRange):Promise<CrashImpactData> {
  const profile=getStoreCredentialProfile(appCode), config=profile?.crashlytics, ga=profile?.googleAnalytics;
  if(!config||!ga||!process.env[config.serviceAccountJsonEnv]||!process.env[ga.serviceAccountJsonEnv]||!process.env[ga.propertyIdEnv]) return {android:emptyImpact('not_configured'),ios:emptyImpact('not_configured')};
  const key=`${appCode}:${range.startDate}:${range.endDate}`;
  const existing=cache.get(key);if(existing&&existing.expires>Date.now()) return existing.value;
  const value=(async()=>{
    const auth=await new GoogleAuth({credentials:JSON.parse(process.env[ga.serviceAccountJsonEnv]!),scopes:['https://www.googleapis.com/auth/analytics.readonly']}).getClient();
    type Report={metadata?:{timeZone?:string;subjectToThresholding?:boolean;samplingMetadatas?:unknown[];dataLossFromOtherRow?:boolean};rows?:Array<{dimensionValues?:Array<{value?:string}>;metricValues?:Array<{value?:string}>}>};
    const property=process.env[ga.propertyIdEnv]!;
    if(!/^\d+$/.test(property)) throw Error('Invalid GA4 property');
    const {data}=await auth.request<Report>({url:`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,method:'POST',timeout:20000,data:{dateRanges:[{startDate:shiftDate(range.startDate,-1),endDate:range.endDate}],dimensions:[{name:'date'},{name:'platform'}],metrics:[{name:'active1DayUsers'}],limit:'10000',keepEmptyRows:true}});
    const zone=data.metadata?.timeZone;
    if(!zone||data.metadata?.subjectToThresholding||data.metadata?.samplingMetadatas?.length||data.metadata?.dataLossFromOtherRow) throw Error('GA4 denominator incomplete');
    const end=rollingDateRange(new Date(),1,zone).endDate;
    const queryRange={...range,endDate:range.endDate<end?range.endDate:end};
    if(queryRange.startDate>queryRange.endDate) return {android:emptyImpact('no_data'),ios:emptyImpact('no_data')};
    const active:Record<Platform,ImpactDay[]>={android:[],ios:[]};
    for(const row of data.rows??[]) {
      const day=row.dimensionValues?.[0]?.value,platform=row.dimensionValues?.[1]?.value?.toLowerCase(),raw=row.metricValues?.[0]?.value;
      if(day&&/^\d{8}$/.test(day)&&(platform==='android'||platform==='ios')&&raw!==undefined) active[platform].push({date:`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}`,users:Number(raw)});
    }
    const client=await new GoogleAuth({credentials:JSON.parse(process.env[config.serviceAccountJsonEnv]!),scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
    const results=await Promise.all((['android','ios'] as const).map(async platform=>{
      try{return summarizeCrashImpact(await queryCrashUsers(config,platform,queryRange,zone,options=>client.request({...options,timeout:20000})),active[platform],queryRange);}
      catch(error){console.error('Crash impact query failed', platform, (error as {response?:{data?:{error?:{message?:string}}}}).response?.data?.error?.message ?? (error as Error).message);return emptyImpact('error');}
    }));
    return {android:results[0],ios:results[1]};
  })();
  for(const [key,item] of cache) if(item.expires<=Date.now()) cache.delete(key);
  if(cache.size>=100) cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+60000,value});
  try {
    const result=await value;
    const failed=Object.values(result).some(metric=>metric.status==='error');
    cache.set(key,{expires:Date.now()+(failed?10000:300000),value});
    return result;
  } catch(error){cache.delete(key);throw error;}
}
