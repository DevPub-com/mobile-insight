import { eq } from "drizzle-orm";
import { importPKCS8, SignJWT } from "jose";
import { gunzipSync } from "node:zlib";
import { parse } from "csv-parse/sync";

import { loadScriptEnv } from "../src/config/load-script-env";
import { getStoreCredentialProfile } from "../src/config/store-config";
import { getDb } from "../src/db";
import { apps } from "../src/db/schema";

loadScriptEnv();

const appCode = process.argv[2] ?? "wtc";
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

const requests = await list(`/v1/apps/${encodeURIComponent(app.iosAppId)}/analyticsReportRequests?limit=200`);
for (const request of requests) {
  const reports = await list(`/v1/analyticsReportRequests/${encodeURIComponent(request.id)}/reports?limit=200`);
  if (process.argv.includes("--sample")) {
    for (const report of reports.filter((item) =>
      ["App Downloads Standard", "App Store Installation and Deletion Standard"].includes(String(item.attributes.name)),
    )) {
      let instances = await list(`/v1/analyticsReports/${encodeURIComponent(report.id)}/instances?limit=200&filter[granularity]=DAILY`);
      if (!instances.length) {
        instances = await list(`/v1/analyticsReports/${encodeURIComponent(report.id)}/instances?limit=200`);
      }
      const instance = instances.at(-1);
      if (!instance) {
        console.info(JSON.stringify({
          accessType: request.attributes.accessType,
          report: report.attributes.name,
          instances: 0,
        }, null, 2));
        continue;
      }
      const segments = await list(`/v1/analyticsReportInstances/${encodeURIComponent(instance.id)}/segments?limit=200`);
      const segmentUrl = segments[0]?.attributes.url;
      if (typeof segmentUrl !== "string") continue;
      const response = await fetch(segmentUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const text = buffer[0] === 0x1f && buffer[1] === 0x8b
        ? gunzipSync(buffer).toString("utf8")
        : buffer.toString("utf8");
      const rows = parse(text.replace(/^\uFEFF/, ""), {
        columns: true,
        delimiter: (text.split(/\r?\n/, 1)[0] ?? "").includes("\t") ? "\t" : ",",
        skip_empty_lines: true,
        relax_column_count: true,
      }) as Array<Record<string, string>>;
      console.info(JSON.stringify({
        accessType: request.attributes.accessType,
        report: report.attributes.name,
        columns: Object.keys(rows[0] ?? {}),
        sample: rows.slice(0, 3),
      }, null, 2));
    }
    continue;
  }
  console.info(JSON.stringify({
    requestId: request.id,
    accessType: request.attributes.accessType,
    reports: reports.map((report) => ({
      name: report.attributes.name,
      category: report.attributes.category,
    })),
  }, null, 2));
}
