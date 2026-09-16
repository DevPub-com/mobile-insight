export type NonfatalIssue = { name: string; cause: string; location: string; count: number | null; users: number | null };
export type NonfatalData = { daily: {date: string; os: string; count: number}[]; issues: NonfatalIssue[]; moreIssues: boolean };
export type ReportingRequest = <T>(options: {url: string; method?: 'GET' | 'POST'; data?: unknown}) => Promise<{data: T}>;
const count = (value: unknown) => value !== null && value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
export function nonfatalFilter(codes: string[], apiLevel?: string) {
  if (!codes.length || codes.some(code => !/^\d+$/.test(code))) throw new Error('Version codes required');
  if (apiLevel && !/^\d+$/.test(apiLevel)) throw new Error('Invalid API level');
  return `${codes.map(code => `versionCode = ${code}`).join(' OR ')} AND errorIssueType = NON_FATAL${apiLevel ? ` AND apiLevel = ${apiLevel}` : ''}`;
}
function intervalParams(start: Date, end: Date) {
  const params = new URLSearchParams();
  for (const [side,date] of [['startTime',start],['endTime',end]] as const) {
    for (const [field,value] of Object.entries({year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hours:date.getUTCHours()})) params.set(`interval.${side}.${field}`,String(value));
  }
  return params;
}
export async function fetchNonfatalDetails(packageName: string, codes: string[], releasedAt: string, request: ReportingRequest, apiLevel?: string, issueId?: string, now = new Date()) {
  const filter = nonfatalFilter(codes,apiLevel);
  const base = `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(packageName)}`;
  const start = new Date(releasedAt); start.setUTCMinutes(0,0,0);
  const end = new Date(now); end.setUTCMinutes(0,0,0);
  if (!Number.isFinite(start.getTime()) || start >= end) throw new Error('Invalid release interval');
  const params = intervalParams(start,end);
  if (issueId) {
    if (!/^[a-zA-Z0-9_-]+$/.test(issueId)) throw new Error('Invalid issue id');
    params.set('filter',`${filter} AND errorIssueId = ${issueId}`); params.set('pageSize','1');
    const result = await request<{errorReports?: {reportText?: string; type?: string}[]}>({url:`${base}/errorReports:search?${params}`});
    const report = result.data.errorReports?.find(r => r.type === 'NON_FATAL');
    return {trace: report?.reportText ?? null};
  }
  params.set('filter',filter); params.set('pageSize','10'); params.set('orderBy','errorReportCount desc');
  const issues = await request<{errorIssues?: {name:string; type:string; cause?:string; location?:string; errorReportCount?:string; distinctUsers?:string}[]; nextPageToken?:string}>({url:`${base}/errorIssues:search?${params}`});
  const meta = await request<{freshnessInfo?:{freshnesses?:{aggregationPeriod:string;latestEndTime:{year:number;month:number;day:number}}[]}}>({url:`${base}/errorCountMetricSet`});
  const latest = meta.data.freshnessInfo?.freshnesses?.find(f=>f.aggregationPeriod==='DAILY')?.latestEndTime;
  if (!latest) throw new Error('Daily freshness unavailable');
  const daily: NonfatalData['daily'] = [];
  if (Date.UTC(latest.year,latest.month-1,latest.day) > Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate())) {
    let pageToken: string | undefined;
    do {
      const result = await request<{rows?: {startTime:{year:number;month:number;day:number};dimensions:{dimension:string;stringValue:string}[];metrics:{metric:string;decimalValue:{value:string}}[]}[];nextPageToken?:string}>({url:`${base}/errorCountMetricSet:query`,method:'POST',data:{
        timelineSpec:{aggregationPeriod:'DAILY',startTime:{year:start.getUTCFullYear(),month:start.getUTCMonth()+1,day:start.getUTCDate()},endTime:{year:latest.year,month:latest.month,day:latest.day}},
        dimensions:['reportType','versionCode','apiLevel'],metrics:['errorReportCount'],pageSize:1000,...(pageToken?{pageToken}:{})
      }});
      for (const row of result.data.rows??[]) {
        if (row.dimensions.find(d=>d.dimension==='reportType')?.stringValue!=='NON_FATAL' || !codes.includes(row.dimensions.find(d=>d.dimension==='versionCode')?.stringValue??'') || (apiLevel && row.dimensions.find(d=>d.dimension==='apiLevel')?.stringValue!==apiLevel)) continue;
        const value=count(row.metrics.find(m=>m.metric==='errorReportCount')?.decimalValue?.value);
        if(value!==null) daily.push({date:`${row.startTime.year}-${String(row.startTime.month).padStart(2,'0')}-${String(row.startTime.day).padStart(2,'0')}`,os:row.dimensions.find(d=>d.dimension==='apiLevel')?.stringValue??'unknown',count:value});
      }
      pageToken=result.data.nextPageToken;
    } while(pageToken);
  }
  return {daily,issues:(issues.data.errorIssues??[]).filter(i=>i.type==='NON_FATAL').map(i=>({name:i.name,cause:i.cause??'원인 미제공',location:i.location??'',count:count(i.errorReportCount),users:count(i.distinctUsers)})),moreIssues:!!issues.data.nextPageToken} satisfies NonfatalData;
}
