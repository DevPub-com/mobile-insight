import { GoogleAuth } from 'google-auth-library';
import { getStoreCredentialProfile } from '@/config/store-config';
import type { Platform } from '@/domain/types';
import { dateRangeDays, previousDateRange, shiftDate, type MetricDateRange } from '@/services/mobile/common/metrics-calculator';
import type { ReportingRequest } from '@/services/google/google-nonfatal';
import type { CrashlyticsConfig } from './crashlytics';

export type CrashFreeStatus = 'available' | 'sessions_missing' | 'crashes_missing' | 'no_data' | 'partial' | 'inconsistent' | 'not_configured' | 'error';
export type CrashFreeMetric = {
  status: CrashFreeStatus;
  value: number | null;
  change: number | null;
  days: number;
  trend: Array<{ date: string; value: number | null }>;
};
export type CrashFreeData = Record<Platform, CrashFreeMetric>;
export type CrashFreeRow = { period: 'current' | 'previous'; date: string | null; users: number; crashedUsers: number };
export const emptyCrashFreeMetric = (status: CrashFreeStatus): CrashFreeMetric => ({status, value:null, change:null, days:0, trend:[]});

export function crashFreePercentage(users: number, crashedUsers: number) {
  return Number.isSafeInteger(users) && Number.isSafeInteger(crashedUsers) && users > 0 && crashedUsers >= 0 && crashedUsers <= users
    ? (1 - crashedUsers / users) * 100 : null;
}

export function summarizeCrashFree(rows: CrashFreeRow[], range: MetricDateRange): CrashFreeMetric {
  const daily = new Map(rows.filter(row => row.period === 'current' && row.date !== null).map(row => [row.date!, row]));
  const current = rows.find(row => row.period === 'current' && row.date === null);
  const before = rows.find(row => row.period === 'previous' && row.date === null);
  const trend: CrashFreeMetric['trend'] = [];
  for (let date=range.startDate; date<=range.endDate; date=shiftDate(date,1)) {
    const row = daily.get(date);
    trend.push({date, value:row ? crashFreePercentage(row.users, row.crashedUsers) : null});
  }
  const days = trend.filter(point => point.value !== null).length;
  const complete = days === dateRangeDays(range);
  const previousComplete = rows.filter(row => row.period === 'previous' && row.date !== null && crashFreePercentage(row.users,row.crashedUsers) !== null).length === dateRangeDays(range);
  const rate = current ? crashFreePercentage(current.users,current.crashedUsers) : null;
  const value = complete ? rate : null;
  const previousValue = previousComplete && before ? crashFreePercentage(before.users,before.crashedUsers) : null;
  const status = !current || current.users === 0 ? 'no_data' : rate === null ? 'inconsistent' : !complete ? 'partial' : 'available';
  return {status, value, change:value !== null && previousValue !== null ? value-previousValue : null, days, trend};
}

// Batch and realtime exports overlap; COUNT(DISTINCT ...) deduplicates both, across the entire period.
export function crashFreeQuery(config: CrashlyticsConfig, sessionTables: string[], crashTables: string[], range: MetricDateRange) {
  const identifier = (dataset: string, table: string) => {
    if (![config.projectId,dataset,table].every(value => /^[\w-]+$/.test(value))) throw Error('Invalid Firebase table');
    return `\`${config.projectId}.${dataset}.${table}\``;
  };
  const window = "event_timestamp >= TIMESTAMP(@from, 'Asia/Seoul') AND event_timestamp < TIMESTAMP(DATE_ADD(DATE(@to), INTERVAL 1 DAY), 'Asia/Seoul')";
  const sessions = sessionTables.map(table => `SELECT DATE(event_timestamp,'Asia/Seoul') AS date, NULLIF(instance_id,'') AS user_id, CAST(NULL AS STRING) AS crash_id FROM ${identifier('firebase_sessions',table)} WHERE ${window} AND crashlytics_data_collection_enabled = TRUE`);
  const crashes = crashTables.map(table => `SELECT DATE(event_timestamp,'Asia/Seoul') AS date, CAST(NULL AS STRING) AS user_id, NULLIF(installation_uuid,'') AS crash_id FROM ${identifier(config.dataset,table)} WHERE ${window} AND error_type = 'FATAL'`);
  if (!sessions.length || !crashes.length) throw Error('Missing Firebase export');
  return {
    query: `WITH events AS (${[...sessions,...crashes].join(' UNION ALL ')}), periods AS (
      SELECT *, IF(date >= DATE(@start),'current','previous') AS period FROM events
    ) SELECT TO_JSON_STRING(STRUCT(period, CAST(date AS STRING) AS date, COUNT(DISTINCT user_id) AS users, COUNT(DISTINCT crash_id) AS crashedUsers))
      FROM periods GROUP BY GROUPING SETS ((period,date),(period))`,
    useLegacySql:false, location:config.location, maximumBytesBilled:'10000000000', timeoutMs:10000, parameterMode:'NAMED',
    queryParameters:Object.entries({from:previousDateRange(range).startDate,start:range.startDate,to:range.endDate}).map(([name,value]) => ({name,parameterType:{type:'STRING'},parameterValue:{value}})),
  };
}

async function listTables(config: CrashlyticsConfig, dataset: string, request: ReportingRequest) {
  const names: string[] = [];
  let pageToken: string | undefined;
  do {
    const {data} = await request<{tables?:Array<{tableReference:{tableId:string}}>;nextPageToken?:string}>({url:`https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/datasets/${dataset}/tables?maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`});
    names.push(...(data.tables ?? []).map(table => table.tableReference.tableId));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return new Set(names);
}
function statusCode(error: unknown) {
  return (error as {response?:{status?:number}})?.response?.status;
}

export async function fetchCrashFree(config: CrashlyticsConfig, range: MetricDateRange, request: ReportingRequest): Promise<CrashFreeData> {
  const sessionTables = await listTables(config,'firebase_sessions',request).catch(error => {
    if(statusCode(error) === 404) return new Set<string>();
    throw error;
  });
  if(!sessionTables.size) return {android:emptyCrashFreeMetric('sessions_missing'),ios:emptyCrashFreeMetric('sessions_missing')};
  const crashTables = await listTables(config,config.dataset,request);
  const results = await Promise.all((['android','ios'] as const).map(async platform => {
    const baseTable = config.tables[platform].replace(/_REALTIME$/,'');
    const sessions = [baseTable,`${baseTable}_REALTIME`].filter(table => sessionTables.has(table));
    const crashes = [baseTable,`${baseTable}_REALTIME`].filter(table => crashTables.has(table));
    if(!sessions.length) return emptyCrashFreeMetric('sessions_missing');
    if(!crashes.length) return emptyCrashFreeMetric('crashes_missing');
    try {
      type Result = {jobComplete?:boolean;jobReference?:{jobId:string};pageToken?:string;errors?:unknown[];rows?:Array<{f:Array<{v:string}>}>};
      const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`;
      let {data} = await request<Result>({url:base,method:'POST',data:crashFreeQuery(config,sessions,crashes,range)});
      const jobId = data.jobReference?.jobId;
      for(let attempt=0;!data.jobComplete && attempt<3;attempt++) {
        if(!jobId || data.errors?.length) throw Error('Query failed');
        data = (await request<Result>({url:`${base}/${encodeURIComponent(jobId)}?location=${encodeURIComponent(config.location)}&timeoutMs=10000`})).data;
      }
      if(!data.jobComplete || data.errors?.length) throw Error('Query incomplete');
      const rows: CrashFreeRow[] = [];
      while(true) {
        rows.push(...(data.rows ?? []).map(row => JSON.parse(row.f[0].v) as CrashFreeRow));
        if(!data.pageToken) break;
        if(!jobId) throw Error('Missing query job');
        data = (await request<Result>({url:`${base}/${encodeURIComponent(jobId)}?location=${encodeURIComponent(config.location)}&pageToken=${encodeURIComponent(data.pageToken)}`})).data;
        if(data.errors?.length) throw Error('Query page failed');
      }
      return summarizeCrashFree(rows,range);
    } catch { return emptyCrashFreeMetric('error'); }
  }));
  return {android:results[0],ios:results[1]};
}

const cache = new Map<string,{expires:number;value:Promise<CrashFreeData>}>();
export async function loadFirebaseCrashFree(appCode:string, range:MetricDateRange): Promise<CrashFreeData> {
  const config = getStoreCredentialProfile(appCode)?.crashlytics;
  const raw = config && process.env[config.serviceAccountJsonEnv];
  if(!config || !raw) return {android:emptyCrashFreeMetric('not_configured'),ios:emptyCrashFreeMetric('not_configured')};
  const key = `${appCode}:${range.startDate}:${range.endDate}`;
  const cached = cache.get(key);
  if(cached && cached.expires > Date.now()) return cached.value;
  const value = (async () => {
    const client = await new GoogleAuth({credentials:JSON.parse(raw),scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
    return fetchCrashFree(config,range,options => client.request({...options,timeout:15000}));
  })();
  // Bound memory and deduplicate simultaneous requests; pending exports refresh in one minute.
  for(const [key,entry] of cache) if(entry.expires <= Date.now()) cache.delete(key);
  if(cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key,{expires:Date.now()+60000,value});
  try {
    const result = await value;
    if(result.android.status === 'available' && result.ios.status === 'available') {
      cache.set(key,{expires:Date.now()+300000,value});
    }
    return result;
  } catch(error) { cache.delete(key); throw error; }
}
