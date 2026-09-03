import { loadScriptEnv } from "../src/config/load-script-env";
import { syncAllApps } from "../src/services/sync/sync-app";

loadScriptEnv();

console.info("Starting Mobile Insight store sync...");
const results = await syncAllApps();
for (const result of results) {
  console.info(
    `[${result.app}/${result.platform}] ${result.status}: ${result.recordsCount} records`,
  );
}

process.exit(results.some((result) => result.status === "failed") ? 1 : 0);
