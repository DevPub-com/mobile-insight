import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { apps, syncRuns } from "@/db/schema";
import {
  pruneNonProductionAndroidReleases,
  upsertDailyMetrics,
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

export async function syncAllApps(scope: SyncScope = "all") {
  const db = getDb();
  const activeApps = await db.select().from(apps).where(eq(apps.isActive, true));
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
    let analyticsError: string | null = null;
    if (scope === "all") {
      try {
        const analyticsMetrics = await ga4Adapter.fetch(appInfo);
        if (analyticsMetrics.length) {
          await upsertDailyMetrics(db, analyticsMetrics);
        }
        logger.info("ga4_sync_finished", {
          app: app.code,
          records: analyticsMetrics.length,
        });
      } catch (error) {
        analyticsError =
          error instanceof Error ? error.message : "Unknown GA4 sync error";
        logger.error("ga4_sync_failed", { app: app.code, error: analyticsError });
      }
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
        if (analyticsError) payload.errors.push(`analytics: ${analyticsError}`);
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
        if (payload.reviews.length) {
          await upsertReviews(
            db,
            payload.reviews.map((review) => ({
              appId: review.appId,
              platform: review.platform,
              externalId: review.externalId,
              rating: review.rating,
              title: review.title,
              content: review.content,
              author: review.author,
              version: review.version,
              territory: review.territory,
              source: review.source,
              quality: review.quality,
              observedAt: review.observedAt ? new Date(review.observedAt) : undefined,
              description: review.description,
              reviewedAt: new Date(review.reviewedAt),
            })),
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
        const status = payload.errors.length ? "partial" : "success";
        await db
          .update(syncRuns)
          .set({
            status,
            finishedAt: new Date(),
            recordsCount,
            errorMessage: publicSyncError(payload.errors.join(" | ") || null),
          })
          .where(eq(syncRuns.id, run.id));
        await recordTypeRuns({ appId: app.id, adapter, payload, startedAt });
        logger.info("sync_finished", {
          app: app.code,
          platform: adapter.platform,
          status,
          records: recordsCount,
          durationMs: Date.now() - startedAt.getTime(),
        });
        results.push({ app: app.code, platform: adapter.platform, status, recordsCount });
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
