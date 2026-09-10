import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "./schema";
import {
  aiInsightsCache,
  dailyMetrics,
  androidDistributionSnapshots,
  deviceDailyRecords,
  metricObservations,
  ratingSnapshots,
  releases,
  reviews,
} from "./schema";

export async function upsertAndroidDistribution<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  value: typeof androidDistributionSnapshots.$inferInsert,
) {
  await db
    .insert(androidDistributionSnapshots)
    .values(value)
    .onConflictDoUpdate({
      target: [
        androidDistributionSnapshots.appId,
        androidDistributionSnapshots.platform,
      ],
      set: {
        countryCodes: sql`excluded.country_codes`,
        restOfWorld: sql`excluded.rest_of_world`,
        deviceTypes: sql`excluded.device_types`,
        source: sql`excluded.source`,
        quality: sql`excluded.quality`,
        observedAt: sql`excluded.observed_at`,
        updatedAt: new Date(),
      },
    });
}

type Database<TQueryResult extends PgQueryResultHKT> = PgDatabase<
  TQueryResult,
  typeof schema
>;

export async function upsertDailyMetrics<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof dailyMetrics.$inferInsert>,
) {
  if (!values.length) return;
  await db
    .insert(dailyMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [dailyMetrics.appId, dailyMetrics.platform, dailyMetrics.date],
      set: {
        downloads: sql`coalesce(excluded.downloads, ${dailyMetrics.downloads})`,
        installs: sql`coalesce(excluded.installs, ${dailyMetrics.installs})`,
        uninstalls: sql`coalesce(excluded.uninstalls, ${dailyMetrics.uninstalls})`,
        crashes: sql`coalesce(excluded.crashes, ${dailyMetrics.crashes})`,
        anrs: sql`coalesce(excluded.anrs, ${dailyMetrics.anrs})`,
        rating: sql`coalesce(excluded.rating, ${dailyMetrics.rating})`,
        ratingCount: sql`coalesce(excluded.rating_count, ${dailyMetrics.ratingCount})`,
        reviewCount: sql`coalesce(excluded.review_count, ${dailyMetrics.reviewCount})`,
        active1DayUsers: sql`coalesce(excluded.active_1d_users, ${dailyMetrics.active1DayUsers})`,
        active7DayUsers: sql`coalesce(excluded.active_7d_users, ${dailyMetrics.active7DayUsers})`,
        active28DayUsers: sql`coalesce(excluded.active_28d_users, ${dailyMetrics.active28DayUsers})`,
        sessions: sql`coalesce(excluded.sessions, ${dailyMetrics.sessions})`,
        newUsers: sql`coalesce(excluded.new_users, ${dailyMetrics.newUsers})`,
        engagedSessions: sql`coalesce(excluded.engaged_sessions, ${dailyMetrics.engagedSessions})`,
        averageSessionDuration: sql`coalesce(excluded.average_session_duration, ${dailyMetrics.averageSessionDuration})`,
        screenPageViews: sql`coalesce(excluded.screen_page_views, ${dailyMetrics.screenPageViews})`,
        updatedAt: new Date(),
      },
    });
}

export async function upsertDeviceDailyRecords<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  values: Array<typeof deviceDailyRecords.$inferInsert>,
) {
  if (!values.length) return;
  await db.insert(deviceDailyRecords).values(values).onConflictDoUpdate({
    target: [
      deviceDailyRecords.appId,
      deviceDailyRecords.platform,
      deviceDailyRecords.date,
      deviceDailyRecords.deviceBrand,
      deviceDailyRecords.deviceModel,
    ],
    set: {
      activeUsers: sql`excluded.active_users`,
      updatedAt: new Date(),
    },
  });
}

export async function replaceDeviceDailyRecords<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  appId: string,
  startDate: string,
  endDate: string,
  platforms: Array<"android" | "ios">,
  values: Array<typeof deviceDailyRecords.$inferInsert>,
) {
  if (!platforms.length) return;
  const invalidRecord = values.find((value) =>
    value.appId !== appId ||
    !platforms.includes(value.platform) ||
    value.date < startDate ||
    value.date > endDate
  );
  if (invalidRecord) {
    throw new Error("Device replacement contains a record outside its app, platform, or date scope.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(deviceDailyRecords).where(
      and(
        eq(deviceDailyRecords.appId, appId),
        inArray(deviceDailyRecords.platform, platforms),
        gte(deviceDailyRecords.date, startDate),
        lte(deviceDailyRecords.date, endDate),
      ),
    );
    for (let index = 0; index < values.length; index += 1_000) {
      await tx
        .insert(deviceDailyRecords)
        .values(values.slice(index, index + 1_000));
    }
  });
}

export async function upsertMetricObservations<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof metricObservations.$inferInsert>,
) {
  if (!values.length) return;
  // Device reports can contain tens of thousands of daily series.
  for (let offset = 0; offset < values.length; offset += 500) {
    await db.insert(metricObservations).values(values.slice(offset, offset + 500)).onConflictDoUpdate({
      target: [
        metricObservations.appId,
        metricObservations.platform,
        metricObservations.date,
        metricObservations.metricKey,
        metricObservations.source,
      ],
      set: {
        value: sql`excluded.value`,
        quality: sql`excluded.quality`,
        observedAt: sql`excluded.observed_at`,
        description: sql`excluded.description`,
        updatedAt: new Date(),
      },
    });
  }
}

export async function upsertRatingSnapshots<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof ratingSnapshots.$inferInsert>,
) {
  if (!values.length) return;
  await db.insert(ratingSnapshots).values(values).onConflictDoUpdate({
    target: [
      ratingSnapshots.appId,
      ratingSnapshots.platform,
      ratingSnapshots.territory,
      ratingSnapshots.date,
      ratingSnapshots.source,
    ],
    set: {
      averageRating: sql`excluded.average_rating`,
      ratingCount: sql`excluded.rating_count`,
      quality: sql`excluded.quality`,
      observedAt: sql`excluded.observed_at`,
      description: sql`excluded.description`,
      updatedAt: new Date(),
    },
  });
}

export async function upsertReviews<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof reviews.$inferInsert>,
) {
  if (!values.length) return;
  await db
    .insert(reviews)
    .values(values)
    .onConflictDoUpdate({
      target: [reviews.appId, reviews.platform, reviews.externalId],
      set: {
        rating: sql`excluded.rating`,
        title: sql`excluded.title`,
        content: sql`excluded.content`,
        author: sql`coalesce(excluded.author, ${reviews.author})`,
        version: sql`coalesce(excluded.version, ${reviews.version})`,
        territory: sql`coalesce(excluded.territory, ${reviews.territory})`,
        device: sql`coalesce(excluded.device, ${reviews.device})`,
        deviceMetadata: sql`coalesce(excluded.device_metadata, ${reviews.deviceMetadata})`,
        androidOsVersion: sql`coalesce(excluded.android_os_version, ${reviews.androidOsVersion})`,
        appVersionCode: sql`coalesce(excluded.app_version_code, ${reviews.appVersionCode})`,
        reviewerLanguage: sql`coalesce(excluded.reviewer_language, ${reviews.reviewerLanguage})`,
        thumbsUpCount: sql`coalesce(excluded.thumbs_up_count, ${reviews.thumbsUpCount})`,
        thumbsDownCount: sql`coalesce(excluded.thumbs_down_count, ${reviews.thumbsDownCount})`,
        source: sql`excluded.source`,
        quality: sql`excluded.quality`,
        observedAt: sql`excluded.observed_at`,
        description: sql`excluded.description`,
        reviewedAt: sql`excluded.reviewed_at`,
        aiSentiment: sql`coalesce(excluded.ai_sentiment, ${reviews.aiSentiment})`,
        aiTopics: sql`coalesce(excluded.ai_topics, ${reviews.aiTopics})`,
        aiSummary: sql`coalesce(excluded.ai_summary, ${reviews.aiSummary})`,
        updatedAt: new Date(),
      },
    });
}

export async function upsertAiInsightsCache<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof aiInsightsCache.$inferInsert>,
) {
  if (!values.length) return;
  await db
    .insert(aiInsightsCache)
    .values(values)
    .onConflictDoUpdate({
      target: [
        aiInsightsCache.appId,
        aiInsightsCache.insightType,
        aiInsightsCache.cacheKey,
      ],
      set: {
        payload: sql`excluded.payload`,
        updatedAt: new Date(),
      },
    });
}

export async function upsertReleases<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  values: Array<typeof releases.$inferInsert>,
) {
  if (!values.length) return;
  await db
    .insert(releases)
    .values(values)
    .onConflictDoUpdate({
      target: [releases.appId, releases.platform, releases.version],
      set: {
        releasedAt: sql`case
          when ${releases.releaseDateEstimated} = false and excluded.release_date_estimated = true
            then ${releases.releasedAt}
          when ${releases.releaseDateSource} = 'first_observed_at'
            and excluded.release_date_source = 'first_observed_at'
            then ${releases.releasedAt}
          else excluded.released_at
        end`,
        releaseDateSource: sql`case
          when ${releases.releaseDateEstimated} = false and excluded.release_date_estimated = true
            then ${releases.releaseDateSource}
          else excluded.release_date_source
        end`,
        releaseDateEstimated: sql`case
          when ${releases.releaseDateEstimated} = false and excluded.release_date_estimated = true
            then false
          else excluded.release_date_estimated
        end`,
        status: sql`coalesce(excluded.status, ${releases.status})`,
        track: sql`coalesce(excluded.track, ${releases.track})`,
        buildNumber: sql`coalesce(excluded.build_number, ${releases.buildNumber})`,
        releaseNotes: sql`coalesce(excluded.release_notes, ${releases.releaseNotes})`,
        rolloutFraction: sql`coalesce(excluded.rollout_fraction, ${releases.rolloutFraction})`,
        phasedReleaseState: sql`coalesce(excluded.phased_release_state, ${releases.phasedReleaseState})`,
        phasedReleaseDay: sql`coalesce(excluded.phased_release_day, ${releases.phasedReleaseDay})`,
        updatedAt: new Date(),
      },
    });
}

export async function pruneNonProductionAndroidReleases<
  TQueryResult extends PgQueryResultHKT,
>(db: Database<TQueryResult>, appId: string) {
  await db
    .delete(releases)
    .where(
      and(
        eq(releases.appId, appId),
        eq(releases.platform, "android"),
        sql`${releases.track} is distinct from 'production'`,
      ),
    );
}
