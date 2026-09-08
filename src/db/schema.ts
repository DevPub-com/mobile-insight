import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { DeviceMetadata } from "@/domain/types";

export const platformEnum = pgEnum("platform", ["android", "ios"]);
export const syncTypeEnum = pgEnum("sync_type", [
  "downloads",
  "installs",
  "ratings",
  "reviews",
  "releases",
  "stability",
  "distribution",
  "all",
]);
export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "success",
  "failed",
  "partial",
]);
export const metricQualityEnum = pgEnum("metric_quality", [
  "exact",
  "estimated",
  "derived",
  "unavailable",
]);
export const metricSourceEnum = pgEnum("metric_source", [
  "google_play_gcs",
  "google_play_api",
  "google_play_manual_csv",
  "app_store_analytics",
  "app_store_sales",
  "app_store_reviews",
  "firebase",
  "manual",
  "mobile_insight",
]);

const timestampConfig = { withTimezone: true, precision: 0 } as const;

const timestamps = {
  createdAt: timestamp("created_at", timestampConfig).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", timestampConfig).defaultNow().notNull(),
};

export const apps = pgTable(
  "app_master",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    androidPackageName: text("android_package_name"),
    iosAppId: text("ios_app_id"),
    iosBundleId: text("ios_bundle_id"),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("app_master_code_uidx").on(table.code)],
);

export const dailyMetrics = pgTable(
  "overview_daily_summary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    downloads: integer("downloads"),
    installs: integer("installs"),
    uninstalls: integer("uninstalls"),
    crashes: integer("crashes"),
    anrs: integer("anrs"),
    rating: doublePrecision("rating"),
    ratingCount: integer("rating_count"),
    reviewCount: integer("review_count"),
    active1DayUsers: integer("active_1d_users"),
    active7DayUsers: integer("active_7d_users"),
    active28DayUsers: integer("active_28d_users"),
    sessions: integer("sessions"),
    newUsers: integer("new_users"),
    engagedSessions: integer("engaged_sessions"),
    averageSessionDuration: doublePrecision("average_session_duration"),
    screenPageViews: integer("screen_page_views"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("overview_daily_summary_app_platform_date_uidx").on(
      table.appId,
      table.platform,
      table.date,
    ),
    index("overview_daily_summary_app_date_idx").on(table.appId, table.date),
    index("overview_daily_summary_app_platform_date_idx").on(
      table.appId,
      table.platform,
      table.date,
    ),
  ],
);

export const metricObservations = pgTable(
  "usage_daily_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    metricKey: text("metric_key").notNull(),
    value: doublePrecision("value"),
    source: metricSourceEnum("source").notNull(),
    quality: metricQualityEnum("quality").notNull(),
    observedAt: timestamp("observed_at", timestampConfig).notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("usage_daily_records_identity_uidx").on(
      table.appId,
      table.platform,
      table.date,
      table.metricKey,
      table.source,
    ),
    index("usage_daily_records_app_date_idx").on(table.appId, table.date),
  ],
);

export const ratingSnapshots = pgTable(
  "rating_daily_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    territory: text("territory").default("GLOBAL").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    averageRating: doublePrecision("average_rating").notNull(),
    ratingCount: integer("rating_count"),
    source: metricSourceEnum("source").notNull(),
    quality: metricQualityEnum("quality").notNull(),
    observedAt: timestamp("observed_at", timestampConfig).notNull(),
    description: text("description"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rating_daily_records_identity_uidx").on(
      table.appId,
      table.platform,
      table.territory,
      table.date,
      table.source,
    ),
    index("rating_daily_records_app_date_idx").on(table.appId, table.date),
  ],
);

export const reviews = pgTable(
  "review_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    author: text("author"),
    version: text("version"),
    territory: text("territory"),
    device: text("device"),
    deviceMetadata: jsonb("device_metadata").$type<DeviceMetadata>(),
    androidOsVersion: integer("android_os_version"),
    appVersionCode: integer("app_version_code"),
    reviewerLanguage: text("reviewer_language"),
    thumbsUpCount: integer("thumbs_up_count"),
    thumbsDownCount: integer("thumbs_down_count"),
    source: metricSourceEnum("source").default("mobile_insight").notNull(),
    quality: metricQualityEnum("quality").default("unavailable").notNull(),
    observedAt: timestamp("observed_at", timestampConfig).defaultNow().notNull(),
    description: text("description"),
    reviewedAt: timestamp("reviewed_at", timestampConfig).notNull(),
    aiSentiment: text("ai_sentiment"),
    aiTopics: jsonb("ai_topics").$type<string[]>(),
    aiSummary: text("ai_summary"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("review_records_app_platform_external_uidx").on(
      table.appId,
      table.platform,
      table.externalId,
    ),
    index("review_records_app_reviewed_at_idx").on(table.appId, table.reviewedAt),
  ],
);

export const releases = pgTable(
  "release_summary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    version: text("version").notNull(),
    releasedAt: timestamp("released_at", timestampConfig).notNull(),
    releaseDateSource: text("release_date_source")
      .default("store_release_date")
      .notNull(),
    releaseDateEstimated: boolean("release_date_estimated").default(false).notNull(),
    status: text("status"),
    track: text("track"),
    buildNumber: text("build_number"),
    releaseNotes: text("release_notes"),
    rolloutFraction: doublePrecision("rollout_fraction"),
    phasedReleaseState: text("phased_release_state"),
    phasedReleaseDay: integer("phased_release_day"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("release_summary_app_platform_version_uidx").on(
      table.appId,
      table.platform,
      table.version,
    ),
    index("release_summary_app_released_at_idx").on(table.appId, table.releasedAt),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    syncType: syncTypeEnum("sync_type").notNull(),
    status: syncStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", timestampConfig).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", timestampConfig),
    recordsCount: integer("records_count").default(0).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", timestampConfig).defaultNow().notNull(),
  },
  (table) => [index("sync_runs_app_started_at_idx").on(table.appId, table.startedAt)],
);

export const appVersionDailyRecords = pgTable(
  "app_version_daily_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    appVersion: text("app_version").notNull(),
    activeUsers: integer("active_users").default(0).notNull(),
    sessions: integer("sessions"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("app_version_daily_records_identity_uidx").on(
      table.appId,
      table.platform,
      table.date,
      table.appVersion,
    ),
    index("app_version_daily_records_app_date_idx").on(table.appId, table.date),
  ],
);

export const osVersionDailyRecords = pgTable(
  "os_version_daily_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    osVersion: text("os_version").notNull(),
    activeUsers: integer("active_users").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("os_version_daily_records_identity_uidx").on(
      table.appId,
      table.platform,
      table.date,
      table.osVersion,
    ),
    index("os_version_daily_records_app_date_idx").on(table.appId, table.date),
  ],
);

export const deviceDailyRecords = pgTable(
  "device_daily_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    deviceBrand: text("device_brand").notNull(),
    deviceModel: text("device_model").notNull(),
    activeUsers: integer("active_users").default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("device_daily_records_identity_uidx").on(
      table.appId,
      table.platform,
      table.date,
      table.deviceBrand,
      table.deviceModel,
    ),
    index("device_daily_records_app_date_idx").on(table.appId, table.date),
  ],
);

export const androidDistributionSnapshots = pgTable(
  "android_distribution_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    platform: platformEnum("platform").default("android").notNull(),
    countryCodes: jsonb("country_codes").$type<string[]>().default([]).notNull(),
    restOfWorld: boolean("rest_of_world").default(false).notNull(),
    deviceTypes: jsonb("device_types").$type<string[]>().default([]).notNull(),
    source: metricSourceEnum("source").notNull(),
    quality: metricQualityEnum("quality").notNull(),
    observedAt: timestamp("observed_at", timestampConfig).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("android_distribution_snapshots_app_platform_uidx").on(
      table.appId,
      table.platform,
    ),
  ],
);

export const aiInsightsCache = pgTable(
  "ai_insights_cache",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appId: uuid("app_id")
      .references(() => apps.id, { onDelete: "cascade" })
      .notNull(),
    insightType: text("insight_type").notNull(),
    cacheKey: text("cache_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("ai_insights_cache_app_type_key_uidx").on(
      table.appId,
      table.insightType,
      table.cacheKey,
    ),
    index("ai_insights_cache_app_type_idx").on(table.appId, table.insightType),
  ],
);
