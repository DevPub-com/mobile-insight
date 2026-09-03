import { eq } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { apps } from "../src/db/schema";

loadScriptEnv();

const code = process.argv.find((argument) => argument.startsWith("--app="))?.slice(6) ?? "wtc";
const db = getDb();
const app = (await db.select().from(apps).where(eq(apps.code, code)))[0];
if (!app?.iosAppId) throw new Error(`${code}: iOS App Store Connect app ID가 없습니다.`);

const prefix = `APPLE_${code.toUpperCase()}`;
const issuerId = process.env[`${prefix}_ISSUER_ID`];
const keyId = process.env[`${prefix}_KEY_ID`];
const privateKey = process.env[`${prefix}_PRIVATE_KEY`];
if (!issuerId || !keyId || !privateKey) {
  throw new Error(`${code}: App Store Connect API 인증 설정이 없습니다.`);
}

const key = await importPKCS8(privateKey.replaceAll("\\n", "\n"), "ES256");
const token = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
  .setIssuer(issuerId)
  .setAudience("appstoreconnect-v1")
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(key);
const query = new URLSearchParams({
  limit: "200",
  "fields[appStoreVersions]":
    "platform,versionString,earliestReleaseDate,createdDate,appStoreState",
});
const response = await fetch(
  `https://api.appstoreconnect.apple.com/v1/apps/${encodeURIComponent(app.iosAppId)}/appStoreVersions?${query}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
const payload = (await response.json()) as {
  data?: Array<{
    attributes?: {
      versionString?: string;
      appStoreState?: string;
      earliestReleaseDate?: string | null;
      createdDate?: string | null;
    };
  }>;
  errors?: unknown;
};
console.info({
  status: response.status,
  count: payload.data?.length ?? 0,
  versions:
    payload.data?.map((item) => ({
      version: item.attributes?.versionString ?? null,
      state: item.attributes?.appStoreState ?? null,
      earliestReleaseDate: item.attributes?.earliestReleaseDate ?? null,
      createdDate: item.attributes?.createdDate ?? null,
    })) ?? payload.errors,
});
