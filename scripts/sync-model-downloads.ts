import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { getActiveApps } from "../src/db/dashboard.repository";
import { upsertMetricObservations } from "../src/db/upsert";
import { GooglePlayAdapter } from "../src/services/google/adapter/google-play.adapter";

loadScriptEnv();
const adapter = new GooglePlayAdapter();
const selectedCode = process.argv.find((value) => value.startsWith("--app="))?.slice(6);
const selection = process.argv.includes("--all") ? "all" : "recent";
const apps = (await getActiveApps()).filter((app) => app.androidPackageName && (!selectedCode || app.code === selectedCode));
let failed = false;
for (const app of apps) {
  try {
    const records = await adapter.fetchModelDownloads(app, selection);
    await upsertMetricObservations(getDb(), records.map((record) => ({ ...record, observedAt: new Date(record.observedAt) })));
    console.info(`${app.code}: ${records.length} model observations saved (${selection}).`);
  } catch (error) {
    failed = true;
    console.error(`${app.code}: ${error instanceof Error ? error.message : "Model sync failed"}`);
  }
}
process.exit(failed ? 1 : 0);
