import { eq, sql } from "drizzle-orm";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { apps, deviceDailyRecords } from "../src/db/schema";

loadScriptEnv();

const db = getDb();
const rows = await db
  .select({
    app: apps.code,
    platform: deviceDailyRecords.platform,
    records: sql<number>`count(*)::int`,
    firstDate: sql<string>`min(${deviceDailyRecords.date})`,
    lastDate: sql<string>`max(${deviceDailyRecords.date})`,
    distinctDevices:
      sql<number>`count(distinct (${deviceDailyRecords.deviceBrand}, ${deviceDailyRecords.deviceModel}))::int`,
  })
  .from(deviceDailyRecords)
  .innerJoin(apps, eq(deviceDailyRecords.appId, apps.id))
  .groupBy(apps.code, deviceDailyRecords.platform)
  .orderBy(apps.code, deviceDailyRecords.platform);

console.table(rows);
process.exit(0);
