import type { AppInfo } from "@/domain/types";
import type { Ga4Adapter } from "@/services/mobile/adapter";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function fetchGa4SyncData(
  adapter: Pick<Ga4Adapter, "fetch" | "fetchDeviceActiveUsers" | "fetchFirstOpens">,
  app: AppInfo,
  days?: number,
) {
  const [summaryResult, deviceResult, firstOpenResult] = await Promise.allSettled([
    adapter.fetch(app, days),
    adapter.fetchDeviceActiveUsers(app, days),
    adapter.fetchFirstOpens(app, days),
  ]);
  return {
    metrics: summaryResult.status === "fulfilled" ? summaryResult.value : [],
    devices: deviceResult.status === "fulfilled" ? deviceResult.value : null,
    firstOpens: firstOpenResult.status === "fulfilled" ? firstOpenResult.value : [],
    errors: [
      ...(firstOpenResult.status === "rejected"
        ? [`analytics_first_opens: ${errorMessage(firstOpenResult.reason)}`]
        : []),
      ...(summaryResult.status === "rejected"
        ? [`analytics_summary: ${errorMessage(summaryResult.reason)}`]
        : []),
      ...(deviceResult.status === "rejected"
        ? [`analytics_devices: ${errorMessage(deviceResult.reason)}`]
        : []),
    ],
  };
}
