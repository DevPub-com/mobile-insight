import type {CrashlyticsConfig} from "@/services/firebase/crashlytics";

type StoreCredentialProfile = {
  crashlytics?: CrashlyticsConfig;
  google?: {
    serviceAccountJsonEnv: string;
    bucketNameEnv: string;
  };
  apple?: {
    issuerIdEnv: string;
    keyIdEnv: string;
    privateKeyEnv: string;
    vendorNumberEnv: string;
  };
  googleAnalytics?: {
    propertyIdEnv: string;
    serviceAccountJsonEnv: string;
  };
};

const profiles: Record<string, StoreCredentialProfile> = {
  kis: {
    crashlytics: {
      projectId: "mts-renewal", dataset: "firebase_crashlytics", location: "asia-northeast3",
      serviceAccountJsonEnv: "GOOGLE_KIS_SERVICE_ACCOUNT_JSON",
      tables: {android: "com_truefriend_neosmartarenewal_ANDROID_REALTIME", ios: "com_truefriend_neosmartirenewal_IOS_REALTIME"},
    },
    google: {
      serviceAccountJsonEnv: "GOOGLE_KIS_SERVICE_ACCOUNT_JSON",
      bucketNameEnv: "GOOGLE_KIS_BUCKET_NAME",
    },
    apple: {
      issuerIdEnv: "APPLE_KIS_ISSUER_ID",
      keyIdEnv: "APPLE_KIS_KEY_ID",
      privateKeyEnv: "APPLE_KIS_PRIVATE_KEY",
      vendorNumberEnv: "APPLE_KIS_VENDOR_NUMBER",
    },
    googleAnalytics: {
      propertyIdEnv: "GA4_KIS_PROPERTY_ID",
      serviceAccountJsonEnv: "GOOGLE_KIS_SERVICE_ACCOUNT_JSON",
    },
  },
};

export function getStoreCredentialProfile(appCode: string): StoreCredentialProfile | null {
  return profiles[appCode] ?? null;
}
