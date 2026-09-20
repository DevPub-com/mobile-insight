import { toAppReview } from "./review.repository";
import { joinedRows } from "./joined-rows";
import { and, asc, desc, eq, gte, inArray, isNotNull, like, lte, notLike, or, sql } from "drizzle-orm";

import type { DashboardData, Platform } from "@/domain/types";
import { displayReleaseVersion } from "@/services/mobile/common/release-version";
import { publicSyncError } from "@/services/sync/sync-errors";

import { getDb } from "./index";
import { apps, androidDistributionSnapshots, dailyMetrics, metricObservations, ratingSnapshots, releases, reviews, syncRuns } from "./schema";

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

export type DashboardReadProfile = "full" | "shell" | "summary" | "downloads" | "active-users" | "overview" | "release-impact" | "releases" | "sync-status";
const profileSections: Record<DashboardReadProfile, readonly string[]> = {
  full: ["metrics", "observations", "ratings", "reviews", "releases", "sync", "distribution"],
  shell: ["metrics", "observations", "ratings", "releases", "sync", "distribution"],
  summary: ["metrics", "observations", "ratings", "reviews", "releases", "sync"],
  downloads: ["metrics", "observations", "ratings", "reviews"],
  "active-users": ["metrics"],
  overview: ["metrics", "observations", "ratings", "reviews"],
  "release-impact": ["metrics", "observations", "reviews", "releases"],
  releases: ["releases"],
  "sync-status": ["sync"],
};
const releaseImpactObservationFilter = or(
  inArray(metricObservations.metricKey, [
    "daily_user_installs",
    "first_time_downloads",
    "user_perceived_crash_rate_28d",
    "user_perceived_anr_rate_28d",
  ]),
  like(metricObservations.metricKey, "crash_report_count:version:%"),
  like(metricObservations.metricKey, "crash_report_count:version_code:%"),
  like(metricObservations.metricKey, "anr_report_count:version:%"),
  like(metricObservations.metricKey, "anr_report_count:version_code:%"),
  like(metricObservations.metricKey, "crash_affected_users:version:%"),
  like(metricObservations.metricKey, "crash_affected_users:version_code:%"),
  like(metricObservations.metricKey, "anr_affected_users:version:%"),
  like(metricObservations.metricKey, "anr_affected_users:version_code:%"),
);

export async function getDashboardData(appCode: string, profile: DashboardReadProfile = "full"): Promise<DashboardData | null> {
  const db = getDb();
  const observationCutoff = new Date();
  observationCutoff.setUTCDate(observationCutoff.getUTCDate() - 400);
  const observationCutoffDate = observationCutoff.toISOString().slice(0, 10);
  const sections = new Set(profileSections[profile]);
  const active = joinedRows(apps, db.select().from(apps).where(eq(apps.isActive, true)).orderBy(asc(apps.name)), "active_apps");
  const metric = joinedRows(dailyMetrics, sections.has("metrics") ? db.select().from(dailyMetrics).where(eq(dailyMetrics.appId, apps.id)).orderBy(asc(dailyMetrics.date)) : undefined, "metric_rows");
  const observation = joinedRows(
    metricObservations,
    sections.has("observations")
      ? db
          .select()
          .from(metricObservations)
          .where(
            and(
              eq(metricObservations.appId, apps.id),
              notLike(metricObservations.metricKey, "device_downloads:%"),
              profile === "release-impact" ? releaseImpactObservationFilter : or(gte(metricObservations.date, observationCutoffDate), inArray(metricObservations.metricKey, ["daily_user_installs", "total_downloads", "google_play_rating"])),
            ),
          )
          .orderBy(asc(metricObservations.date))
      : undefined,
    "observation_rows",
  );
  const snapshot = joinedRows(
    ratingSnapshots,
    sections.has("ratings")
      ? db
          .select()
          .from(ratingSnapshots)
          .where(and(eq(ratingSnapshots.appId, apps.id), gte(ratingSnapshots.date, observationCutoffDate)))
          .orderBy(asc(ratingSnapshots.date))
      : undefined,
    "snapshot_rows",
  );
  const review = joinedRows(reviews, sections.has("reviews") ? db.select().from(reviews).where(eq(reviews.appId, apps.id)).orderBy(desc(reviews.reviewedAt), desc(reviews.id)) : undefined, "review_rows");
  const release = joinedRows(releases, sections.has("releases") ? db.select().from(releases).where(eq(releases.appId, apps.id)).orderBy(desc(releases.releasedAt)) : undefined, "release_rows");
  const sync = joinedRows(syncRuns, sections.has("sync") ? db.select().from(syncRuns).where(eq(syncRuns.appId, apps.id)).orderBy(desc(syncRuns.startedAt)).limit(20) : undefined, "sync_rows");
  const distribution = joinedRows(
    androidDistributionSnapshots,
    sections.has("distribution")
      ? db
          .select()
          .from(androidDistributionSnapshots)
          .where(and(eq(androidDistributionSnapshots.appId, apps.id), eq(androidDistributionSnapshots.platform, "android")))
          .limit(1)
      : undefined,
    "distribution_rows",
  );

  const [result] = await db
    .select({
      selected: apps,
      activeApps: active.rows,
      metricRows: metric.rows,
      observationRows: observation.rows,
      snapshotRows: snapshot.rows,
      reviewRows: review.rows,
      releaseRows: release.rows,
      syncRows: sync.rows,
      distributionRows: distribution.rows,
    })
    .from(apps)
    .leftJoinLateral(active, sql`true`)
    .leftJoinLateral(metric, sql`true`)
    .leftJoinLateral(observation, sql`true`)
    .leftJoinLateral(snapshot, sql`true`)
    .leftJoinLateral(review, sql`true`)
    .leftJoinLateral(release, sql`true`)
    .leftJoinLateral(sync, sql`true`)
    .leftJoinLateral(distribution, sql`true`)
    .where(and(eq(apps.code, appCode), eq(apps.isActive, true)));
  if (!result) return null;
  const { selected, activeApps, metricRows, observationRows, snapshotRows, reviewRows, releaseRows, syncRows, distributionRows } = result;

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
    reviews: reviewRows.map(toAppReview),
    reviewDataTruncated: false,
    reviewsDeferred: profile === "shell",
    releaseVersionMappings: releaseRows.flatMap((row) => {
      const version = row.version?.trim();
      const build = row.buildNumber?.trim() ?? "";
      const appVersionCode = Number(build);
      return row.platform !== "android" || !/^\d+$/.test(build) || !Number.isSafeInteger(appVersionCode) || !version ? [] : [{ platform: "android" as const, appVersionCode, version }];
    }),
    releases: releaseRows.map((release) => ({
      id: release.id,
      appId: release.appId,
      platform: release.platform,
      version: release.version,
      releasedAt: release.releasedAt.toISOString(),
      buildNumber: release.buildNumber,
      releaseNotes: release.releaseNotes,
    })),
    metricObservations: observationRows.map((item) => ({
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
      date: item.date,
      averageRating: item.averageRating,
      ratingCount: item.ratingCount,
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
          deviceTypes: distributionRows[0].deviceTypes as NonNullable<DashboardData["androidDistribution"]>["deviceTypes"],
          source: distributionRows[0].source,
          quality: distributionRows[0].quality,
          observedAt: distributionRows[0].observedAt.toISOString(),
        }
      : null,
    source: "database",
  };
}

function previousIsoDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

/** Read only the rows used by one release-impact workspace. */
export async function getReleaseImpactData(appCode: string, platform: Platform, version: string, releaseData?: DashboardData): Promise<DashboardData | null> {
  const base = releaseData ?? await getDashboardData(appCode, "releases");
  if (!base) return null;
  const release = base.releases.find((item) => item.platform === platform && item.version === version);
  if (!release) return base;

  const siblings = base.releases.filter((item) => item.appId === release.appId && item.platform === platform).sort((a, b) => a.releasedAt.localeCompare(b.releasedAt));
  const releasedAt = release.releasedAt.slice(0, 10);
  const displayedVersion = displayReleaseVersion(platform, version);
  const previous = siblings
    .filter((item) => item.releasedAt.slice(0, 10) < releasedAt && displayReleaseVersion(platform, item.version) !== displayedVersion)
    .at(-1);
  const next = siblings.find((item) => item.releasedAt.slice(0, 10) > releasedAt);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const from = previous?.releasedAt.slice(0, 10) ?? releasedAt;
  const to = next ? [previousIsoDate(next.releasedAt.slice(0, 10)), today].sort()[0] : today;
  if (to < from) return base;

  const db = getDb();
  const metricQuery = db.select().from(dailyMetrics).where(and(
      eq(dailyMetrics.appId, release.appId), eq(dailyMetrics.platform, platform),
      gte(dailyMetrics.date, from), lte(dailyMetrics.date, to),
    )).orderBy(asc(dailyMetrics.date));
  const observationQuery = db.select().from(metricObservations).where(and(
      eq(metricObservations.appId, release.appId), eq(metricObservations.platform, platform),
      gte(metricObservations.date, from), lte(metricObservations.date, to),
      releaseImpactObservationFilter,
    )).orderBy(asc(metricObservations.date));
  const reviewQuery = db.select().from(reviews).where(and(
      eq(reviews.appId, release.appId), eq(reviews.platform, platform),
      gte(reviews.reviewedAt, new Date(`${from}T00:00:00.000Z`)),
      lte(reviews.reviewedAt, new Date(`${to}T23:59:59.999Z`)), isNotNull(reviews.version),
    )).orderBy(desc(reviews.reviewedAt), desc(reviews.id));

  const loadRows = async () => {
    // Read-only benchmarks showed consistent iOS latency savings. Android's
    // larger observation payload increased JSON aggregation cost substantially.
    if (platform === "ios") {
      const metric = joinedRows(dailyMetrics, metricQuery, "impact_metrics");
      const observation = joinedRows(metricObservations, observationQuery, "impact_observations");
      const review = joinedRows(reviews, reviewQuery, "impact_reviews");
      const [result] = await db.select({ metricRows: metric.rows, observationRows: observation.rows, reviewRows: review.rows })
        .from(apps)
        .leftJoinLateral(metric, sql`true`)
        .leftJoinLateral(observation, sql`true`)
        .leftJoinLateral(review, sql`true`)
        .where(eq(apps.id, release.appId));
      return result ?? { metricRows: [], observationRows: [], reviewRows: [] };
    }
    const [metricRows, observationRows, reviewRows] = await Promise.all([metricQuery, observationQuery, reviewQuery]);
    return { metricRows, observationRows, reviewRows };
  };
  const { metricRows, observationRows, reviewRows } = await loadRows();

  return {
    ...base,
    metrics: metricRows.map((metric) => ({
      appId: metric.appId, platform: metric.platform, date: metric.date, downloads: metric.downloads,
      installs: metric.installs, uninstalls: metric.uninstalls, crashes: metric.crashes, anrs: metric.anrs,
      rating: metric.rating, ratingCount: metric.ratingCount, reviewCount: metric.reviewCount,
      active1DayUsers: metric.active1DayUsers, active7DayUsers: metric.active7DayUsers,
      active28DayUsers: metric.active28DayUsers, sessions: metric.sessions, newUsers: metric.newUsers,
      engagedSessions: metric.engagedSessions, averageSessionDuration: metric.averageSessionDuration,
      screenPageViews: metric.screenPageViews,
    })),
    reviews: reviewRows.map(toAppReview),
    reviewDataTruncated: false,
    reviewsDeferred: false,
    metricObservations: observationRows.map((item) => ({
      appId: item.appId, platform: item.platform, date: item.date, metricKey: item.metricKey,
      value: item.value, source: item.source, quality: item.quality,
      observedAt: item.observedAt.toISOString(), description: item.description,
    })),
  };
}

export async function getMetricsForWindow(appId: string, from: string, to: string) {
  return getDb()
    .select()
    .from(dailyMetrics)
    .where(and(eq(dailyMetrics.appId, appId), gte(dailyMetrics.date, from), lte(dailyMetrics.date, to)))
    .orderBy(asc(dailyMetrics.date));
}
