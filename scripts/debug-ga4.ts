import { JWT } from "google-auth-library";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getStoreCredentialProfile } from "../src/config/store-config";
import type {
  GoogleAnalyticsReportResponse,
  GoogleServiceAccountCredentials,
} from "../src/domain/models/ga4.model";
import { rollingDateRange } from "../src/lib/date";
import { getEnvironmentVariable } from "../src/lib/env";
import { normalizeGa4Report } from "../src/services/mobile/adapter/ga4.adapter";

loadScriptEnv();

const appCode = process.argv[2] || "wtc";
const profile = getStoreCredentialProfile(appCode)?.googleAnalytics;

if (!profile) {
  console.error(`GA4 profile not configured for app: ${appCode}`);
  process.exit(1);
}

const propertyId = getEnvironmentVariable(profile.propertyIdEnv)?.trim();
const rawCredentials = getEnvironmentVariable(
  profile.serviceAccountJsonEnv,
)?.trim();

if (!propertyId || !rawCredentials) {
  console.error(
    `Missing GA4 credentials: ${profile.propertyIdEnv}=${propertyId ? "SET" : "MISSING"}, ${profile.serviceAccountJsonEnv}=${rawCredentials ? "SET" : "MISSING"}`,
  );
  process.exit(1);
}

const credentials = JSON.parse(
  rawCredentials,
) as GoogleServiceAccountCredentials;
const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
});

const { startDate, endDate } = rollingDateRange(new Date(), 35);
const requestBody = {
  dateRanges: [{ startDate, endDate }],
  dimensions: [{ name: "date" }, { name: "platform" }],
  metrics: [
    { name: "active1DayUsers" },
    { name: "active7DayUsers" },
    { name: "active28DayUsers" },
    { name: "sessions" },
  ],
  limit: 10000,
};

console.info(`Requesting GA4 Data API for app '${appCode}'...`);
console.info(`Property ID: ${propertyId}`);
console.info(`Date Range: ${startDate} ~ ${endDate}`);

try {
  const response = await auth.request<GoogleAnalyticsReportResponse>({
    url: `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    method: "POST",
    data: requestBody,
  });

  console.info("\n========== RAW GA4 API RESPONSE ==========");
  console.info(JSON.stringify(response.data, null, 2));
  console.info("==========================================\n");

  const normalized = normalizeGa4Report("debug-app-id", response.data);
  console.info("========== NORMALIZED METRICS ==========");
  console.info(JSON.stringify(normalized, null, 2));
  console.info("========================================");
} catch (error) {
  console.error("Failed to query GA4 Data API:", error);
  process.exit(1);
}
