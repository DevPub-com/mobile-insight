import { loadScriptEnv } from "../src/config/load-script-env";
import { syncAllApps } from "../src/services/sync/sync-app";

loadScriptEnv();
const scope = process.env.SYNC_SCOPE ?? "all";
if (!["all", "voc", "metrics"].includes(scope)) throw new Error("Invalid SYNC_SCOPE");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the synchronization runner");

console.info("Starting Mobile Insight store sync...");
const results = await syncAllApps(scope as "all" | "voc" | "metrics");
for (const result of results) {
  console.info(
    `[${result.app}/${result.platform}] ${result.status}: ${result.recordsCount} records`,
  );
}

process.exit(results.some((result) => result.status !== "success") ? 1 : 0);
