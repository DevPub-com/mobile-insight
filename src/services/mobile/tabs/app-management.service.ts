import type { AppInfo, DashboardData, SyncStatus } from "@/domain/types";

export type StoreConnectionSummary = {
  platform: "google_play" | "app_store";
  accountEmail: string | null;
  lastSyncedAt: string | null;
  connectedAppsCount: number;
};

export type AppSummaryRow = {
  app: AppInfo;
  latestVersion: string | null;
  hasAndroid: boolean;
  hasIos: boolean;
  lastSyncStatus: SyncStatus | null;
};

export function buildAppManagementSummary(data: DashboardData) {
  const activeApps = data.apps;
  const totalAppsCount = activeApps.length;
  const connectedStoresCount = [
    activeApps.some((app) => app.androidPackageName !== null),
    activeApps.some((app) => app.iosAppId !== null || app.iosBundleId !== null),
  ].filter(Boolean).length;

  const successfulSyncs = data.syncRuns.filter(
    (run) => run.status === "success",
  );
  const latestSyncRun = data.syncRuns
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .at(0);

  const healthyRatio =
    data.syncRuns.length > 0
      ? (successfulSyncs.length / data.syncRuns.length) * 100
      : 100;

  return {
    totalAppsCount,
    connectedStoresCount,
    latestSyncRun: latestSyncRun ?? null,
    healthyRatio: Number(healthyRatio.toFixed(1)),
  };
}
