type StoreCredentialProfile = {
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
