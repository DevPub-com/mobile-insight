import { demoApps, demoDashboardData } from "@/data/demo";
import {
  getActiveApps,
  getDashboardData as getDatabaseDashboardData,
} from "@/db/dashboard.repository";
import type { DashboardData } from "@/domain/types";
import { isDemoMode } from "@/lib/env";

export async function loadDashboardData(
  appCode: string,
): Promise<DashboardData | null> {
  if (isDemoMode()) {
    const app = demoApps.find((candidate) => candidate.code === appCode);
    return app ? { ...demoDashboardData, app } : null;
  }
  return getDatabaseDashboardData(appCode);
}

export async function loadApps() {
  if (isDemoMode()) {
    return demoDashboardData.apps;
  }
  return getActiveApps();
}
