import {
  shiftDate,
  type MetricDateRange,
} from "@/services/mobile/common/metrics-calculator";

const DAY_MS = 86_400_000;
export const MAX_DATE_RANGE_DAYS = 366;

const utcDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const isoDate = (value: Date) => value.toISOString().slice(0, 10);

export function dateFromIso(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isoFromDate(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function metricRangeFromCalendar(range: {
  from?: Date;
  to?: Date;
}): MetricDateRange | null {
  if (!range.from) return null;
  return {
    startDate: isoFromDate(range.from),
    endDate: range.to ? isoFromDate(range.to) : "",
  };
}

const clampDate = (value: string, minDate: string, maxDate: string) =>
  value < minDate ? minDate : value > maxDate ? maxDate : value;

export function normalizeDateRangeBoundary(
  current: MetricDateRange,
  boundary: keyof MetricDateRange,
  value: string,
  minDate: string,
  maxDate: string,
): MetricDateRange {
  if (!value) return { ...current, [boundary]: "" };

  const nextValue = clampDate(value, minDate, maxDate);
  if (boundary === "startDate") {
    let endDate = current.endDate
      ? clampDate(current.endDate, minDate, maxDate)
      : nextValue;
    if (endDate < nextValue) endDate = nextValue;

    const latestAllowedEnd = shiftDate(nextValue, MAX_DATE_RANGE_DAYS - 1);
    if (endDate > latestAllowedEnd) {
      endDate = clampDate(latestAllowedEnd, minDate, maxDate);
    }
    return { startDate: nextValue, endDate };
  }

  let startDate = current.startDate
    ? clampDate(current.startDate, minDate, maxDate)
    : nextValue;
  if (startDate > nextValue) startDate = nextValue;

  const earliestAllowedStart = shiftDate(nextValue, -(MAX_DATE_RANGE_DAYS - 1));
  if (startDate < earliestAllowedStart) {
    startDate = clampDate(earliestAllowedStart, minDate, maxDate);
  }
  return { startDate, endDate: nextValue };
}

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export type CalendarMonth = {
  value: string;
  label: string;
  weeks: CalendarDay[][];
};

export function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function shiftMonth(value: string, amount: number): string {
  const date = utcDate(monthStart(value));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return isoDate(date);
}

export function clampMonth(
  value: string,
  minDate: string,
  maxDate: string,
): string {
  const month = monthStart(value);
  const minimum = monthStart(minDate);
  const maximum = monthStart(maxDate);
  return month < minimum ? minimum : month > maximum ? maximum : month;
}

export function calendarMonth(value: string): CalendarMonth {
  const start = utcDate(monthStart(value));
  const mondayOffset = (start.getUTCDay() + 6) % 7;
  const gridStart = new Date(start.getTime() - mondayOffset * DAY_MS);
  const last = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  );
  const cells = Math.ceil((mondayOffset + last.getUTCDate()) / 7) * 7;
  const days = Array.from({ length: cells }, (_, index) => {
    const date = new Date(gridStart.getTime() + index * DAY_MS);
    return {
      date: isoDate(date),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === start.getUTCMonth(),
    };
  });

  return {
    value: isoDate(start),
    label: `${start.getUTCFullYear()}년 ${start.getUTCMonth() + 1}월`,
    weeks: Array.from({ length: cells / 7 }, (_, index) =>
      days.slice(index * 7, index * 7 + 7),
    ),
  };
}

export function dateRangePosition(
  date: string,
  range: MetricDateRange,
): "outside" | "start" | "inside" | "end" | "single" {
  if (date === range.startDate && date === range.endDate) return "single";
  if (date === range.startDate) return "start";
  if (date === range.endDate) return "end";
  if (date > range.startDate && date < range.endDate) return "inside";
  return "outside";
}

export function presetDateRange(
  days: number,
  minDate: string,
  maxDate: string,
): MetricDateRange {
  const requestedStart = shiftDate(maxDate, -(days - 1));
  return {
    startDate: requestedStart < minDate ? minDate : requestedStart,
    endDate: maxDate,
  };
}
