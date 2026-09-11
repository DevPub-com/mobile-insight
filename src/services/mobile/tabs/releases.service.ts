import type { DashboardData } from "@/domain/types";
import { shiftDate } from "../common/metrics-calculator";

export function buildReleaseCadence(
  releases: DashboardData["releases"],
  referenceDate: string,
) {
  const reference = Date.parse(`${referenceDate.slice(0, 10)}T00:00:00.000Z`);
  const platforms = (["android", "ios"] as const).map((platform) => {
    const dates = releases
      .filter((item) => item.platform === platform)
      .map((item) => Date.parse(`${item.releasedAt.slice(0, 10)}T00:00:00.000Z`))
      .filter((value) => Number.isFinite(value) && value <= reference)
      .sort((a, b) => a - b);
    const recentCount = dates.filter((value) => (reference - value) / 86_400_000 < 30).length;
    const averageCycleDays = dates.length > 1
      ? (dates[dates.length - 1] - dates[0]) / 86_400_000 / (dates.length - 1)
      : null;
    return { platform, recentCount, averageCycleDays };
  });
  return {
    platforms,
    recentCount: platforms.reduce((sum, item) => sum + item.recentCount, 0),
  };
}

export function selectLatestMatureRelease(
  data: DashboardData,
  afterDays = 7,
) {
  const releases = [...data.releases].sort((a, b) =>
    b.releasedAt.localeCompare(a.releasedAt),
  );
  const latestMetricDate = data.metrics.reduce(
    (latest, metric) => (metric.date > latest ? metric.date : latest),
    "",
  );
  if (!latestMetricDate) return releases[0] ?? null;
  const cutoff = shiftDate(latestMetricDate, -afterDays);
  return (
    releases.find((release) => release.releasedAt.slice(0, 10) <= cutoff) ??
    releases[0] ??
    null
  );
}
