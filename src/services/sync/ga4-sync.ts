import type { AppInfo } from "@/domain/types";
import type { Ga4Adapter } from "@/services/mobile/adapter";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function fetchGa4SyncData(
  adapter: Pick<Ga4Adapter, "fetch" | "fetchDeviceActiveUsers">,
  app: AppInfo,
  days?: number,
) {
  const [summaryResult, deviceResult] = await Promise.allSettled([
    adapter.fetch(app, days),
    adapter.fetchDeviceActiveUsers(app, days),
  ]);
  return {
    metrics: summaryResult.status === "fulfilled" ? summaryResult.value : [],
    devices: deviceResult.status === "fulfilled" ? deviceResult.value : null,
    errors: [
      ...(summaryResult.status === "rejected"
        ? [`analytics_summary: ${errorMessage(summaryResult.reason)}`]
        : []),
      ...(deviceResult.status === "rejected"
        ? [`analytics_devices: ${errorMessage(deviceResult.reason)}`]
        : []),
    ],
  };
}
