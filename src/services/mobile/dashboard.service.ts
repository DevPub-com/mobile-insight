import {
  getActiveApps,
  getDashboardData as getDatabaseDashboardData,
} from "@/db/dashboard.repository";
import type { DashboardData } from "@/domain/types";

export async function loadDashboardData(
  appCode: string,
): Promise<DashboardData | null> {
  return getDatabaseDashboardData(appCode);
}

export async function loadApps() {
  return getActiveApps();
}
