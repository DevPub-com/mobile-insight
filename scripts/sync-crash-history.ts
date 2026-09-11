import { loadScriptEnv } from '../src/config/load-script-env';
import { getDashboardData } from '../src/db/dashboard.repository';
import { getDb } from '../src/db';
import { upsertMetricObservations } from '../src/db/upsert';
import { syncRuns } from '../src/db/schema';
import { GooglePlayAdapter } from '../src/services/google/adapter/google-play.adapter';
import { AppStoreAdapter } from '../src/services/apple/adapter/app-store.adapter';
import { buildCrashHistory } from '../src/services/mobile/crash-history.service';
import { latestDate, periodDateRange } from '../src/services/mobile/common/metrics-calculator';
import { publicSyncError } from '../src/services/sync/sync-errors';

loadScriptEnv();
try {
 const code=process.argv[2]??'kis';
 const data=await getDashboardData(code);
 if(!data) throw Error(`App not found: ${code}`);
 for(const adapter of [new GooglePlayAdapter(),new AppStoreAdapter()]) {
  const startedAt=new Date();
  const payload=await adapter.sync(data.app,['stability']);
  if (payload.errors.length) process.exitCode=1;
  const observations=payload.observations??[];
  await upsertMetricObservations(getDb(),observations.map(row=>({...row,observedAt:new Date(row.observedAt)})));
  await getDb().insert(syncRuns).values({appId:data.app.id,platform:adapter.platform,syncType:'stability',status:payload.errors.length?'failed':'success',startedAt,finishedAt:new Date(),recordsCount:observations.length,errorMessage:publicSyncError(payload.errors.join('\n')||null)});
  console.log(JSON.stringify({platform:adapter.platform,records:observations.length,crashDays:observations.filter(row=>row.metricKey==='crash_report_count').length,errors:payload.errors.map(error=>publicSyncError(error))}));
 }
 const refreshed=await getDashboardData(code);
 if(refreshed) {const history=buildCrashHistory(refreshed,periodDateRange('30d', latestDate(refreshed)));console.log('PERSISTED',JSON.stringify({android:history.android,ios:history.ios}));}
} catch(e) {console.error(e instanceof Error?e.message:'Failed');process.exitCode=1;}
process.exit(process.exitCode??0);
