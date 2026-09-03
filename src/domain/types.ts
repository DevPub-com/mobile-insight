export type Platform = "android" | "ios";
export type MetricQuality = "exact" | "estimated" | "derived" | "unavailable";
export type MetricSource =
  | "google_play_gcs"
  | "google_play_api"
  | "google_play_manual_csv"
  | "app_store_analytics"
  | "app_store_sales"
  | "app_store_reviews"
  | "firebase"
  | "manual"
  | "mobile_insight";

export type MetricObservation = {
  appId: string;
  platform: Platform;
  date: string;
  metricKey: string;
  value: number | null;
  source: MetricSource;
  quality: MetricQuality;
  observedAt: string;
  description?: string | null;
};

export type RatingSnapshot = {
  appId: string;
  platform: Platform;
  territory: string;
  date: string;
  averageRating: number;
  ratingCount: number | null;
  source: MetricSource;
  quality: MetricQuality;
  observedAt: string;
  description?: string | null;
};

export type AppInfo = {
  id: string;
  code: string;
  name: string;
  androidPackageName: string | null;
  iosAppId: string | null;
  iosBundleId: string | null;
};

export type DailyMetric = {
  appId: string;
  platform: Platform;
  date: string;
  downloads: number | null;
  installs?: number | null;
  uninstalls?: number | null;
  crashes?: number | null;
  anrs?: number | null;
  rating: number | null;
  ratingCount: number | null;
  reviewCount: number | null;
  active1DayUsers: number | null;
  active7DayUsers: number | null;
  active28DayUsers: number | null;
  sessions: number | null;
  newUsers?: number | null;
  engagedSessions?: number | null;
  averageSessionDuration?: number | null;
  screenPageViews?: number | null;
};

export type DeviceMetadata = {
  productName?: string | null;
  manufacturer?: string | null;
  deviceClass?: string | null;
  ramMb?: number | null;
  screenWidthPx?: number | null;
  screenHeightPx?: number | null;
  nativePlatform?: string | null;
  screenDensityDpi?: number | null;
  glEsVersion?: number | null;
  cpuModel?: string | null;
  cpuMake?: string | null;
};

export type AppReview = {
  id: string;
  appId: string;
  platform: Platform;
  externalId: string;
  rating: number;
  title: string | null;
  content: string;
  author: string | null;
  version: string | null;
  territory?: string | null;
  device?: string | null;
  deviceMetadata?: DeviceMetadata | null;
  androidOsVersion?: number | null;
  appVersionCode?: number | null;
  reviewerLanguage?: string | null;
  thumbsUpCount?: number | null;
  thumbsDownCount?: number | null;
  source?: MetricSource;
  quality?: MetricQuality;
  observedAt?: string;
  description?: string | null;
  reviewedAt: string;
};

export type AppRelease = {
  id: string;
  appId: string;
  platform: Platform;
  version: string;
  releasedAt: string;
  releaseDateSource?: "store_release_date" | "version_created_at" | "first_observed_at";
  releaseDateEstimated?: boolean;
  status?: string | null;
  track?: string | null;
  buildNumber?: string | null;
  releaseNotes?: string | null;
  rolloutFraction?: number | null;
  phasedReleaseState?: string | null;
  phasedReleaseDay?: number | null;
};

export type SyncStatus = {
  platform: Platform;
  status: "running" | "success" | "failed" | "partial";
  syncType: "downloads" | "installs" | "ratings" | "reviews" | "releases" | "all";
  startedAt: string;
  finishedAt: string | null;
  recordsCount: number;
  errorMessage: string | null;
};

export type DashboardData = {
  apps: AppInfo[];
  app: AppInfo;
  metrics: DailyMetric[];
  reviews: AppReview[];
  reviewDataTruncated?: boolean;
  releases: AppRelease[];
  metricObservations?: MetricObservation[];
  ratingSnapshots?: RatingSnapshot[];
  syncRuns: SyncStatus[];
  source: "database" | "demo";
};
