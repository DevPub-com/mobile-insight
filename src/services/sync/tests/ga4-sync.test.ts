import { describe, expect, it } from "vitest";

import type { AppInfo } from "@/domain/types";
import { fetchGa4SyncData } from "../ga4-sync";

const app: AppInfo = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "kis",
  name: "한국투자",
  androidPackageName: "com.example",
  iosAppId: null,
  iosBundleId: null,
};

describe("fetchGa4SyncData", () => {
  it("returns summary and device datasets together", async () => {
    const result = await fetchGa4SyncData(
      {
        fetch: async () => [{ appId: app.id }] as never[],
        fetchFirstOpens: async () => [{ appId: app.id, metricKey: "first_open" }] as never[],
        fetchDeviceActiveUsers: async () => ({
          configured: true,
          records: [{ appId: app.id }] as never[],
          startDate: "2026-08-01",
          endDate: "2026-09-07",
        }),
      },
      app,
      35,
    );

    expect(result.metrics).toHaveLength(1);
    expect(result.firstOpens).toHaveLength(1);
    expect(result.devices?.records).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("preserves summary data when the device report fails", async () => {
    const result = await fetchGa4SyncData(
      {
        fetch: async () => [{ appId: app.id }] as never[],
        fetchFirstOpens: async () => [{ appId: app.id, metricKey: "first_open" }] as never[],
        fetchDeviceActiveUsers: async () => {
          throw new Error("device quota exceeded");
        },
      },
      app,
      35,
    );

    expect(result.metrics).toHaveLength(1);
    expect(result.firstOpens).toHaveLength(1);
    expect(result.devices).toBeNull();
    expect(result.errors).toEqual(["analytics_devices: device quota exceeded"]);
  });
});

 it("keeps other analytics when first opens fail", async () => {
   const result = await fetchGa4SyncData({
     fetch: async () => [],
     fetchDeviceActiveUsers: async () => ({configured: false, records: [], startDate: "2026-09-01", endDate: "2026-09-11"}),
     fetchFirstOpens: async () => { throw new Error("quota exceeded"); },
   }, app);
   expect(result.firstOpens).toEqual([]);
   expect(result.errors).toEqual(["analytics_first_opens: quota exceeded"]);
 });
