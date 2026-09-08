import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  apps,
  dailyMetrics,
  deviceDailyRecords,
  releases,
  reviews,
} from "./schema";
import * as schema from "./schema";
import {
  pruneNonProductionAndroidReleases,
  replaceDeviceDailyRecords,
  upsertDailyMetrics,
  upsertDeviceDailyRecords,
  upsertReleases,
  upsertReviews,
} from "./upsert";
import * as upserts from "./upsert";

const appId = "11111111-1111-4111-8111-111111111111";
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeEach(async () => {
  client = new PGlite();
  for (const name of [
    "0000_woozy_morlocks.sql",
    "0001_foamy_doctor_doom.sql",
    "0002_ga4_active_users.sql",
    "0003_magical_nightshade.sql",
    "0004_odd_cerebro.sql",
    "0005_certain_scarlet_witch.sql",
    "0006_awesome_the_spike.sql",
    "0007_data_quality_observations.sql",
    "0008_review_provenance.sql",
    "0009_review_device_metadata.sql",
    "0010_unify_release_build_number.sql",
    "0011_expanded_analytics_and_distributions.sql",
    "0012_plain_table_names.sql",
    "0013_android_reporting_and_distribution.sql",
    "0014_ai_review_insights_and_cache.sql",
  ]) {
    const migration = await readFile(new URL(`../../drizzle/${name}`, import.meta.url), "utf8");
    await client.exec(migration.replaceAll("--> statement-breakpoint", ""));
  }
  db = drizzle(client, { schema });
  await db.insert(apps).values({ id: appId, code: "kis", name: "한국투자" });
});

afterEach(async () => {
  await client.close();
});

describe("dashboard upserts", () => {
  it("updates device active users without duplicating the identity", async () => {
    const base = {
      appId,
      platform: "android" as const,
      date: "2026-09-07",
      deviceBrand: "Samsung",
      deviceModel: "SM-S928N",
    };

    await upsertDeviceDailyRecords(db, [{ ...base, activeUsers: 10 }]);
    await upsertDeviceDailyRecords(db, [{ ...base, activeUsers: 12 }]);

    expect(await db.select().from(deviceDailyRecords)).toEqual([
      expect.objectContaining({ ...base, activeUsers: 12 }),
    ]);
  });

  it("replaces a completed GA4 device date range without leaving stale rows", async () => {
    await upsertDeviceDailyRecords(db, [
      {
        appId,
        platform: "android",
        date: "2026-09-06",
        deviceBrand: "Old",
        deviceModel: "Removed",
        activeUsers: 5,
      },
      {
        appId,
        platform: "android",
        date: "2026-08-01",
        deviceBrand: "Keep",
        deviceModel: "Outside range",
        activeUsers: 2,
      },
    ]);

    await replaceDeviceDailyRecords(
      db,
      appId,
      "2026-09-01",
      "2026-09-07",
      ["android"],
      [{
        appId,
        platform: "android",
        date: "2026-09-06",
        deviceBrand: "Samsung",
        deviceModel: "SM-S928N",
        activeUsers: 12,
      }],
    );

    expect(
      (await db.select().from(deviceDailyRecords)).map((row) =>
        [row.date, row.deviceBrand, row.deviceModel, row.activeUsers]
      ),
    ).toEqual([
      ["2026-08-01", "Keep", "Outside range", 2],
      ["2026-09-06", "Samsung", "SM-S928N", 12],
    ]);
  });

  it("rolls back the range deletion when replacement insertion fails", async () => {
    const original = {
      appId,
      platform: "android" as const,
      date: "2026-09-06",
      deviceBrand: "Samsung",
      deviceModel: "SM-S928N",
      activeUsers: 5,
    };
    await upsertDeviceDailyRecords(db, [original]);

    await expect(
      replaceDeviceDailyRecords(
        db,
        appId,
        "2026-09-01",
        "2026-09-07",
        ["android"],
        [original, original],
      ),
    ).rejects.toThrow();

    expect(await db.select().from(deviceDailyRecords)).toEqual([
      expect.objectContaining(original),
    ]);
  });

  it("rejects replacement records outside the requested scope", async () => {
    await expect(
      replaceDeviceDailyRecords(
        db,
        appId,
        "2026-09-01",
        "2026-09-07",
        ["android"],
        [{
          appId,
          platform: "ios",
          date: "2026-09-06",
          deviceBrand: "Apple",
          deviceModel: "iPhone",
          activeUsers: 1,
        }],
      ),
    ).rejects.toThrow("outside its app, platform, or date scope");
  });

  it("migrates to the retained table set", async () => {
    const result = await client.query<{ table_name: string }>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
      order by table_name
    `);
    const tableNames = result.rows.map((row) => row.table_name);

    expect(tableNames).toEqual(expect.arrayContaining([
      "app_master",
      "overview_daily_summary",
      "usage_daily_records",
      "rating_daily_records",
      "review_records",
      "release_summary",
      "sync_runs",
      "app_version_daily_records",
      "os_version_daily_records",
      "device_daily_records",
    ]));
    expect(tableNames).not.toContain("regional_metrics");
    expect(tableNames).not.toContain("release_observations");
  });

  it("renames retained constraints with the new table names", async () => {
    const result = await client.query<{ constraint_name: string }>(`
      select constraint_name
      from information_schema.table_constraints
      where table_schema = 'public'
        and constraint_type in ('PRIMARY KEY', 'FOREIGN KEY')
      order by constraint_name
    `);
    const constraintNames = result.rows.map((row) => row.constraint_name);

    expect(constraintNames).toEqual(expect.arrayContaining([
      "app_master_pkey",
      "overview_daily_summary_pkey",
      "overview_daily_summary_app_id_app_master_id_fk",
      "usage_daily_records_app_id_app_master_id_fk",
      "rating_daily_records_app_id_app_master_id_fk",
      "review_records_app_id_app_master_id_fk",
      "release_summary_app_id_app_master_id_fk",
      "sync_runs_app_id_app_master_id_fk",
      "app_version_daily_records_app_id_app_master_id_fk",
      "os_version_daily_records_app_id_app_master_id_fk",
      "device_daily_records_app_id_app_master_id_fk",
    ]));
    expect(constraintNames.some((name) =>
      /(?:apps|daily_metrics|metric_observations|rating_snapshots|reviews|releases|app_version_metrics|os_version_metrics|device_metrics)/.test(name),
    )).toBe(false);
  });

  it("upserts metric provenance without duplicating the same source and date", async () => {
    const schemaTables = schema as unknown as Record<string, typeof dailyMetrics>;
    const functions = upserts as unknown as Record<
      string,
      (database: typeof db, values: unknown[]) => Promise<void>
    >;
    const base = {
      appId,
      platform: "android",
      date: "2026-08-31",
      metricKey: "downloads",
      source: "google_play_gcs",
      quality: "exact",
      observedAt: new Date("2026-09-01T01:00:00Z"),
    };

    await functions.upsertMetricObservations(db, [{ ...base, value: 100 }]);
    await functions.upsertMetricObservations(db, [
      { ...base, value: 120, observedAt: new Date("2026-09-01T02:00:00Z") },
    ]);

    const rows = await db.select().from(schemaTables.metricObservations);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 120, source: "google_play_gcs", quality: "exact" });
  });

  it("stores one overview rating snapshot per territory, date, and source", async () => {
    const schemaTables = schema as unknown as Record<string, typeof dailyMetrics>;
    const functions = upserts as unknown as Record<
      string,
      (database: typeof db, values: unknown[]) => Promise<void>
    >;
    const base = {
      appId,
      platform: "ios",
      territory: "KR",
      date: "2026-09-01",
      source: "app_store_reviews",
      quality: "exact",
      observedAt: new Date("2026-09-01T02:00:00Z"),
    };

    await functions.upsertRatingSnapshots(db, [{ ...base, averageRating: 4.1, ratingCount: 20 }]);
    await functions.upsertRatingSnapshots(db, [{ ...base, averageRating: 4.2, ratingCount: 23 }]);

    const rows = await db.select().from(schemaTables.ratingSnapshots);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ averageRating: 4.2, ratingCount: 23, territory: "KR" });
  });


  it("updates a daily metric instead of inserting a duplicate date", async () => {
    const base = {
      appId,
      platform: "android" as const,
      date: "2026-08-28",
      rating: 4.4,
      ratingCount: 20,
      reviewCount: 4,
    };

    await upsertDailyMetrics(db, [{ ...base, downloads: 120 }]);
    await upsertDailyMetrics(db, [{ ...base, downloads: 175 }]);

    const rows = await db.select().from(dailyMetrics).where(eq(dailyMetrics.appId, appId));
    expect(rows).toHaveLength(1);
    expect(rows[0].downloads).toBe(175);
  });

  it("preserves collected fields when a partial sync supplies null", async () => {
    const base = {
      appId,
      platform: "android" as const,
      date: "2026-08-28",
      ratingCount: 20,
      reviewCount: 4,
    };

    await upsertDailyMetrics(db, [{ ...base, downloads: 120, rating: 4.4 }]);
    await upsertDailyMetrics(db, [{ ...base, downloads: null, rating: 4.5 }]);

    const [row] = await db.select().from(dailyMetrics).where(eq(dailyMetrics.appId, appId));
    expect(row.downloads).toBe(120);
    expect(row.rating).toBe(4.5);
  });

  it("stores GA4 active metrics without overwriting store downloads", async () => {
    const base = {
      appId,
      platform: "android" as const,
      date: "2026-08-29",
      rating: null,
      ratingCount: null,
      reviewCount: null,
    };

    await upsertDailyMetrics(db, [{ ...base, downloads: 155 }]);
    await upsertDailyMetrics(db, [
      {
        ...base,
        downloads: null,
        active1DayUsers: 12,
        active7DayUsers: 41,
        active28DayUsers: 288,
        sessions: 35,
      },
    ]);

    const [row] = await db.select().from(dailyMetrics).where(eq(dailyMetrics.appId, appId));
    expect(row).toMatchObject({
      downloads: 155,
      active1DayUsers: 12,
      active7DayUsers: 41,
      active28DayUsers: 288,
      sessions: 35,
    });
  });

  it("stores install lifecycle metrics without overwriting them on partial sync", async () => {
    const base = {
      appId,
      platform: "android" as const,
      date: "2026-08-30",
      downloads: 120,
    };

    await upsertDailyMetrics(db, [{ ...base, installs: 150, uninstalls: 30 }]);
    await upsertDailyMetrics(db, [{ ...base, installs: null, uninstalls: null }]);

    const [row] = await db.select().from(dailyMetrics).where(eq(dailyMetrics.appId, appId));
    expect(row).toMatchObject({ installs: 150, uninstalls: 30 });
  });

  it("updates a review matched by app, platform, and external ID", async () => {
    const base = {
      appId,
      platform: "ios" as const,
      externalId: "apple-review-1",
      rating: 2,
      title: null,
      author: "사용자",
      version: "5.13.0",
      territory: "KOR",
      source: "app_store_reviews" as const,
      quality: "exact" as const,
      observedAt: new Date("2026-08-31T00:00:00.000Z"),
      reviewedAt: new Date("2026-08-28T01:00:00.000Z"),
    };

    await upsertReviews(db, [{ ...base, content: "느립니다." }]);
    await upsertReviews(db, [{ ...base, rating: 4, content: "수정됐습니다." }]);

    const rows = await db.select().from(reviews).where(eq(reviews.appId, appId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rating: 4,
      content: "수정됐습니다.",
      territory: "KOR",
      source: "app_store_reviews",
      quality: "exact",
    });
  });

  it("stores and preserves review device and OS metadata", async () => {
    const base = {
      appId,
      platform: "android" as const,
      externalId: "gp:review-dev-1",
      rating: 5,
      title: null,
      content: "빠릅니다.",
      author: "안드로이드유저",
      version: "6.1.0",
      device: "star2qltechn",
      deviceMetadata: {
        productName: "Galaxy S24 Ultra",
        manufacturer: "Samsung",
        deviceClass: "phone",
        ramMb: 12288,
      },
      androidOsVersion: 34,
      appVersionCode: 61042,
      reviewerLanguage: "ko",
      thumbsUpCount: 4,
      thumbsDownCount: 0,
      source: "google_play_api" as const,
      quality: "exact" as const,
      observedAt: new Date("2026-09-01T00:00:00.000Z"),
      reviewedAt: new Date("2026-09-01T00:00:00.000Z"),
    };

    await upsertReviews(db, [base]);
    await upsertReviews(db, [
      {
        ...base,
        rating: 4,
        content: "업데이트 후 수정",
        device: null,
        deviceMetadata: null,
      },
    ]);

    const [row] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.externalId, "gp:review-dev-1"));
    expect(row).toMatchObject({
      rating: 4,
      content: "업데이트 후 수정",
      device: "star2qltechn",
      deviceMetadata: {
        productName: "Galaxy S24 Ultra",
        manufacturer: "Samsung",
        deviceClass: "phone",
        ramMb: 12288,
      },
      androidOsVersion: 34,
      appVersionCode: 61042,
      reviewerLanguage: "ko",
    });
  });

  it("preserves the first observed release date across later syncs", async () => {
    const base = {
      appId,
      platform: "android" as const,
      version: "1.6.1",
      releaseDateSource: "first_observed_at",
      releaseDateEstimated: true,
    };
    await upsertReleases(db, [
      { ...base, releasedAt: new Date("2026-08-30T01:00:00.000Z") },
    ]);
    await upsertReleases(db, [
      { ...base, releasedAt: new Date("2026-08-31T01:00:00.000Z") },
    ]);

    const [row] = await db.select().from(releases);
    expect(row.releasedAt.toISOString()).toBe("2026-08-30T01:00:00.000Z");
  });

  it("persists store-native build identifier", async () => {
    await upsertReleases(db, [{
      appId,
      platform: "android",
      version: "1.6.1",
      releasedAt: new Date("2026-08-30T01:00:00.000Z"),
      buildNumber: "16100",
    }]);
    await upsertReleases(db, [{
      appId,
      platform: "ios",
      version: "1.6.1",
      releasedAt: new Date("2026-08-30T01:00:00.000Z"),
      buildNumber: "61042",
    }]);

    const rows = await db.select().from(releases);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ platform: "android", buildNumber: "16100" }),
      expect.objectContaining({ platform: "ios", buildNumber: "61042" }),
    ]));
  });

  it("removes stale non-production Android releases without touching iOS", async () => {
    const releasedAt = new Date("2026-08-30T01:00:00.000Z");
    await upsertReleases(db, [
      { appId, platform: "android", version: "1.0.0", track: "production", releasedAt },
      { appId, platform: "android", version: "1.1.0", track: "internal", releasedAt },
      { appId, platform: "android", version: "1.2.0", track: null, releasedAt },
      { appId, platform: "ios", version: "1.1.0", track: null, releasedAt },
    ]);

    await pruneNonProductionAndroidReleases(db, appId);

    const rows = await db.select().from(releases);
    expect(rows.map((row) => [row.platform, row.version, row.track])).toEqual([
      ["android", "1.0.0", "production"],
      ["ios", "1.1.0", null],
    ]);
  });

  it("upserts expanded engagement and usage metrics into the overview summary", async () => {
    await upsertDailyMetrics(db, [
      {
        appId,
        platform: "android",
        date: "2026-08-31",
        newUsers: 120,
        engagedSessions: 450,
        averageSessionDuration: 85.5,
        screenPageViews: 3200,
      },
    ]);
    const [row] = await db.select().from(dailyMetrics);
    expect(row).toMatchObject({
      newUsers: 120,
      engagedSessions: 450,
      averageSessionDuration: 85.5,
      screenPageViews: 3200,
    });
  });
});
