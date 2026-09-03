import type { DashboardData } from "@/domain/types";
import { shiftDate } from "../common/metrics-calculator";

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
