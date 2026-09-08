export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeDate(value: string | undefined): string | null {
  if (!value || !/^\d{8}$/.test(value)) {
    return null;
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function rollingDateRange(
  now: Date,
  days: number,
  timeZone = "UTC",
): { startDate: string; endDate: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const endDate = addDays(today, -1);
  return { startDate: addDays(endDate, -(days - 1)), endDate };
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
