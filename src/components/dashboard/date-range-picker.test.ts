import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  calendarMonth,
  clampMonth,
  dateFromIso,
  dateRangePosition,
  isoFromDate,
  metricRangeFromCalendar,
  normalizeDateRangeBoundary,
  presetDateRange,
} from "@/components/dashboard/date-range-picker.logic";

const source = readFileSync(
  new URL("./date-range-picker.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("DashboardDateRangePicker", () => {
  it("uses React DayPicker and keeps every selected-day control square", () => {
    expect(source).toContain('from "@daypicker/react"');
    expect(source).toContain('<DayPicker');
    expect(source).toContain('mode="range"');
    expect(globalStyles).toMatch(
      /\.mi-date-range-calendar \.rdp-day_button\s*{[^}]*width:\s*36px[^}]*height:\s*36px/s,
    );
  });

  it("offers one custom date-range control with presets and apply/cancel actions", () => {
    expect(source).toContain('aria-label="분석 기간 선택"');
    expect(source).toContain("const presets = [7, 30, 90]");
    expect(source).toContain("최근 {presetDays}일");
    expect(source).toContain("적용");
    expect(source).toContain("취소");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('startMonth={dateFromIso(minDate)}');
    expect(source).toContain('endMonth={dateFromIso(maxDate)}');
    expect(source).toContain("excludeDisabled");
    expect(source).toContain("조회 가능");
    expect(source).toContain("presetDays > availableDays");
  });

  it("keeps the trigger copy on one line with a compact chevron", () => {
    expect(source).toContain('<span className="mi-date-range-copy">');
    expect(source).toContain(
      '<KoboyoIcon name="chevron-down" size={10} className="mi-date-range-chevron" />',
    );
    expect(globalStyles).toMatch(
      /\.mi-date-range-copy\s*{[^}]*white-space:\s*nowrap/s,
    );
    expect(globalStyles).not.toMatch(/\.mi-date-range-trigger\s*>\s*span\s*{/);
    expect(globalStyles).toMatch(
      /\.mi-date-range-chevron\s*{[^}]*width:\s*10px[^}]*height:\s*10px/s,
    );
  });

  it("stages a preset and waits for Apply before updating the dashboard", () => {
    const selectPreset = source.match(
      /const selectPreset[\s\S]*?\n  };/,
    )?.[0] ?? "";

    expect(selectPreset).toContain("setDraft(next)");
    expect(selectPreset).toContain("setDraftPreset(presetDays)");
    expect(selectPreset).not.toContain("onChange(");
    expect(selectPreset).not.toContain("setOpen(false)");
    expect(source).toContain("onClick={() => selectPreset(presetDays)}");
    expect(source.match(/onChange\(/g)).toHaveLength(1);
  });

  it("converts ISO dates without timezone drift", () => {
    const date = dateFromIso("2026-09-07");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(7);
    expect(isoFromDate(date)).toBe("2026-09-07");
  });

  it("keeps a first calendar click pending until an end date is selected", () => {
    expect(metricRangeFromCalendar({ from: dateFromIso("2026-09-03") })).toEqual(
      {
        startDate: "2026-09-03",
        endDate: "",
      },
    );
    expect(
      metricRangeFromCalendar({
        from: dateFromIso("2026-09-03"),
        to: dateFromIso("2026-09-05"),
      }),
    ).toEqual({ startDate: "2026-09-03", endDate: "2026-09-05" });
  });

  it("builds a Monday-first calendar with leading and trailing cells", () => {
    const month = calendarMonth("2025-05-10");

    expect(month.label).toBe("2025년 5월");
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks[0].map((day) => day.date)).toEqual([
      "2025-04-28",
      "2025-04-29",
      "2025-04-30",
      "2025-05-01",
      "2025-05-02",
      "2025-05-03",
      "2025-05-04",
    ]);
  });

  it("marks range boundaries and dates inside the range", () => {
    const range = { startDate: "2025-05-03", endDate: "2025-05-06" };

    expect(dateRangePosition("2025-05-02", range)).toBe("outside");
    expect(dateRangePosition("2025-05-03", range)).toBe("start");
    expect(dateRangePosition("2025-05-04", range)).toBe("inside");
    expect(dateRangePosition("2025-05-06", range)).toBe("end");
  });

  it("keeps calendar navigation inside the available data months", () => {
    expect(clampMonth("2025-01-18", "2025-03-01", "2025-05-31")).toBe(
      "2025-03-01",
    );
    expect(clampMonth("2025-08-18", "2025-03-01", "2025-05-31")).toBe(
      "2025-05-01",
    );
  });

  it("clips presets to the available data without confusing preset identity", () => {
    expect(presetDateRange(90, "2025-04-11", "2025-05-10")).toEqual({
      startDate: "2025-04-11",
      endDate: "2025-05-10",
    });
    expect(presetDateRange(30, "2025-04-11", "2025-05-10")).toEqual({
      startDate: "2025-04-11",
      endDate: "2025-05-10",
    });
  });

  it("keeps manual start and end edits as an ordered, complete range", () => {
    expect(
      normalizeDateRangeBoundary(
        { startDate: "2026-09-02", endDate: "2026-09-05" },
        "startDate",
        "2026-09-07",
        "2022-05-18",
        "2026-09-07",
      ),
    ).toEqual({ startDate: "2026-09-07", endDate: "2026-09-07" });

    expect(
      normalizeDateRangeBoundary(
        { startDate: "2026-09-02", endDate: "2026-09-05" },
        "endDate",
        "2026-09-01",
        "2022-05-18",
        "2026-09-07",
      ),
    ).toEqual({ startDate: "2026-09-01", endDate: "2026-09-01" });
  });

  it("limits manual edits and calendar selection to 366 inclusive days", () => {
    expect(
      normalizeDateRangeBoundary(
        { startDate: "2026-01-01", endDate: "2026-09-07" },
        "startDate",
        "2025-01-01",
        "2022-05-18",
        "2026-09-07",
      ),
    ).toEqual({ startDate: "2025-01-01", endDate: "2026-01-01" });

    expect(source).toContain("max={MAX_DATE_RANGE_DAYS - 1}");
    expect(source).not.toContain("max={366}");
  });
});
