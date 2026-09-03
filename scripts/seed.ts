import { demoApp, demoMetrics, demoReleases, demoReviews, demoSyncRuns } from "../src/data/demo";
import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { apps, syncRuns } from "../src/db/schema";
import { upsertDailyMetrics, upsertReleases, upsertReviews } from "../src/db/upsert";

loadScriptEnv();

const db = getDb();

const [app] = await db
  .insert(apps)
  .values({
    id: demoApp.id,
    code: demoApp.code,
    name: demoApp.name,
    androidPackageName: demoApp.androidPackageName,
    iosAppId: demoApp.iosAppId,
    iosBundleId: demoApp.iosBundleId,
  })
  .onConflictDoUpdate({
    target: apps.code,
    set: { name: demoApp.name, updatedAt: new Date() },
  })
  .returning({ id: apps.id });

await upsertDailyMetrics(db, demoMetrics.map((metric) => ({ ...metric, appId: app.id })));

await upsertReviews(
  db,
    demoReviews.map((review) => ({
      appId: app.id,
      platform: review.platform,
      externalId: review.externalId,
      rating: review.rating,
      title: review.title,
      content: review.content,
      author: review.author,
      version: review.version,
      reviewedAt: new Date(review.reviewedAt),
    })),
);

await upsertReleases(
  db,
    demoReleases.map((release) => ({
      appId: app.id,
      platform: release.platform,
      version: release.version,
      releasedAt: new Date(release.releasedAt),
    })),
);

await db.insert(syncRuns).values(
  demoSyncRuns.map((run) => ({
    ...run,
    appId: app.id,
    startedAt: new Date(run.startedAt),
    finishedAt: run.finishedAt ? new Date(run.finishedAt) : null,
  })),
);

console.info("Seeded Mobile Insight demo data for 한국투자.");
process.exit(0);
