import {
  getActiveApps,
  type DashboardReadProfile,
  getDashboardData as getDatabaseDashboardData,
  getReleaseImpactData as getDatabaseReleaseImpactData,
} from "@/db/dashboard.repository";
import type { DashboardData, Platform } from "@/domain/types";

export async function loadDashboardData(
  appCode: string,
  profile: DashboardReadProfile = "full",
): Promise<DashboardData | null> {
  return getDatabaseDashboardData(appCode, profile);
}

export async function loadApps() {
  return getActiveApps();
}

export async function loadReleaseImpactData(appCode: string, platform: Platform, version: string) {
  return getDatabaseReleaseImpactData(appCode, platform, version);
}
