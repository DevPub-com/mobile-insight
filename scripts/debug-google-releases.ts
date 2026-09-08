import { JWT } from "google-auth-library";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getStoreCredentialProfile } from "../src/config/store-config";
import { getActiveApps } from "../src/db/dashboard.repository";
import type { GoogleServiceAccountCredentials } from "../src/domain/models/ga4.model";
import { getEnvironmentVariable } from "../src/lib/env";
import { fetchGoogleReleaseData } from "../src/services/google/google-releases";

loadScriptEnv();

const appCode = process.argv[2] || "kis";
let packageName = process.argv[3];

if (!packageName) {
  try {
    const apps = await getActiveApps();
    const app = apps.find((candidate) => candidate.code === appCode);
    if (app?.androidPackageName) {
      packageName = app.androidPackageName;
    }
  } catch {
    // Database connection fallback
  }
}

if (!packageName) {
  const defaultPackages: Record<string, string> = {
    kis: "com.koreainvestment.stock",
  };
  packageName = defaultPackages[appCode] || `com.example.${appCode}`;
}

const profile = getStoreCredentialProfile(appCode)?.google;
if (!profile) {
  console.error(`Google profile not configured for app: ${appCode}`);
  process.exit(1);
}

const rawCredentials = getEnvironmentVariable(profile.serviceAccountJsonEnv);
if (!rawCredentials) {
  console.error(`Missing credentials env: ${profile.serviceAccountJsonEnv}`);
  process.exit(1);
}

const credentials = JSON.parse(
  rawCredentials,
) as GoogleServiceAccountCredentials;
const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ["https://www.googleapis.com/auth/androidpublisher"],
});

console.info(
  `Querying Google Play Developer API Releases for app '${appCode}' (package: ${packageName})...\n`,
);

try {
  const edit = await auth.request<{ id?: string }>({
    method: "POST",
    url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits`,
  });

  const editId = edit.data.id;
  console.info("========== 1. CREATED EDIT SESSION ==========");
  console.info(JSON.stringify(edit.data, null, 2));
  console.info("=============================================\n");

  if (editId) {
    try {
      const tracksResponse = await auth.request({
        url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}/tracks`,
      });
      console.info("========== 2. RAW ACTIVE TRACKS RESPONSE ==========");
      console.info(JSON.stringify(tracksResponse.data, null, 2));
      console.info("===================================================\n");
    } finally {
      await auth.request({
        method: "DELETE",
        url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${encodeURIComponent(editId)}`,
      });
    }
  }

  const historyResponse = await auth.request({
    url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/tracks/production/releases`,
  });
  console.info("========== 3. RAW PRODUCTION RELEASES HISTORY ==========");
  console.info(JSON.stringify(historyResponse.data, null, 2));
  console.info("========================================================\n");

  const result = await fetchGoogleReleaseData(
    { id: "debug-app-id", packageName },
    (options) => auth.request(options),
  );

  console.info("========== 4. NORMALIZED PRODUCTION RELEASES ==========");
  console.info(JSON.stringify(result.releases, null, 2));
  console.info("=======================================================\n");
} catch (error) {
  console.error("Failed to query Google Play Releases API:", error);
  process.exit(1);
}
