import type { DashboardData, Platform } from "@/domain/types";
export const number = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("ko-KR").format(value);

export const rating = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);

export const percent = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;

export function ratingSparklineValues(
  trend: Array<{ android: number | null; ios: number | null }>,
  platform: Platform,
  fallback: number | null,
): number[] {
  const values = trend.flatMap((item) => {
    const value = item[platform];
    return value === null ? [] : [value];
  });
  return values.length ? values : fallback === null ? [] : [fallback];
}

export const signedDelta = (
  value: number | null,
  decimals = 0,
  suffix = "",
) => {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${value >= 0 ? "+" : ""}${formatted}${suffix}`;
};

export const displayedDifference = (
  before: number | null,
  after: number | null,
  decimals: number,
) => {
  if (before === null || after === null) return null;
  const visibleBefore = Number(before.toFixed(decimals));
  const visibleAfter = Number(after.toFixed(decimals));
  return Number((visibleAfter - visibleBefore).toFixed(decimals));
};

export const date = (value: string) => value.slice(0, 10).replaceAll("-", ".");

export const releaseDate = (release: DashboardData["releases"][number]) =>
  `${date(release.releasedAt)} (기준일)`;

export const syncDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Seoul",
      }).format(new Date(value))
    : "기록 없음";
