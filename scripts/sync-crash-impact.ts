import {loadScriptEnv} from '../src/config/load-script-env';
import {getDb} from '../src/db';
import {apps} from '../src/db/schema';
import {eq} from 'drizzle-orm';
import {loadCrashImpact} from '../src/services/firebase/crash-impact';
import {crashImpactObservations} from '../src/services/firebase/stored-crash-impact';
import {rollingDateRange} from '../src/lib/date';
import {upsertMetricObservations} from '../src/db/upsert';
loadScriptEnv();
const db=getDb();
let failed=false;
for(const app of await db.select().from(apps).where(eq(apps.isActive,true))) {
 const data=await loadCrashImpact(app.code,rollingDateRange(new Date(),35,'Asia/Seoul'));
 const rows=crashImpactObservations(app.id,data,new Date().toISOString());
 await upsertMetricObservations(db,rows.map(row=>({...row,observedAt:new Date(row.observedAt)})));
 console.info(app.code,rows.length,'daily ratios stored',Object.fromEntries(Object.entries(data).map(([p,m])=>[p,{status:m.status,date:m.date,value:m.value}])));
 failed ||=Object.values(data).some(m=>m.status==='error'||m.status==='not_configured');
}
process.exit(failed?1:0);
