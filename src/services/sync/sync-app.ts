import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { apps, syncRuns } from "@/db/schema";
import {
  pruneNonProductionAndroidReleases,
  upsertAndroidDistribution,
  upsertDailyMetrics,
  replaceDeviceDailyRecords,
  upsertMetricObservations,
  upsertRatingSnapshots,
  upsertReleases,
  upsertReviews,
} from "@/db/upsert";
import { logger } from "@/lib/logger";
import { GooglePlayAdapter } from "@/services/google/adapter";
import { AppStoreAdapter } from "@/services/apple/adapter";
import { Ga4Adapter } from "@/services/mobile/adapter";
import type {
  StoreAdapter,
  StoreSyncPayload,
  StoreSyncType,
  SyncScope,
} from "@/services/mobile/common/store-adapter";
import { publicSyncError } from "@/services/sync/sync-errors";
import { fetchGa4SyncData } from "@/services/sync/ga4-sync";
import { toReviewInsertValue } from "@/services/sync/review-sync";
import { analyzeReviewsBatch } from "@/services/ai/review-analyzer.service";

const adapters: StoreAdapter[] = [new GooglePlayAdapter(), new AppStoreAdapter()];
const ga4Adapter = new Ga4Adapter();

function recordsForType(payload: StoreSyncPayload, syncType: StoreSyncType): number {
  if (syncType === "downloads") {
    return payload.metrics.filter((metric) => metric.downloads !== null).length;
  }
  if (syncType === "installs") {
    return payload.metrics.filter(
      (metric) => metric.installs != null || metric.uninstalls != null,
    ).length;
  }
  if (syncType === "ratings") {
    return payload.metrics.filter((metric) => metric.rating !== null).length;
  }
  if (syncType === "reviews") return payload.reviews.length;
  if (syncType === "stability") {
    return (payload.observations ?? []).filter((item) =>
      item.metricKey === "user_perceived_crash_rate_28d" ||
      item.metricKey === "user_perceived_anr_rate_28d"
    ).length;
  }
  if (syncType === "distribution") return payload.androidDistribution ? 1 : 0;
  return payload.releases.length;
}

async function recordTypeRuns({
  appId,
  adapter,
  payload,
  failedMessage,
  startedAt,
}: {
  appId: string;
  adapter: StoreAdapter;
  payload?: StoreSyncPayload;
  failedMessage?: string;
  startedAt: Date;
}) {
  const db = getDb();
  const finishedAt = new Date();
  await db.insert(syncRuns).values(
    adapter.syncTypes.map((syncType) => {
      const typeError =
        failedMessage ?? payload?.errors.find((error) => error.startsWith(`${syncType}:`));
      return {
        appId,
        platform: adapter.platform,
        syncType,
        status: typeError ? ("failed" as const) : ("success" as const),
        startedAt,
        finishedAt,
        recordsCount: payload ? recordsForType(payload, syncType) : 0,
        errorMessage: publicSyncError(typeError ?? null),
      };
    }),
  );
}

export async function syncAllApps(scope: SyncScope = "all", appId?: string) {
  const db = getDb();
  const activeApps = await db.select().from(apps).where(
    and(eq(apps.isActive, true), appId ? eq(apps.id, appId) : undefined),
  );
  const results = [];
  const syncTypesToRun: readonly StoreSyncType[] | undefined =
    scope === "voc"
      ? (["reviews", "ratings", "releases"] as const)
      : undefined;

  for (const app of activeApps) {
    const appInfo = {
      id: app.id,
      code: app.code,
      name: app.name,
      androidPackageName: app.androidPackageName,
      iosAppId: app.iosAppId,
      iosBundleId: app.iosBundleId,
    };
    const analyticsErrors: string[] = [];
    if (scope === "all") {
      const analytics = await fetchGa4SyncData(ga4Adapter, appInfo);
      analyticsErrors.push(...analytics.errors);
      try {
        if (analytics.metrics.length) {
          await upsertDailyMetrics(db, analytics.metrics);
        }
      } catch (error) {
        analyticsErrors.push(
          `analytics_summary: ${error instanceof Error ? error.message : "Unknown GA4 persistence error"}`,
        );
      }
      if (analytics.devices?.configured) {
        try {
          await replaceDeviceDailyRecords(
            db,
            app.id,
            analytics.devices.startDate,
            analytics.devices.endDate,
            ["android", "ios"],
            analytics.devices.records,
          );
        } catch (error) {
          analyticsErrors.push(
            `analytics_devices: ${error instanceof Error ? error.message : "Unknown device persistence error"}`,
          );
        }
      }
      const analyticsRecords =
        analytics.metrics.length + (analytics.devices?.records.length ?? 0);
      if (analyticsErrors.length) {
        logger.error("ga4_sync_failed", {
          app: app.code,
          records: analyticsRecords,
          error: analyticsErrors.join(" | "),
        });
      } else {
        logger.info("ga4_sync_finished", {
          app: app.code,
          records: analyticsRecords,
        });
      }
      results.push({
        app: app.code,
        platform: "analytics",
        status: analyticsErrors.length ? "failed" : "success",
        recordsCount: analyticsRecords,
      });
    }

    for (const adapter of adapters) {
      const startedAt = new Date();
      const targetSyncTypes = syncTypesToRun ?? adapter.syncTypes;
      const [run] = await db
        .insert(syncRuns)
        .values({
          appId: app.id,
          platform: adapter.platform,
          syncType: scope === "all" ? "all" : "reviews",
          status: "running",
        })
        .returning({ id: syncRuns.id });
      logger.info("sync_started", {
        app: app.code,
        platform: adapter.platform,
        scope,
      });

      try {
        const payload = await adapter.sync(appInfo, targetSyncTypes);
        if (payload.metrics.length) {
          await upsertDailyMetrics(db, payload.metrics);
        }
        if (payload.observations?.length) {
          await upsertMetricObservations(
            db,
            payload.observations.map((item) => ({
              ...item,
              observedAt: new Date(item.observedAt),
            })),
          );
        }
        if (payload.ratingSnapshots?.length) {
          await upsertRatingSnapshots(
            db,
            payload.ratingSnapshots.map((item) => ({
              ...item,
              observedAt: new Date(item.observedAt),
            })),
          );
        }
        if (payload.androidDistribution) {
          await upsertAndroidDistribution(db, {
            ...payload.androidDistribution,
            observedAt: new Date(payload.androidDistribution.observedAt),
          });
        }
        if (payload.reviews.length) {
          const analysisMap = await analyzeReviewsBatch(payload.reviews);
          await upsertReviews(
            db,
            payload.reviews.map((review) => {
              const analyzed = analysisMap.get(review.externalId);
              return toReviewInsertValue(review, analyzed);
            }),
          );
        }
        if (payload.releases.length) {
          await upsertReleases(
            db,
            payload.releases.map((release) => ({
              appId: release.appId,
              platform: release.platform,
              version: release.version,
              releasedAt: new Date(release.releasedAt),
              releaseDateSource: release.releaseDateSource,
              releaseDateEstimated: release.releaseDateEstimated,
              status: release.status,
              track: release.track,
              buildNumber: release.buildNumber,
              releaseNotes: release.releaseNotes,
              rolloutFraction: release.rolloutFraction,
              phasedReleaseState: release.phasedReleaseState,
              phasedReleaseDay: release.phasedReleaseDay,
            })),
          );
        }
        if (adapter.platform === "android" && targetSyncTypes.includes("releases")) {
          await pruneNonProductionAndroidReleases(db, app.id);
        }

        const recordsCount =
          payload.metrics.length +
          payload.reviews.length +
          payload.releases.length +
          (payload.observations?.length ?? 0) +
          (payload.ratingSnapshots?.length ?? 0);
        const totalRecordsCount = recordsCount + (payload.androidDistribution ? 1 : 0);
        const status = payload.errors.length ? "partial" : "success";
        await db
          .update(syncRuns)
          .set({
            status,
            finishedAt: new Date(),
            recordsCount: totalRecordsCount,
            errorMessage: publicSyncError(payload.errors.join(" | ") || null),
          })
          .where(eq(syncRuns.id, run.id));
        await recordTypeRuns({ appId: app.id, adapter, payload, startedAt });
        logger.info("sync_finished", {
          app: app.code,
          platform: adapter.platform,
          status,
          records: totalRecordsCount,
          durationMs: Date.now() - startedAt.getTime(),
        });
        results.push({ app: app.code, platform: adapter.platform, status, recordsCount: totalRecordsCount });
      } catch (error) {
        const message = publicSyncError(
          error instanceof Error ? error.message : "Unknown sync error",
        )!;
        await db
          .update(syncRuns)
          .set({ status: "failed", finishedAt: new Date(), errorMessage: message })
          .where(eq(syncRuns.id, run.id));
        await recordTypeRuns({ appId: app.id, adapter, failedMessage: message, startedAt });
        logger.error("sync_failed", {
          app: app.code,
          platform: adapter.platform,
          durationMs: Date.now() - startedAt.getTime(),
          error: message,
        });
        results.push({ app: app.code, platform: adapter.platform, status: "failed", recordsCount: 0 });
      }
    }
  }

  return results;
}
