import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analytics: vi.fn(),
  storeSync: vi.fn(),
  upsertMetrics: vi.fn(),
}));

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: async () => [{ id: "app", code: "kis", name: "Test" }] }) }),
    insert: () => ({ values: () => Object.assign(Promise.resolve(), { returning: async () => [{ id: "run" }] }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  }),
}));
vi.mock("@/db/upsert", () => ({
  upsertDailyMetrics: mocks.upsertMetrics,
  upsertMetricObservations: vi.fn(),
  replaceDeviceDailyRecords: vi.fn(),
  upsertAndroidDistribution: vi.fn(),
  upsertRatingSnapshots: vi.fn(),
  upsertReleases: vi.fn(),
  upsertReviews: vi.fn(),
}));
vi.mock("@/services/google/adapter", () => ({ GooglePlayAdapter: class {
  platform = "android";
  syncTypes = ["downloads", "reviews"];
  sync = mocks.storeSync;
} }));
vi.mock("@/services/apple/adapter", () => ({ AppStoreAdapter: class {
  platform = "ios";
  syncTypes = ["downloads", "reviews"];
  sync = mocks.storeSync;
} }));
vi.mock("@/services/mobile/adapter", () => ({ Ga4Adapter: class {} }));
vi.mock("../ga4-sync", () => ({ fetchGa4SyncData: mocks.analytics }));
vi.mock("@/services/firebase/crash-impact", () => ({ loadCrashImpact: async () => ({}) }));
vi.mock("@/services/firebase/stored-crash-impact", () => ({ crashImpactObservations: () => [] }));
vi.mock("@/services/ai/review-analyzer.service", () => ({ analyzeReviewsBatch: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

import { syncAllApps } from "../sync-app";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.analytics.mockResolvedValue({ metrics: [{ appId: "app", newUsers: 10 }], devices: null, firstOpens: [], appRemoves: [], errors: [] });
  mocks.storeSync.mockResolvedValue({ metrics: [], reviews: [], releases: [], errors: [] });
});

it.each(["all", "metrics"] as const)("persists GA4 data during %s sync", async scope => {
  const results = await syncAllApps(scope, "app");
  expect(mocks.analytics).toHaveBeenCalledOnce();
  expect(mocks.upsertMetrics).toHaveBeenCalledWith(expect.anything(), [{ appId: "app", newUsers: 10 }]);
  expect(results).toContainEqual({ app: "kis", platform: "analytics", status: "success", recordsCount: 1 });
  if (scope === "metrics") {
    expect(mocks.storeSync).toHaveBeenCalledWith(expect.objectContaining({ id: "app" }), ["downloads", "installs", "stability"]);
  }
});

it("keeps VOC sync limited to reviews, ratings and releases", async () => {
  await syncAllApps("voc", "app");
  expect(mocks.analytics).not.toHaveBeenCalled();
  expect(mocks.upsertMetrics).not.toHaveBeenCalled();
  expect(mocks.storeSync).toHaveBeenCalledWith(expect.anything(), ["reviews", "ratings", "releases"]);
});

it("persists available GA4 data and continues store sync after a partial analytics failure", async () => {
  mocks.analytics.mockResolvedValue({ metrics: [{ appId: "app", newUsers: 10 }], devices: null, firstOpens: [], appRemoves: [], errors: ["analytics_devices: quota exceeded"] });
  const results = await syncAllApps("metrics", "app");
  expect(mocks.upsertMetrics).toHaveBeenCalledOnce();
  expect(mocks.storeSync).toHaveBeenCalledTimes(2);
  expect(results).toContainEqual({ app: "kis", platform: "analytics", status: "failed", recordsCount: 1 });
});
