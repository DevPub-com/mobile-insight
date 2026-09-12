import { afterEach, describe, expect, it, vi } from "vitest";
import { JWT } from "google-auth-library";
import { Ga4Adapter, normalizeGa4FirstOpenReport } from "../adapter/ga4.adapter";
import { buildFirstOpenTrend } from "../tabs/downloads.service";

const app = { id: "app-1", code: "kis", name: "KIS", androidPackageName: "com.example", iosAppId: "123", iosBundleId: null };
const observedAt = "2026-09-12T02:00:00.000Z";
const row = (date: string, platform: string, value: string) => ({
  dimensionValues: [{ value: date }, { value: platform }], metricValues: [{ value }],
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("Firebase first opens", () => {
  it("stores event counts separately from downloads, including actual zeroes", () => {
    const result = normalizeGa4FirstOpenReport(app.id, {
      rows: [row("20260911", "Android", "4641"), row("20260911", "iOS", "0")],
      metadata: { timeZone: "Etc/GMT-9" },
    }, observedAt);
    expect(result).toEqual([
      expect.objectContaining({ appId: app.id, platform: "android", date: "2026-09-11", metricKey: "first_open", value: 4641, source: "firebase", quality: "exact", observedAt }),
      expect.objectContaining({ platform: "ios", value: 0 }),
    ]);
    expect(result[0]).not.toHaveProperty("downloads");
    expect(result[0].description).toContain("Etc/GMT-9");
  });

  it.each(["-1", "1.5", "NaN", "", "9007199254740992"])("rejects invalid event count %s", (value) => {
    expect(() => normalizeGa4FirstOpenReport(app.id, { rows: [row("20260911", "Android", value)] }, observedAt)).toThrow();
  });

  it("ignores web and rejects invalid mobile dates", () => {
    expect(normalizeGa4FirstOpenReport(app.id, { rows: [row("20260911", "web", "7")] }, observedAt)).toEqual([]);
    expect(() => normalizeGa4FirstOpenReport(app.id, { rows: [row("20260230", "Android", "7")] }, observedAt)).toThrow();
  });

  it("requests only first_open event counts through yesterday", async () => {
    vi.stubEnv("GA4_KIS_PROPERTY_ID", "123");
    vi.stubEnv("GOOGLE_KIS_SERVICE_ACCOUNT_JSON", JSON.stringify({ client_email: "test@example.com", private_key: "test" }));
    const request = vi.spyOn(JWT.prototype, "request").mockResolvedValue({ data: { rowCount: 1, rows: [row("20260911", "Android", "4641")], metadata: { timeZone: "Etc/GMT-9" } } } as never);
    const result = await new Ga4Adapter().fetchFirstOpens(app);
    expect(result).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      dateRanges: [{ startDate: "35daysAgo", endDate: "yesterday" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "first_open", caseSensitive: true } } },
    }) }));
  });

  it("does not convert missing dates to zero or mix other metrics and apps", () => {
    const observations = normalizeGa4FirstOpenReport(app.id, { rows: [row("20260911", "Android", "4641"), row("20260911", "iOS", "0")] }, observedAt);
    const result = buildFirstOpenTrend([
      ...observations,
      { ...observations[0], metricKey: "daily_user_installs", value: 999 },
      { ...observations[0], appId: "other", value: 999 },
      { ...observations[0], source: "manual", value: 999 },
    ], app.id, { startDate: "2026-09-10", endDate: "2026-09-11" });
    expect(result).toEqual([
      { date: "2026-09-10", android: null, ios: null, total: null },
      { date: "2026-09-11", android: 4641, ios: 0, total: 4641 },
    ]);
  });
});
