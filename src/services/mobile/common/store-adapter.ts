import type {
  AppInfo,
  AndroidDistribution,
  AppRelease,
  AppReview,
  DailyMetric,
  MetricObservation,
  Platform,
  RatingSnapshot,
  SyncStatus,
} from "@/domain/types";

export type StoreSyncType = Exclude<SyncStatus["syncType"], "all">;
export type SyncScope = "all" | "voc" | "metrics";

export type StoreSyncPayload = {
  metrics: DailyMetric[];
  reviews: AppReview[];
  releases: AppRelease[];
  errors: string[];
  observations?: MetricObservation[];
  ratingSnapshots?: RatingSnapshot[];
  androidDistribution?: AndroidDistribution | null;
};

export interface StoreAdapter {
  readonly platform: Platform;
  readonly syncTypes: readonly StoreSyncType[];
  sync(
    app: AppInfo,
    syncTypes?: readonly StoreSyncType[],
  ): Promise<StoreSyncPayload>;
}

export interface BackfillStoreAdapter extends StoreAdapter {
  backfill(app: AppInfo): AsyncGenerator<StoreSyncPayload>;
}

export class StoreConfigurationError extends Error {
  constructor(platform: Platform, appCode: string) {
    super(`${platform} credentials are not configured for app '${appCode}'.`);
    this.name = "StoreConfigurationError";
  }
}
