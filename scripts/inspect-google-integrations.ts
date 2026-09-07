import { sql } from "drizzle-orm";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";

loadScriptEnv();
const rows = await getDb().execute(sql`
  select distinct on (a.code, s.sync_type) a.code, s.sync_type, s.status,
    s.records_count, s.error_message, s.started_at
  from sync_runs s
  join app_master a on a.id = s.app_id
  where s.platform = 'android'
    and s.sync_type in ('stability', 'distribution')
  order by a.code, s.sync_type, s.started_at desc
`);
console.info(rows);
