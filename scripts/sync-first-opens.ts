import { and, eq } from "drizzle-orm";
import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { apps, metricObservations } from "../src/db/schema";
import { upsertMetricObservations } from "../src/db/upsert";
import { Ga4Adapter } from "../src/services/mobile/adapter/ga4.adapter";

loadScriptEnv();
const code = process.argv[2] ?? "kis";
const apply = process.argv.includes("--apply");
const db = getDb();
try {
  const [app] = await db.select().from(apps).where(eq(apps.code, code));
  if (!app) throw new Error("App not found.");
  const observations = await new Ga4Adapter().fetchFirstOpens(app);
  if (apply) {
    await db.transaction(async (tx) => {
      await upsertMetricObservations(tx, observations.map((row) => ({ ...row, observedAt: new Date(row.observedAt) })));
    });
  }
  console.info(JSON.stringify({ applied: apply, app: code, observations }, null, 2));
  if (apply) {
    const stored = await db.select({ date: metricObservations.date, platform: metricObservations.platform, value: metricObservations.value })
      .from(metricObservations).where(and(eq(metricObservations.appId, app.id), eq(metricObservations.source, "firebase"), eq(metricObservations.metricKey, "first_open")));
    console.info(JSON.stringify({ stored }, null, 2));
  }
} catch (error) {
  // Never log the HTTP client error object: it can contain authentication headers.
  console.error(error instanceof Error ? error.message : "First-open sync failed.");
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
