import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or } from "drizzle-orm";

import type { DashboardData } from "@/domain/types";
import { modelMetricPrefix } from "@/domain/model-downloads";
import { publicSyncError } from "@/services/sync/sync-errors";

import { getDb } from "./index";
import {
  apps,
  androidDistributionSnapshots,
  dailyMetrics,
  metricObservations,
  ratingSnapshots,
  releases,
  reviews,
  syncRuns,
} from "./schema";

export async function getActiveApps() {
  const rows = await getDb().select().from(apps).where(eq(apps.isActive, true)).orderBy(asc(apps.name));
  return rows.map((app) => ({
    id: app.id,
    code: app.code,
    name: app.name,
    androidPackageName: app.androidPackageName,
    iosAppId: app.iosAppId,
    iosBundleId: app.iosBundleId,
  }));
}

export async function getDashboardData(appCode: string): Promise<DashboardData | null> {
  const db = getDb();
  const activeApps = await db.select().from(apps).where(eq(apps.isActive, true)).orderBy(asc(apps.name));
  const selected = activeApps.find((app) => app.code === appCode);
  if (!selected) return null;
  const observationCutoff = new Date();
  observationCutoff.setUTCDate(observationCutoff.getUTCDate() - 400);
  const observationCutoffDate = observationCutoff.toISOString().slice(0, 10);
  const reviewPageLimit = 5_001;

  const [
    metricRows,
    observationRows,
    snapshotRows,
    reviewRows,
    releaseVersionRows,
    releaseRows,
    syncRows,
    distributionRows,
  ] = await Promise.all([
    db
      .select()
      .from(dailyMetrics)
      .where(eq(dailyMetrics.appId, selected.id))
      .orderBy(asc(dailyMetrics.date)),
    db
      .select()
      .from(metricObservations)
      .where(
        and(
          eq(metricObservations.appId, selected.id),
          or(
            gte(metricObservations.date, observationCutoffDate),
            inArray(metricObservations.metricKey, ["daily_user_installs", "total_downloads", "google_play_rating"]),
          ),
        ),
      )
      .orderBy(asc(metricObservations.date)),
    db
      .select()
      .from(ratingSnapshots)
      .where(
        and(
          eq(ratingSnapshots.appId, selected.id),
          gte(ratingSnapshots.date, observationCutoffDate),
        ),
      )
      .orderBy(asc(ratingSnapshots.date)),
    db
      .select()
      .from(reviews)
      .where(eq(reviews.appId, selected.id))
      .orderBy(desc(reviews.reviewedAt))
      .limit(reviewPageLimit),
    db
      .select({
        appVersionCode: reviews.appVersionCode,
        version: reviews.version,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.appId, selected.id),
          eq(reviews.platform, "android"),
          isNotNull(reviews.appVersionCode),
          isNotNull(reviews.version),
        ),
      )
      .groupBy(reviews.appVersionCode, reviews.version),
    db
      .select()
      .from(releases)
      .where(eq(releases.appId, selected.id))
      .orderBy(desc(releases.releasedAt)),
    db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.appId, selected.id))
      .orderBy(desc(syncRuns.startedAt))
      .limit(20),
    db
      .select()
      .from(androidDistributionSnapshots)
      .where(
        and(
          eq(androidDistributionSnapshots.appId, selected.id),
          eq(androidDistributionSnapshots.platform, "android"),
        ),
      )
      .limit(1),
  ]);

  return {
    apps: activeApps.map((app) => ({
      id: app.id,
      code: app.code,
      name: app.name,
      androidPackageName: app.androidPackageName,
      iosAppId: app.iosAppId,
      iosBundleId: app.iosBundleId,
    })),
    app: {
      id: selected.id,
      code: selected.code,
      name: selected.name,
      androidPackageName: selected.androidPackageName,
      iosAppId: selected.iosAppId,
      iosBundleId: selected.iosBundleId,
    },
    metrics: metricRows.map((metric) => ({
      appId: metric.appId,
      platform: metric.platform,
      date: metric.date,
      downloads: metric.downloads,
      installs: metric.installs,
      uninstalls: metric.uninstalls,
      crashes: metric.crashes,
      anrs: metric.anrs,
      rating: metric.rating,
      ratingCount: metric.ratingCount,
      reviewCount: metric.reviewCount,
      active1DayUsers: metric.active1DayUsers,
      active7DayUsers: metric.active7DayUsers,
      active28DayUsers: metric.active28DayUsers,
      sessions: metric.sessions,
      newUsers: metric.newUsers,
      engagedSessions: metric.engagedSessions,
      averageSessionDuration: metric.averageSessionDuration,
      screenPageViews: metric.screenPageViews,
    })),
    reviews: reviewRows.slice(0, reviewPageLimit - 1).map((review) => ({
      id: review.id,
      appId: review.appId,
      platform: review.platform,
      externalId: review.externalId,
      rating: review.rating,
      title: review.title,
      content: review.content,
      author: review.author,
      version: review.version,
      territory: review.territory,
      device: review.device,
      deviceMetadata: review.deviceMetadata ?? null,
      source: review.source,
      quality: review.quality,
      observedAt: review.observedAt.toISOString(),
      description: review.description,
      reviewedAt: review.reviewedAt.toISOString(),
      aiSentiment:
        review.aiSentiment === "positive" ||
        review.aiSentiment === "neutral" ||
        review.aiSentiment === "negative"
          ? review.aiSentiment
          : null,
      aiTopics: review.aiTopics ?? null,
      aiSummary: review.aiSummary ?? null,
    })),
    reviewDataTruncated: reviewRows.length === reviewPageLimit,
    releaseVersionMappings: releaseVersionRows.flatMap((row) => {
      const version = row.version?.trim();
      return row.appVersionCode == null || !version
        ? []
        : [{ platform: "android" as const, appVersionCode: row.appVersionCode, version }];
    }),
    releases: releaseRows.map((release) => ({
      id: release.id,
      appId: release.appId,
      platform: release.platform,
      version: release.version,
      releasedAt: release.releasedAt.toISOString(),
      releaseDateSource: release.releaseDateSource as
        | "store_release_date"
        | "version_created_at"
        | "first_observed_at",
      releaseDateEstimated: release.releaseDateEstimated,
      status: release.status,
      track: release.track,
      buildNumber: release.buildNumber,
      releaseNotes: release.releaseNotes,
      rolloutFraction: release.rolloutFraction,
      phasedReleaseState: release.phasedReleaseState,
      phasedReleaseDay: release.phasedReleaseDay,
    })),
    modelDownloadObservations: observationRows.filter((item) => item.metricKey.startsWith(modelMetricPrefix)).map((item) => ({
      appId: item.appId, platform: item.platform, date: item.date,
      metricKey: item.metricKey, value: item.value, quality: item.quality,
    })),
    metricObservations: observationRows.filter((item) => !item.metricKey.startsWith(modelMetricPrefix)).map((item) => ({
      appId: item.appId,
      platform: item.platform,
      date: item.date,
      metricKey: item.metricKey,
      value: item.value,
      source: item.source,
      quality: item.quality,
      observedAt: item.observedAt.toISOString(),
      description: item.description,
    })),
    ratingSnapshots: snapshotRows.map((item) => ({
      appId: item.appId,
      platform: item.platform,
      territory: item.territory,
      date: item.date,
      averageRating: item.averageRating,
      ratingCount: item.ratingCount,
      source: item.source,
      quality: item.quality,
      observedAt: item.observedAt.toISOString(),
      description: item.description,
    })),
    syncRuns: syncRows.map((run) => ({
      platform: run.platform,
      status: run.status,
      syncType: run.syncType,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      recordsCount: run.recordsCount,
      errorMessage: publicSyncError(run.errorMessage),
    })),
    androidDistribution: distributionRows[0]
      ? {
          appId: distributionRows[0].appId,
          platform: "android",
          countryCodes: distributionRows[0].countryCodes,
          restOfWorld: distributionRows[0].restOfWorld,
          deviceTypes: distributionRows[0].deviceTypes as NonNullable<
            DashboardData["androidDistribution"]
          >["deviceTypes"],
          source: distributionRows[0].source,
          quality: distributionRows[0].quality,
          observedAt: distributionRows[0].observedAt.toISOString(),
        }
      : null,
    source: "database",
  };
}

export async function getMetricsForWindow(appId: string, from: string, to: string) {
  return getDb()
    .select()
    .from(dailyMetrics)
    .where(
      and(eq(dailyMetrics.appId, appId), gte(dailyMetrics.date, from), lte(dailyMetrics.date, to)),
    )
    .orderBy(asc(dailyMetrics.date));
}
