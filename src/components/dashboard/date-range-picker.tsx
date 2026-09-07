"use client";

import { DayPicker, type DateRange } from "@daypicker/react";
import { ko } from "@daypicker/react/locale";
import { useEffect, useRef, useState } from "react";

import {
  dateFromIso,
  isoFromDate,
  metricRangeFromCalendar,
  presetDateRange,
} from "@/components/dashboard/date-range-picker.logic";
import {
  dateRangeDays,
  type MetricDateRange,
} from "@/services/mobile/common/metrics-calculator";
import { KoboyoIcon } from "@/components/ui/koboyo-icon";

const presets = [7, 30, 90] as const;
const displayDate = (value: string) => value.replaceAll("-", ".");

export function DashboardDateRangePicker({
  value,
  minDate,
  maxDate,
  disabled = false,
  onChange,
}: {
  value: MetricDateRange;
  minDate: string;
  maxDate: string;
  disabled?: boolean;
  onChange: (value: MetricDateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [visibleMonth, setVisibleMonth] = useState(value.endDate);
  const [appliedPreset, setAppliedPreset] = useState<number | null>(() =>
    value.endDate === maxDate && presets.includes(dateRangeDays(value) as 7 | 30 | 90)
      ? dateRangeDays(value)
      : null,
  );
  const [draftPreset, setDraftPreset] = useState<number | null>(appliedPreset);
  const rootRef = useRef<HTMLDivElement>(null);
  const days = dateRangeDays(value);
  const availableDays = dateRangeDays({ startDate: minDate, endDate: maxDate });
  const draftIsValid =
    draft.startDate >= minDate &&
    draft.endDate <= maxDate &&
    draft.startDate <= draft.endDate &&
    dateRangeDays(draft) >= 1 &&
    dateRangeDays(draft) <= 366;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setDraftPreset(appliedPreset);
        setDraft(value);
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraftPreset(appliedPreset);
        setDraft(value);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, appliedPreset, value]);

  const selectPreset = (presetDays: (typeof presets)[number]) => {
    const next = presetDateRange(presetDays, minDate, maxDate);
    setDraft(next);
    setDraftPreset(presetDays);
    setVisibleMonth(next.endDate);
  };
  const selectedRange: DateRange | undefined =
    draft.startDate
      ? {
          from: dateFromIso(draft.startDate),
          to: draft.endDate ? dateFromIso(draft.endDate) : undefined,
        }
      : undefined;
  const selectDateRange = (range: DateRange | undefined) => {
    const nextRange = metricRangeFromCalendar(range ?? {});
    if (!nextRange) return;
    setDraftPreset(null);
    setDraft(nextRange);
  };

  return (
    <div className="mi-global-date-range" ref={rootRef}>
      <button
        type="button"
        className="mi-date-range-trigger"
        aria-label="분석 기간 선택"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setDraft(value);
          setVisibleMonth(value.endDate);
          setDraftPreset(appliedPreset);
          setOpen((current) => !current);
        }}
      >
        <KoboyoIcon name="calendar" size={17} />
        <span className="mi-date-range-copy">
          {displayDate(value.startDate)} ~ {displayDate(value.endDate)}
          <small>({days}일)</small>
        </span>
        <KoboyoIcon name="chevron-down" size={10} className="mi-date-range-chevron" />
      </button>

      {open && (
        <div
          className="mi-date-range-popover"
          role="dialog"
          aria-label="날짜 범위 설정"
        >
          <div className="mi-date-range-fields">
            <strong>조회할 기간</strong>
            <p className="mi-date-range-availability">
              조회 가능 {displayDate(minDate)} ~ {displayDate(maxDate)} (
              {availableDays}일)
            </p>
            <div className="mi-date-range-inputs">
              <label>
                시작일
                <input
                  type="date"
                  min={minDate}
                  max={draft.endDate || maxDate}
                  value={draft.startDate}
                  onChange={(event) => {
                    setDraftPreset(null);
                    setDraft((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }));
                  }}
                />
              </label>
              <span>~</span>
              <label>
                종료일
                <input
                  type="date"
                  min={draft.startDate || minDate}
                  max={maxDate}
                  value={draft.endDate}
                  onChange={(event) => {
                    setDraftPreset(null);
                    setDraft((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }));
                  }}
                />
              </label>
            </div>

            <div className="mi-date-range-calendar">
              <DayPicker
                mode="range"
                locale={ko}
                navLayout="around"
                weekStartsOn={1}
                showOutsideDays
                fixedWeeks
                resetOnSelect
                excludeDisabled
                max={366}
                month={dateFromIso(visibleMonth)}
                startMonth={dateFromIso(minDate)}
                endMonth={dateFromIso(maxDate)}
                disabled={[
                  { before: dateFromIso(minDate) },
                  { after: dateFromIso(maxDate) },
                ]}
                selected={selectedRange}
                onMonthChange={(month) => setVisibleMonth(isoFromDate(month))}
                onSelect={selectDateRange}
              />
            </div>

            {!draftIsValid && (
              <p role="alert">
                시작일과 종료일을 확인해 주세요. 최대 366일까지 볼 수 있습니다.
              </p>
            )}
            <footer>
              <button
                type="button"
                onClick={() => {
                  setDraftPreset(appliedPreset);
                  setDraft(value);
                  setOpen(false);
                }}
              >
                취소
              </button>
              <button
                type="button"
                className="is-primary"
                disabled={!draftIsValid}
                onClick={() => {
                  setAppliedPreset(draftPreset);
                  onChange(draft);
                  setOpen(false);
                }}
              >
                적용
              </button>
            </footer>
          </div>
          <nav aria-label="빠른 기간 선택">
            {presets.map((presetDays) => (
              <button
                type="button"
                key={presetDays}
                disabled={presetDays > availableDays}
                title={
                  presetDays > availableDays
                    ? `${presetDays}일을 선택하려면 데이터가 더 필요합니다.`
                    : undefined
                }
                className={
                  draftPreset === presetDays ? "is-active" : ""
                }
                onClick={() => selectPreset(presetDays)}
              >
                최근 {presetDays}일
              </button>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
