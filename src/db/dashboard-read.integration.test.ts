import { desc, eq, sql } from "drizzle-orm";
import { joinedRows } from "./joined-rows";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "./index";
import * as schema from "./schema";
import { getDashboardData, getReleaseImpactData } from "./dashboard.repository";
import { getReviewPage, getReviewsForAnalysis } from "./review.repository";
import { parseReviewQuery } from "@/contracts/review-query";
import { buildDashboardView } from "@/services/mobile/dashboard-view";
import { loadDashboardPage, loadDashboardView } from "@/services/mobile/dashboard-page.service";
import { buildOverview, buildActiveUserTrend } from "@/services/mobile/tabs/overview.service";
import { buildPeriodSummary } from "@/services/mobile/tabs/downloads.service";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";
import { matchesKeyword } from "@/domain/reviews/review-keywords";

vi.mock("./index", () => ({ getDb: vi.fn() }));
const appId = "11111111-1111-4111-8111-111111111111";
let client: PGlite;
const statements: string[] = [];
beforeAll(async () => {
  client = new PGlite();
  const journal = JSON.parse(await readFile(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  for (const entry of journal.entries) {
    const migration = await readFile(new URL(`../../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
    await client.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }
  const db = drizzle(client, { schema, logger: { logQuery(query) { statements.push(query); } } });
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  await db.insert(schema.apps).values({ id: appId, code: "kis", name: "Test", androidPackageName: "com.test", iosAppId: "123" });
  await db.insert(schema.apps).values([
    { code: "empty", name: "Empty" }, { code: "inactive", name: "Inactive", isActive: false },
  ]);
  await db.insert(schema.androidDistributionSnapshots).values({ appId, countryCodes: ["KR", "US"],
    deviceTypes: ["phone", "tablet"], restOfWorld: true, source: "manual", quality: "exact",
    observedAt: new Date("2026-09-18T01:02:03.456Z") });
  await db.insert(schema.dailyMetrics).values([
    { appId, platform: "android", date: "2026-08-01", downloads: 10, rating: 4 },
    { appId, platform: "android", date: "2026-09-18", downloads: 20, rating: 3 },
    { appId, platform: "ios", date: "2026-09-18", downloads: null, rating: null },
  ]);
  await db.insert(schema.releases).values([
    { appId, platform: "android", version: "1.0", releasedAt: new Date("2026-07-01T00:00:00Z") },
    { appId, platform: "android", version: "2.0", releasedAt: new Date("2026-09-01T00:00:00Z") },
  ]);
  await db.insert(schema.syncRuns).values({ appId, platform: "android", syncType: "all", status: "success", finishedAt: new Date("2026-09-19T00:00:00Z") });
  // More than the old 5,000-row cutoff, with equal timestamps to exercise the tie breaker.
  for (let batch = 0; batch < 11; batch++) {
    const values = Array.from({ length: Math.min(500, 5006 - batch * 500) }, (_, offset) => {
      const i = batch * 500 + offset;
      return { id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`, appId,
        externalId: String(i), platform: i % 2 ? "ios" as const : "android" as const,
        rating: i % 5 + 1, title: "title", author: "author", content: `review-${i}-` + "body ".repeat(100),
        device: "Pixel", deviceMetadata: { ramMb: 8192 }, version: i < 3 ? "1.0" : "2.0",
        reviewedAt: new Date(i < 3 ? "2026-07-20T00:00:00Z" : "2026-09-18T23:59:59Z"),
        aiSentiment: i % 3 === 0 ? "positive" : null,
        aiTopicPaths: i % 4 === 0 ? null : [{ major: "성능", middle: "속도", minor: "로딩" }, { major: "성능", middle: "속도", minor: "로딩" }],
      };
    });
    await db.insert(schema.reviews).values(values);
  }
}, 30_000);
afterAll(async () => { await client?.close(); });

const query = (value: string) => parseReviewQuery(new URLSearchParams(value));
describe("separate read models preserve dashboard values", () => {
  it("decodes joined rows exactly like ordinary selects and preserves ordering and limits", async () => {
    const db = getDb();
    for (const table of [schema.apps, schema.dailyMetrics, schema.releases, schema.syncRuns, schema.reviews, schema.androidDistributionSnapshots]) {
      const direct = db.select().from(table).orderBy(desc(table.id)).limit(23);
      const expected = await direct;
      const joined = joinedRows(table, direct, "comparison");
      const [result] = await db.select({ rows: joined.rows }).from(schema.apps)
        .leftJoinLateral(joined, sql`true`).where(eq(schema.apps.id, appId));
      expect(result.rows).toEqual(expected);
    }
    const full = (await getDashboardData("kis"))!;
    expect(full.metrics).toHaveLength(3);
    expect(full.releases).toHaveLength(2);
    expect(full.syncRuns).toHaveLength(1);
    expect(full.reviews).toEqual(await getReviewsForAnalysis(appId));
    expect(full.apps.map(app => app.code)).toEqual(["empty", "kis"]);
    expect(full.androidDistribution).toMatchObject({ countryCodes: ["KR", "US"], restOfWorld: true });
  });

  it("keeps missing apps distinct from empty results and preserves totals past the final page", async () => {
    for (const code of ["missing", "inactive"]) {
      expect(await getDashboardData(code)).toBeNull();
      expect(await getReviewPage(code, query("period=all"))).toBeNull();
    }
    const empty = (await getDashboardData("empty"))!;
    expect(empty.metrics).toEqual([]);
    expect(empty.reviews).toEqual([]);
    expect(empty.androidDistribution).toBeNull();
    for (const [code, params, total] of [["empty", "", 0], ["kis", "from=2030-01-01&to=2030-01-31", 0], ["kis", "period=all&page=9999", 5006]] as const) {
      statements.length = 0;
      const result = (await getReviewPage(code, query(params)))!;
      expect(statements).toHaveLength(1);
      expect(result.data).toEqual([]);
      expect(result.pagination).toMatchObject({ total, nextCursor: null });
    }
  });

  it("uses the latest metric date for period filtering in one query", async () => {
    statements.length = 0;
    const result = (await getReviewPage("kis", query("period=30d")))!;
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("left join lateral");
    expect(result.pagination.total).toBe(5003);
    expect(result.data).toEqual((await getReviewsForAnalysis(appId)).filter(row => row.reviewedAt >= "2026-08-20").slice(0, 10));
  });

  it("reads only the selected table for releases, sync status, and active users", async () => {
    for (const [profile, table] of [["releases", "release_summary"], ["sync-status", "sync_runs"], ["active-users", "overview_daily_summary"]] as const) {
      statements.length = 0;
      await getDashboardData("kis", profile);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain(`from "${table}"`);
      expect(statements.join("\n")).not.toContain('from "review_records"');
    }
  });

  it("preserves all calculated metrics in narrower read profiles", async () => {
    const full = (await getDashboardData("kis"))!;
    expect(full.reviews).toHaveLength(5006);
    expect(buildOverview((await getDashboardData("kis", "overview"))!)).toEqual(buildOverview(full));
    expect(buildPeriodSummary((await getDashboardData("kis", "downloads"))!, "30d")).toEqual(buildPeriodSummary(full, "30d"));
    expect(buildActiveUserTrend((await getDashboardData("kis", "active-users"))!, "30d")).toEqual(buildActiveUserTrend(full, "30d"));
    const impact = (await getDashboardData("kis", "release-impact"))!;
    expect(buildReleaseImpactWorkspace(impact, impact.releases[0], "2026-09-18")).toEqual(buildReleaseImpactWorkspace(full, full.releases[0], "2026-09-18"));
  });

  it("preserves release-impact calculations with a release-scoped read", async () => {
    const full = (await getDashboardData("kis"))!;
    const release = full.releases.find((item) => item.platform === "android" && item.version === "2.0")!;
    const scoped = (await getReleaseImpactData("kis", release.platform, release.version))!;
    expect(buildReleaseImpactWorkspace(scoped, release)).toEqual(buildReleaseImpactWorkspace(full, release));
    expect(scoped.reviews.length).toBeLessThan(full.reviews.length);
    expect(scoped.metrics.length).toBeLessThan(full.metrics.length);
  });

  it("keeps complete aggregates and prior-release comparisons while omitting raw reviews from initial props", async () => {
    const full = (await getDashboardData("kis"))!;
    const page = (await loadDashboardPage("kis"))!;
    expect(page.data.reviews).toEqual([]);
    expect(page.initialView).toEqual(buildDashboardView(full, page.initialView.range));
    expect(page.initialView.reviewRatingSummary.summary.total).toBe(5003);
    expect(page.initialView.reviewRatingSummary.summary.negative).toBe(2001);
    expect(JSON.stringify(page).length).toBeLessThan(JSON.stringify(full).length / 4);
    for (const range of [{ startDate: "2026-08-01", endDate: "2026-08-31" }, { startDate: "2026-09-18", endDate: "2026-09-18" }]) {
      expect(await loadDashboardView(page.data, range)).toEqual(buildDashboardView(full, range));
    }
  });

  it("loads iOS impact rows in one query without changing the workspace", async () => {
    const db = getDb();
    await db.insert(schema.releases).values([
      { appId, platform: "ios", version: "1.0", releasedAt: new Date("2026-07-01T00:00:00Z") },
      { appId, platform: "ios", version: "2.0", releasedAt: new Date("2026-09-01T00:00:00Z") },
    ]);
    const full = (await getDashboardData("kis"))!;
    const release = full.releases.find(row => row.platform === "ios" && row.version === "2.0")!;
    const metadata = (await getDashboardData("kis", "releases"))!;
    statements.length = 0;
    const scoped = (await getReleaseImpactData("kis", "ios", "2.0", metadata))!;
    expect(statements).toHaveLength(1);
    expect(statements[0]).toContain("left join lateral");
    expect(scoped.reviews).toEqual(full.reviews.filter(row => row.platform === "ios"));
    expect(buildReleaseImpactWorkspace(scoped, release)).toEqual(buildReleaseImpactWorkspace(full, release));
  });

  it("counts all rows and paginates tied timestamps without missing or duplicate IDs", async () => {
    const first = (await getReviewPage("kis", query("period=all&pageSize=100")))!;
    expect(first.pagination.total).toBe(5006);
    expect(first.pagination.totalPages).toBe(51);
    const seen = first.data.map(row => row.id);
    let cursor = first.pagination.nextCursor;
    while (cursor) {
      const result = (await getReviewPage("kis", query(`period=all&pageSize=100&cursor=${cursor}`)))!;
      expect(result.pagination.total).toBe(5006);
      seen.push(...result.data.map(row => row.id));
      cursor = result.pagination.nextCursor;
    }
    expect(seen).toHaveLength(5006);
    expect(new Set(seen).size).toBe(5006);
    const legacy = (await getReviewPage("kis", query("period=all&page=501")))!;
    expect(legacy.data).toHaveLength(6);
    expect(legacy.data[0]).toMatchObject({ device: "Pixel", deviceMetadata: { ramMb: 8192 }, author: "author" });
  });

  it("matches existing keyword semantics, includes end-of-day reviews, and excludes other apps", async () => {
    const full = await getReviewsForAnalysis(appId, { startDate: "2026-09-18", endDate: "2026-09-18" });
    const selections = [
      { label: "로딩", key: '["성능","속도","로딩"]', grade: "all" as const },
      { label: "성능", key: '["성능"]', level: "major" as const, grade: "negative" as const },
      { label: "기타", key: '["기타"]', level: "major" as const, grade: "all" as const },
    ];
    for (const selection of selections) {
      const params = new URLSearchParams({ from: "2026-09-18", to: "2026-09-18", platform: "android", ratingGroup: "negative", keyword: JSON.stringify(selection) });
      const expected = full.filter(row => row.platform === "android" && row.rating <= 2 && matchesKeyword(row, selection));
      const result = (await getReviewPage("kis", parseReviewQuery(params)))!;
      expect(result.pagination.total).toBe(expected.length);
      expect(result.data.map(row => row.id)).toEqual(expected.slice(0, 10).map(row => row.id));
    }
    expect(await getReviewPage("missing", query("period=all"))).toBeNull();
  });

  it("filters legacy general opinions by their refined reaction", async () => {
    await getDb().insert(schema.reviews).values({
      appId,
      platform: "android",
      externalId: "legacy-thanks",
      rating: 5,
      content: "감사합니다",
      reviewedAt: new Date("2026-09-18T12:00:00Z"),
      aiTopicPaths: [{ major: "기타", middle: "일반", minor: "일반 의견" }],
    });
    const selection = { label: "감사", key: '["기타","사용자 반응","감사"]', level: "minor" as const, grade: "positive" as const };
    const params = new URLSearchParams({
      from: "2026-09-18",
      to: "2026-09-18",
      platform: "android",
      ratingGroup: "positive",
      keyword: JSON.stringify(selection),
    });

    const result = (await getReviewPage("kis", parseReviewQuery(params)))!;
    expect(result.pagination.total).toBe(1);
    expect(result.data[0]).toMatchObject({ content: "감사합니다" });
    expect(result.data[0].aiTopicPaths).toEqual([{ major: "기타", middle: "사용자 반응", minor: "감사" }]);
  });
});
