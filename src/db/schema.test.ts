import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableName } from "drizzle-orm";

import {
  apps,
  dailyMetrics,
  releases,
  reviews,
  syncRuns,
} from "./schema";
import * as schema from "./schema";

describe("table naming policy", () => {
  it("uses predictable snake_case names for each table", () => {
    const tables = schema as unknown as Record<string, Parameters<typeof getTableName>[0]>;
    const expectedNames = {
      apps: "app_master",
      dailyMetrics: "overview_daily_summary",
      metricObservations: "usage_daily_records",
      ratingSnapshots: "rating_daily_records",
      reviews: "review_records",
      releases: "release_summary",
      syncRuns: "sync_runs",
      appVersionDailyRecords: "app_version_daily_records",
      osVersionDailyRecords: "os_version_daily_records",
      deviceDailyRecords: "device_daily_records",
    } as const;

    for (const [exportName, tableName] of Object.entries(expectedNames)) {
      expect(tables[exportName], `${exportName} export`).toBeDefined();
      expect(getTableName(tables[exportName])).toBe(tableName);
    }
  });

  it("does not expose removed region or release-observation tables", () => {
    expect(schema).not.toHaveProperty("regionalMetrics");
    expect(schema).not.toHaveProperty("regionDailyRecords");
    expect(schema).not.toHaveProperty("releaseObservations");
  });
});

describe("timestamp schema precision", () => {
  it("stores every timestamp with second precision and timezone", () => {
    const timestampColumns = [
      apps.createdAt,
      apps.updatedAt,
      dailyMetrics.createdAt,
      dailyMetrics.updatedAt,
      reviews.reviewedAt,
      reviews.createdAt,
      reviews.updatedAt,
      releases.releasedAt,
      releases.createdAt,
      releases.updatedAt,
      syncRuns.startedAt,
      syncRuns.finishedAt,
      syncRuns.createdAt,
    ];

    expect(timestampColumns.map((column) => column.getSQLType())).toEqual(
      timestampColumns.map(() => "timestamp (0) with time zone"),
    );
  });

  it("stores release date provenance", () => {
    expect(releases.releaseDateSource.name).toBe("release_date_source");
    expect(releases.releaseDateEstimated.name).toBe("release_date_estimated");
  });

  it("stores platform-native build identifier", () => {
    expect(releases.buildNumber.name).toBe("build_number");
  });

  it("defines additive provenance and snapshot tables", () => {
    const tables = schema as unknown as Record<string, Record<string, { name?: string }>>;

    expect(tables.dailyMetrics.newUsers.name).toBe("new_users");
    expect(tables.dailyMetrics.engagedSessions.name).toBe("engaged_sessions");
    expect(tables.dailyMetrics.averageSessionDuration.name).toBe("average_session_duration");
    expect(tables.dailyMetrics.screenPageViews.name).toBe("screen_page_views");
    expect(tables.metricObservations.metricKey.name).toBe("metric_key");
    expect(tables.metricObservations.quality.name).toBe("quality");
    expect(tables.metricObservations.source.name).toBe("source");
    expect(tables.metricObservations.observedAt.name).toBe("observed_at");
    expect(tables.reviews.territory.name).toBe("territory");
    expect(tables.reviews.device.name).toBe("device");
    expect(tables.reviews.deviceMetadata.name).toBe("device_metadata");
    expect(tables.reviews.androidOsVersion.name).toBe("android_os_version");
    expect(tables.reviews.appVersionCode.name).toBe("app_version_code");
    expect(tables.reviews.reviewerLanguage.name).toBe("reviewer_language");
    expect(tables.reviews.thumbsUpCount.name).toBe("thumbs_up_count");
    expect(tables.reviews.thumbsDownCount.name).toBe("thumbs_down_count");
    expect(tables.reviews.source.name).toBe("source");
    expect(tables.reviews.quality.name).toBe("quality");
    expect(tables.reviews.observedAt.name).toBe("observed_at");
  });
});

describe("migration manifest", () => {
  it("contains the plain table-name migration", () => {
    const migrationsDir = resolve(process.cwd(), "drizzle");

    expect(
      readdirSync(migrationsDir).some(
        (name) => name === "0012_plain_table_names.sql",
      ),
    ).toBe(true);
  });

  it("registers every SQL migration in the Drizzle journal", () => {
    const migrationsDir = resolve(process.cwd(), "drizzle");
    const sqlTags = readdirSync(migrationsDir)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .map((name) => name.replace(/\.sql$/, ""))
      .sort();
    const journal = JSON.parse(
      readFileSync(resolve(migrationsDir, "meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> };

    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(sqlTags);
  });
});
