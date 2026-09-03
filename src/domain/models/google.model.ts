export type GoogleTrackRelease = {
  name?: string;
  versionCodes?: string[];
  status?: string;
  userFraction?: number;
  releaseNotes?: Array<{ language?: string; text?: string }>;
};

export type GoogleTrack = {
  track?: string;
  releases?: GoogleTrackRelease[];
};

export type GoogleReleaseSummary = {
  releaseName?: string;
  track?: string;
  activeArtifacts?: Array<{ versionCode?: number }>;
  releaseLifecycleState?: string;
};

export type GoogleReviewComment = {
  userComment?: {
    text?: string;
    starRating?: number;
    reviewerLanguage?: string;
    device?: string;
    androidOsVersion?: number;
    appVersionCode?: number;
    appVersionName?: string;
    thumbsUpCount?: number;
    thumbsDownCount?: number;
    deviceMetadata?: {
      productName?: string;
      manufacturer?: string;
      deviceClass?: string;
      screenWidthPx?: number;
      screenHeightPx?: number;
      nativePlatform?: string;
      screenDensityDpi?: number;
      glEsVersion?: number;
      cpuModel?: string;
      cpuMake?: string;
      ramMb?: number;
    };
    lastModified?: { seconds?: string; nanos?: number };
  };
  developerComment?: {
    text?: string;
    lastModified?: { seconds?: string; nanos?: number };
  };
};

export type GoogleReview = {
  reviewId?: string;
  authorName?: string;
  comments?: GoogleReviewComment[];
};

export type GoogleReviewResponse = {
  reviews?: GoogleReview[];
  tokenPagination?: { nextPageToken?: string };
};

export type GoogleInstallRow = Record<string, string>;

export type GoogleReviewCsvRow = Record<string, string>;
