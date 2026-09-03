import { loadScriptEnv } from "../src/config/load-script-env";
import { backfillAllApps } from "../src/services/sync/backfill-app";
import { parseBackfillOptions } from "../src/services/sync/backfill-options";

loadScriptEnv();

console.info("Starting Mobile Insight store history backfill...");
const options = parseBackfillOptions(process.argv.slice(2));
const results = await backfillAllApps((progress) => {
  if (!progress.done && progress.platform === "ios" && progress.batches % 25 !== 0) return;
  if (!progress.done) {
    console.info(
      `[${progress.app}/${progress.platform}] ${progress.batches} batches, ${progress.records} records`,
    );
    return;
  }
  if (progress.error) {
    console.error(
      `[${progress.app}/${progress.platform}] ${progress.records ? "partial" : "failed"}: ${progress.records} records processed; ${progress.error}`,
    );
  } else {
    console.info(
      `[${progress.app}/${progress.platform}] complete: ${progress.records} records processed`,
    );
  }
}, options);

process.exit(results.some((result) => result.error) ? 1 : 0);
