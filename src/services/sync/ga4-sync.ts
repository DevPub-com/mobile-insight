import type { AppInfo } from "@/domain/types";
import type { Ga4Adapter } from "@/services/mobile/adapter";

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function fetchGa4SyncData(
  adapter: Pick<Ga4Adapter, "fetch" | "fetchDeviceActiveUsers" | "fetchFirstOpens" | "fetchAppRemoves">,
  app: AppInfo,
  days?: number,
) {
  const [summaryResult, deviceResult, firstOpenResult, appRemoveResult] = await Promise.allSettled([
    adapter.fetch(app, days),
    adapter.fetchDeviceActiveUsers(app, days),
    adapter.fetchFirstOpens(app, days),
    adapter.fetchAppRemoves(app, days),
  ]);
  return {
    metrics: summaryResult.status === "fulfilled" ? summaryResult.value : [],
    devices: deviceResult.status === "fulfilled" ? deviceResult.value : null,
    firstOpens: firstOpenResult.status === "fulfilled" ? firstOpenResult.value : [],
    appRemoves: appRemoveResult.status === "fulfilled" ? appRemoveResult.value : [],
    errors: [
      ...(appRemoveResult.status === "rejected" ? [`analytics_app_removes: ${errorMessage(appRemoveResult.reason)}`] : []),
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
