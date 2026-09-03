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
): { startDate: string; endDate: string } {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
