export type AppleCredentials = {
  issuerId: string;
  keyId: string;
  privateKey: string;
  vendorNumber: string;
};

export type AppleCustomerReview = {
  id: string;
  attributes: {
    rating: number;
    title?: string;
    body: string;
    reviewerNickname?: string;
    territory?: string;
    createdDate: string;
  };
};

export type AppleReviewResponse = {
  data: AppleCustomerReview[];
  links?: { next?: string };
};

export type AppleVersionResource = {
  id: string;
  attributes: {
    platform: string;
    versionString: string;
    earliestReleaseDate?: string | null;
    createdDate?: string | null;
    appStoreState?: string;
    releaseType?: string;
  };
  relationships?: {
    appStoreVersionLocalizations?: { data?: Array<{ id: string }> };
    appStoreVersionPhasedRelease?: { data?: { id: string } | null };
    build?: { data?: { id: string } | null };
  };
};

export type AppleIncludedResource = {
  type: string;
  id: string;
  attributes?: {
    locale?: string;
    whatsNew?: string | null;
    phasedReleaseState?: string;
    currentDayNumber?: number;
    startDate?: string;
    version?: string;
  };
};

export type AppleVersionResponse = {
  data: AppleVersionResource[];
  included?: AppleIncludedResource[];
  links?: { next?: string };
};

export type AppleVersions = {
  data: AppleVersionResource[];
  included: AppleIncludedResource[];
};

export type AppleRatingLookup = {
  averageUserRating?: number;
  userRatingCount?: number;
};

export type AppleLookupResponse = {
  resultCount: number;
  results: AppleRatingLookup[];
};

export type AppleSalesRow = Record<string, string>;

export type AppleAnalyticsRow = Record<string, string>;
