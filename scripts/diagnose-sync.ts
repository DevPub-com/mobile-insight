import { sql } from "drizzle-orm";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";

loadScriptEnv();

const db = getDb();
const enumRows = await db.execute(sql`
  select e.enumlabel
  from pg_type t
  join pg_enum e on t.oid = e.enumtypid
  where t.typname = 'sync_type'
  order by e.enumsortorder
`);
const columns = await db.execute(sql`
  select column_name
  from information_schema.columns
  where table_name in ('overview_daily_summary', 'release_summary')
    and column_name in (
      'installs', 'uninstalls', 'release_notes',
      'build_number'
    )
  order by column_name
`);
console.info("sync_type:", enumRows.map((row) => row.enumlabel));
console.info("new_columns:", columns.map((row) => row.column_name));
const coverage = await db.execute(sql`
  select a.code, m.platform,
    min(m.date) as first_metric_date,
    max(m.date) as last_metric_date,
    count(*) filter (where m.downloads is not null) as download_days,
    count(*) filter (where m.installs is not null or m.uninstalls is not null) as lifecycle_days,
    count(*) filter (where m.crashes is not null or m.anrs is not null) as stability_days,
    count(*) filter (where m.active_28d_users is not null) as analytics_days
  from app_master a
  left join overview_daily_summary m on m.app_id = a.id
  group by a.code, m.platform
  order by a.code, m.platform
`);
const reviewCoverage = await db.execute(sql`
  select a.code, r.platform, count(r.id) as reviews,
    min(r.reviewed_at) as first_review_at,
    max(r.reviewed_at) as last_review_at
  from app_master a
  left join review_records r on r.app_id = a.id
  group by a.code, r.platform
  order by a.code, r.platform
`);
const releaseCoverage = await db.execute(sql`
  select a.code, r.platform, count(r.id) as releases,
    count(*) filter (where r.release_notes is not null) as releases_with_notes,
    count(*) filter (where r.build_number is not null) as releases_with_build_number
  from app_master a
  left join release_summary r on r.app_id = a.id
  group by a.code, r.platform
  order by a.code, r.platform
`);
const provenanceCoverage = await db.execute(sql`
  select a.code, o.platform, o.source, o.quality, o.metric_key,
    count(*) as observations,
    min(o.date) as first_date,
    max(o.date) as last_date
  from app_master a
  join usage_daily_records o on o.app_id = a.id
  where a.code = 'kis'
  group by a.code, o.platform, o.source, o.quality, o.metric_key
  order by o.platform, o.source, o.metric_key
`);
const snapshotCoverage = await db.execute(sql`
  select a.code, s.platform, s.source, s.quality,
    count(*) as rating_snapshots,
    min(s.date) as first_date,
    max(s.date) as last_date
  from app_master a
  join rating_daily_records s on s.app_id = a.id
  where a.code = 'kis'
  group by a.code, s.platform, s.source, s.quality
  order by s.platform, s.source
`);
const stabilityCoverage = await db.execute(sql`
  select a.code, o.metric_key, count(*) as observations,
    min(o.date) as first_date, max(o.date) as last_date
  from app_master a
  join usage_daily_records o on o.app_id = a.id
  where o.metric_key in (
    'user_perceived_crash_rate_28d',
    'user_perceived_anr_rate_28d'
  )
  group by a.code, o.metric_key
  order by a.code, o.metric_key
`);
const distributionCoverage = await db.execute(sql`
  select a.code, d.country_codes, d.rest_of_world, d.device_types,
    d.quality, d.observed_at
  from app_master a
  join android_distribution_snapshots d on d.app_id = a.id
  order by a.code
`);
const recentMetricEvidence = await db.execute(sql`
  select m.platform, m.date, m.downloads, m.rating, m.rating_count,
    exists (
      select 1 from usage_daily_records o
      where o.app_id = m.app_id and o.platform = m.platform
        and o.date = m.date and o.metric_key in ('daily_user_installs', 'total_downloads')
    ) as has_download_provenance,
    exists (
      select 1 from rating_daily_records s
      where s.app_id = m.app_id and s.platform = m.platform and s.date = m.date
    ) as has_rating_snapshot
  from overview_daily_summary m
  join app_master a on a.id = m.app_id
  where a.code = 'kis' and m.date >= '2026-08-01'
  order by m.platform, m.date
`);
const latestRuns = await db.execute(sql`
  select distinct on (a.code, s.platform) a.code, s.platform, s.status,
    left(coalesce(s.error_message, ''), 300) as error_message
  from sync_runs s
  join app_master a on a.id = s.app_id
  where s.sync_type = 'all'
  order by a.code, s.platform, s.started_at desc
`);
const latestAndroidIntegrationRuns = await db.execute(sql`
  select distinct on (a.code, s.sync_type) a.code, s.sync_type, s.status,
    s.records_count, left(coalesce(s.error_message, ''), 300) as error_message
  from sync_runs s
  join app_master a on a.id = s.app_id
  where s.platform = 'android'
    and s.sync_type in ('stability', 'distribution')
  order by a.code, s.sync_type, s.started_at desc
`);
console.info("metric_coverage:", coverage);
console.info("review_coverage:", reviewCoverage);
console.info("release_coverage:", releaseCoverage);
console.info("provenance_coverage:", provenanceCoverage);
console.info("snapshot_coverage:", snapshotCoverage);
console.info("stability_coverage:", stabilityCoverage);
console.info("distribution_coverage:", distributionCoverage);
console.info("recent_metric_evidence:", recentMetricEvidence);
console.info("latest_sync_runs:", latestRuns);
console.info("latest_android_integration_runs:", latestAndroidIntegrationRuns);
const migrationTables = await db.execute(sql`
  select table_schema, table_name
  from information_schema.tables
  where table_name = '__drizzle_migrations'
`);
console.info("migration_tables:", migrationTables);
for (const row of migrationTables) {
  const migrationRows = await db.execute(
    sql.raw(
      `select id, hash, created_at from "${String(row.table_schema)}"."__drizzle_migrations" order by id`,
    ),
  );
  console.info("migration_rows:", migrationRows);
}
