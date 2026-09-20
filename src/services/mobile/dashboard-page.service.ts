import { getReviewsForAnalysis } from "@/db/review.repository";
import type { DashboardData } from "@/domain/types";
import { loadDashboardData } from "./dashboard.service";
import { buildDashboardView, defaultDashboardRange } from "./dashboard-view";
import { latestDate, previousDateRange, type MetricDateRange } from "./common/metrics-calculator";
import { displayReleaseVersion } from "./common/release-version";

export function dashboardReviewRange(data: DashboardData, range: MetricDateRange) {
  const starts = [previousDateRange(range).startDate];
  const through = latestDate(data);
  for (const platform of ["android", "ios"] as const) {
    const releases = data.releases.filter(item => item.platform === platform).sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
    const latest = releases[0];
    if (!latest || latest.releasedAt.slice(0, 10) > through) continue;
    const previous = releases.find(item => item.releasedAt.slice(0, 10) < latest.releasedAt.slice(0, 10) &&
      displayReleaseVersion(platform, item.version) !== displayReleaseVersion(platform, latest.version));
    starts.push((previous ?? latest).releasedAt.slice(0, 10));
  }
  return { startDate: starts.sort()[0], endDate: [range.endDate, through].sort().at(-1)! };
}

export async function loadDashboardView(data: DashboardData, range: MetricDateRange) {
  const reviews = await getReviewsForAnalysis(data.app.id, dashboardReviewRange(data, range));
  return buildDashboardView({ ...data, reviews, reviewDataTruncated: false }, range);
}

export async function loadDashboardPage(appCode: string) {
  const data = await loadDashboardData(appCode, "shell");
  if (!data) return null;
  return { data, initialView: await loadDashboardView(data, defaultDashboardRange(data)) };
}
