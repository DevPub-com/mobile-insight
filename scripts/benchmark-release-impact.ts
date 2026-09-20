import { performance } from "node:perf_hooks";
import assert from "node:assert/strict";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, lte, or, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { apps, dailyMetrics, metricObservations, reviews } from "../src/db/schema";
import { joinedRows } from "../src/db/joined-rows";
import { getDashboardData } from "../src/db/dashboard.repository";
import { displayReleaseVersion } from "../src/services/mobile/common/release-version";
import type { AppRelease } from "../src/domain/types";

// Read-only benchmark; use the same connection pool and predicates as production.
const db = getDb();
const base = await getDashboardData("kis", "releases");
if (!base) throw new Error("Application not found");
const filter = or(
  inArray(metricObservations.metricKey, ["daily_user_installs", "first_time_downloads", "user_perceived_crash_rate_28d", "user_perceived_anr_rate_28d"]),
  ...["crash_report_count", "anr_report_count", "crash_affected_users", "anr_affected_users"].flatMap(key =>
    ["version", "version_code"].map(kind => like(metricObservations.metricKey, `${key}:${kind}:%`))),
);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
const targets = ["android", "ios"].flatMap(platform => {
  const releases = base.releases.filter(r => r.platform === platform && r.releasedAt.slice(0, 10) <= today);
  return [releases[0], releases[3]].filter(Boolean);
});
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const release of targets) {
  const platform = release.platform;
  const siblings: AppRelease[] = base.releases.filter(r => r.platform === platform).sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
  const date = release.releasedAt.slice(0, 10);
  const previous = siblings.filter(r => r.releasedAt.slice(0, 10) < date && displayReleaseVersion(platform, r.version) !== displayReleaseVersion(platform, release.version)).at(-1);
  const next = siblings.find(r => r.releasedAt.slice(0, 10) > date);
  const from = previous?.releasedAt.slice(0, 10) ?? date;
  const nextDay = next ? new Date(`${next.releasedAt.slice(0, 10)}T00:00:00Z`) : null;
  if (nextDay) nextDay.setUTCDate(nextDay.getUTCDate() - 1);
  const to = nextDay ? [nextDay.toISOString().slice(0, 10), today].sort()[0] : today;
  const metricQuery = db.select().from(dailyMetrics).where(and(eq(dailyMetrics.appId, release.appId), eq(dailyMetrics.platform, platform), gte(dailyMetrics.date, from), lte(dailyMetrics.date, to))).orderBy(asc(dailyMetrics.date));
  const observationQuery = db.select().from(metricObservations).where(and(eq(metricObservations.appId, release.appId), eq(metricObservations.platform, platform), gte(metricObservations.date, from), lte(metricObservations.date, to), filter)).orderBy(asc(metricObservations.date));
  const reviewQuery = db.select().from(reviews).where(and(eq(reviews.appId, release.appId), eq(reviews.platform, platform), gte(reviews.reviewedAt, new Date(`${from}T00:00:00Z`)), lte(reviews.reviewedAt, new Date(`${to}T23:59:59.999Z`)), isNotNull(reviews.version))).orderBy(desc(reviews.reviewedAt), desc(reviews.id));
  const m = joinedRows(dailyMetrics, metricQuery, "impact_metrics");
  const o = joinedRows(metricObservations, observationQuery, "impact_observations");
  const r = joinedRows(reviews, reviewQuery, "impact_reviews");
  const joinedQuery = db.select({ metrics: m.rows, observations: o.rows, reviews: r.rows }).from(apps)
    .leftJoinLateral(m, sql`true`).leftJoinLateral(o, sql`true`).leftJoinLateral(r, sql`true`).where(eq(apps.id, release.appId));
  const separate = async () => {
    const [metrics, observations, reviews] = await Promise.all([metricQuery, observationQuery, reviewQuery]);
    return { metrics, observations, reviews };
  };
  const joined = async () => (await joinedQuery)[0];
  const baseline = await separate();
  const candidate = await joined();
  const normalize = (rows: { id: string }[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  for (const key of ["metrics", "observations", "reviews"] as const) assert.deepEqual(normalize(candidate[key]), normalize(baseline[key]));
  assert.deepEqual(candidate.reviews, baseline.reviews);
  const times = { separate: [] as number[], joined: [] as number[] };
  for (let round = 0; round < 7; round++) {
    for (const mode of round % 2 ? ["joined", "separate"] as const : ["separate", "joined"] as const) {
      const start = performance.now();
      await (mode === "joined" ? joined() : separate());
      times[mode].push(performance.now() - start);
    }
  }
  const explain = async (query: { toSQL(): { sql: string; params: unknown[] } }) => {
    const compiled = query.toSQL();
    const client = (globalThis as typeof globalThis & { mobileInsightSqlClient: { unsafe: (query: string, params: never[]) => Promise<Array<Record<string, unknown>>> } }).mobileInsightSqlClient;
    const result = await client.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${compiled.sql}`, compiled.params as never[]);
    const plan = (result[0]["QUERY PLAN"] as Array<Record<string, unknown>>)[0];
    return { planningMs: plan["Planning Time"], executionMs: plan["Execution Time"] };
  };
  const plans = { separate: [], joined: await explain(joinedQuery) } as { separate: unknown[]; joined: unknown };
  for (const query of [metricQuery, observationQuery, reviewQuery]) plans.separate.push(await explain(query));
  console.log(JSON.stringify({ platform, version: release.version, from, to, rows: Object.fromEntries(Object.entries(baseline).map(([key, rows]) => [key, rows.length])), decodedBytes: Buffer.byteLength(JSON.stringify(baseline)), identical: true, medianMs: { separate: median(times.separate), joined: median(times.joined) }, times, plans }));
}
process.exit(0);
