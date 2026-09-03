import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { apps } from "@/db/schema";
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
  BackfillStoreAdapter,
  StoreSyncPayload,
} from "@/services/mobile/common/store-adapter";
import type { BackfillOptions } from "./backfill-options";

const adapters: BackfillStoreAdapter[] = [new GooglePlayAdapter(), new AppStoreAdapter()];
const ga4Adapter = new Ga4Adapter();

function* chunks<T>(items: T[], size = 500) {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

async function persistPayload(payload: StoreSyncPayload) {
  const db = getDb();
  for (const metrics of chunks(payload.metrics)) {
    await upsertDailyMetrics(db, metrics);
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
  const reviewValues = payload.reviews.map((review) => ({
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
  }));
  for (const reviews of chunks(reviewValues)) {
    await upsertReviews(db, reviews);
  }
  const releaseValues = payload.releases.map((release) => ({
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
  }));
  for (const releases of chunks(releaseValues)) {
    await upsertReleases(db, releases);
  }
  for (const appId of new Set(
    payload.releases
      .filter((release) => release.platform === "android")
      .map((release) => release.appId),
  )) {
    await pruneNonProductionAndroidReleases(db, appId);
  }
}

export type BackfillProgress = {
  app: string;
  platform: "android" | "ios";
  batches: number;
  records: number;
  done: boolean;
  error?: string;
};

export async function backfillAllApps(
  onProgress: (progress: BackfillProgress) => void = () => undefined,
  options: BackfillOptions = {},
) {
  const db = getDb();
  const activeApps = await db
    .select()
    .from(apps)
    .where(
      and(
        eq(apps.isActive, true),
        options.appCode ? eq(apps.code, options.appCode) : undefined,
      ),
    );
  const results: BackfillProgress[] = [];

  for (const app of activeApps) {
    const appInfo = {
      id: app.id,
      code: app.code,
      name: app.name,
      androidPackageName: app.androidPackageName,
      iosAppId: app.iosAppId,
      iosBundleId: app.iosBundleId,
    };
    try {
      const analyticsMetrics = await ga4Adapter.fetch(appInfo, 365);
      const filteredMetrics = analyticsMetrics.filter(
        (metric) => !options.platform || metric.platform === options.platform,
      );
      for (const metrics of chunks(filteredMetrics)) {
        await upsertDailyMetrics(db, metrics);
      }
      logger.info("ga4_backfill_finished", {
        app: app.code,
        records: filteredMetrics.length,
      });
    } catch (error) {
      logger.error("ga4_backfill_failed", {
        app: app.code,
        error:
          error instanceof Error ? error.message : "Unknown GA4 backfill error",
      });
    }

    for (const adapter of adapters.filter(
      (candidate) => !options.platform || candidate.platform === options.platform,
    )) {
      let batches = 0;
      let records = 0;
      try {
        for await (const payload of adapter.backfill(appInfo)) {
          await persistPayload(payload);
          batches += 1;
          records += payload.metrics.length + payload.reviews.length + payload.releases.length;
          onProgress({ app: app.code, platform: adapter.platform, batches, records, done: false });
        }
        const result = { app: app.code, platform: adapter.platform, batches, records, done: true };
        results.push(result);
        onProgress(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown backfill error";
        const result = {
          app: app.code,
          platform: adapter.platform,
          batches,
          records,
          done: true,
          error: message,
        };
        results.push(result);
        onProgress(result);
      }
    }
  }
  return results;
}
