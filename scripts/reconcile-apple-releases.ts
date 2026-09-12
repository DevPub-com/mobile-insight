import { and, eq, inArray } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getStoreCredentialProfile } from "../src/config/store-config";
import { getDb } from "../src/db";
import { apps, releases } from "../src/db/schema";

import { isPublishedAppleVersion } from "../src/services/apple/apple-releases";
import { writeFileSync } from "node:fs";

loadScriptEnv();

const appCode = process.argv[2] ?? "kis";
const [app] = await getDb().select().from(apps).where(eq(apps.code, appCode));
const profile = getStoreCredentialProfile(appCode)?.apple;
if (!app?.iosAppId || !profile) throw new Error(`Apple app not configured: ${appCode}`);

const issuerId = process.env[profile.issuerIdEnv] ?? "";
const keyId = process.env[profile.keyIdEnv] ?? "";
const privateKey = (process.env[profile.privateKeyEnv] ?? "").replaceAll("\\n", "\n");
const key = await importPKCS8(privateKey, "ES256");
const token = await new SignJWT({})
  .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
  .setIssuer(issuerId)
  .setAudience("appstoreconnect-v1")
  .setIssuedAt()
  .setExpirationTime("15m")
  .sign(key);

type Item = { id: string; attributes: Record<string, unknown> };
type List = { data: Item[]; links?: { next?: string } };
async function list(path: string): Promise<Item[]> {
  const rows: Item[] = [];
  let next: string | undefined = path;
  while (next) {
    const url = next.startsWith("http") ? next : `https://api.appstoreconnect.apple.com${next}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`App Store Connect ${response.status}: ${await response.text()}`);
    const payload = await response.json() as List;
    rows.push(...payload.data);
    next = payload.links?.next;
  }
  return rows;
}

const versions = await list(`/v1/apps/${encodeURIComponent(app.iosAppId)}/appStoreVersions?limit=200&fields[appStoreVersions]=platform,versionString,appStoreState`);
const unpublished = versions.filter(item => item.attributes.platform === "IOS" && typeof item.attributes.appStoreState === "string" && !isPublishedAppleVersion(String(item.attributes.appStoreState)));
const names = unpublished.map(item => String(item.attributes.versionString));
const stored = names.length ? await getDb().select().from(releases).where(and(eq(releases.appId, app.id), eq(releases.platform, "ios"), inArray(releases.version, names))) : [];
console.info(JSON.stringify({app:appCode, unpublished:unpublished.map(item=>item.attributes), latestPublished:versions.find(item=>isPublishedAppleVersion(String(item.attributes.appStoreState)))?.attributes, storedUnpublished:stored.map(row=>({id:row.id,version:row.version}))},null,2));
if (process.argv.includes("--apply") && stored.length) {
 const backup = `/private/tmp/mobile-insight-unpublished-releases-${appCode}-${Date.now()}.json`;
 writeFileSync(backup, JSON.stringify(stored, null, 2), {mode:0o600});
 const removed = await getDb().delete(releases).where(inArray(releases.id, stored.map(row=>row.id))).returning({version:releases.version});
 console.info(JSON.stringify({backup,removed}));
}
process.exit(0);
