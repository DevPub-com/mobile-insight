import { readFileSync } from "node:fs";
import postgres from "postgres";
import { loadScriptEnv } from "../src/config/load-script-env";
import { getDatabaseUrl } from "../src/lib/env";
import { parseConsoleInstallSnapshot } from "../src/services/google/google-console-installs";

const [inputPath, mode] = process.argv.slice(2);
if (!inputPath || (mode && mode !== "--apply")) {
  throw new Error("Usage: node --import tsx scripts/import-play-console-installs.ts snapshot.json [--apply]");
}
const snapshot = parseConsoleInstallSnapshot(JSON.parse(readFileSync(inputPath, "utf8")));
loadScriptEnv();
const url = getDatabaseUrl();
if (!url) throw new Error("DATABASE_URL is not configured.");
const client = postgres(url, { prepare: false, connect_timeout: 10 });
try {
  const apps = await client`select id, code from app_master where android_package_name = ${snapshot.packageName}`;
  if (apps.length !== 1) throw new Error("Package must identify exactly one configured app.");
  const app = apps[0];
  const existing = await client`select date::text, downloads from overview_daily_summary
    where app_id = ${app.id} and platform = 'android'
    and date between ${snapshot.rows[0].date} and ${snapshot.rows.at(-1)!.date}`;
  const existingByDate = new Map(existing.map(row => [row.date, row.downloads]));
  const additions = snapshot.rows.filter(row => existingByDate.get(row.date) == null);
  const overlaps = snapshot.rows.filter(row => existingByDate.get(row.date) != null);
  console.info(JSON.stringify({ app: app.code, mode: mode ?? "dry-run", rows: snapshot.rows.length,
    firstDate: snapshot.rows[0].date, lastDate: snapshot.rows.at(-1)!.date,
    missingDays: additions.length, overlapDays: overlaps.length,
    matchingOverlapDays: overlaps.filter(row => existingByDate.get(row.date) === row.value).length }));
  if (mode === "--apply") {
    await client.begin(async tx => {
      const description = `Play Console browser capture; ${snapshot.metric}; OVERALL; ${snapshot.sourceUrl}`;
      for (const row of snapshot.rows) {
        // Preserve the original named metric separately from the dashboard's legacy column.
        await tx`insert into usage_daily_records
          (app_id, platform, date, metric_key, value, source, quality, observed_at, description)
          values (${app.id}, 'android', ${row.date}, 'play_console_new_user_acquisitions', ${row.value}, 'manual', 'exact', ${snapshot.observedAt}, ${description})
          on conflict (app_id, platform, date, metric_key, source) do update
          set value = excluded.value, observed_at = excluded.observed_at, description = excluded.description, updated_at = now()
          where usage_daily_records.observed_at <= excluded.observed_at`;
      }
      for (const row of additions) {
        const inserted = await tx`insert into overview_daily_summary (app_id, platform, date, downloads)
          values (${app.id}, 'android', ${row.date}, ${row.value})
          on conflict (app_id, platform, date) do update set downloads = excluded.downloads, updated_at = now()
          where overview_daily_summary.downloads is null returning date`;
        if (!inserted.length) continue;
        await tx`insert into usage_daily_records
          (app_id, platform, date, metric_key, value, source, quality, observed_at, description)
          values (${app.id}, 'android', ${row.date}, 'daily_user_installs', ${row.value}, 'manual', 'derived', ${snapshot.observedAt}, ${description + "; mapped new-user acquisitions to missing download dates; existing CSV values preserved"})
          on conflict (app_id, platform, date, metric_key, source) do nothing`;
      }
    });
    const [coverage] = await client`select max(date)::text as latest_download, count(*) as days
      from overview_daily_summary where app_id = ${app.id} and platform = 'android' and downloads is not null`;
    console.info(JSON.stringify({ applied: true, ...coverage }));
  }
} finally {
  await client.end();
}
