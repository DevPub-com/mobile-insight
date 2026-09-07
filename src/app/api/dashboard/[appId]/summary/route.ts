import { NextResponse } from "next/server";

import {
  buildDashboardSummary,
  buildDashboardSummaryForRange,
} from "@/services/mobile/dashboard-summary.service";
import { loadDashboardData } from "@/services/mobile/dashboard.service";
import {
  availableMetricDateRange,
  dateRangeDays,
  periodDateRange,
  type MetricDateRange,
  type Period,
} from "@/services/mobile/common/metrics-calculator";

const supportedPeriods = new Set<Period>(["7d", "30d", "3m"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!isoDatePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  const query = new URL(request.url).searchParams;
  const rawPeriod = query.get("period") ?? "30d";
  const from = query.get("from");
  const to = query.get("to");
  const hasCustomRange = from !== null || to !== null;
  const customRange =
    from && to
      ? ({ startDate: from, endDate: to } satisfies MetricDateRange)
      : null;
  const validCustomRange =
    customRange !== null &&
    isValidIsoDate(customRange.startDate) &&
    isValidIsoDate(customRange.endDate) &&
    customRange.startDate <= customRange.endDate &&
    dateRangeDays(customRange) >= 1 &&
    dateRangeDays(customRange) <= 366;

  if (
    (hasCustomRange && !validCustomRange) ||
    (!hasCustomRange && !supportedPeriods.has(rawPeriod as Period))
  ) {
    return NextResponse.json(
      { error: "지원하지 않는 기간입니다." },
      { status: 400 },
    );
  }

  const { appId } = await params;
  try {
    const data = await loadDashboardData(appId);
    if (!data) {
      return NextResponse.json(
        { error: "앱을 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    const availableDateRange = availableMetricDateRange(data);
    if (customRange && !availableDateRange) {
      return NextResponse.json(
        {
          error: "조회할 수 있는 날짜 데이터가 없습니다.",
          availableDateRange: null,
        },
        { status: 422 },
      );
    }
    const requestedRange = availableDateRange
      ? (customRange ??
        periodDateRange(rawPeriod as Period, availableDateRange.endDate))
      : null;
    if (
      availableDateRange &&
      requestedRange &&
      (requestedRange.startDate < availableDateRange.startDate ||
        requestedRange.endDate > availableDateRange.endDate)
    ) {
      return NextResponse.json(
        {
          error: "조회 가능한 데이터 기간을 벗어났습니다.",
          availableDateRange,
        },
        { status: 422 },
      );
    }
    return NextResponse.json({
      data: customRange
        ? buildDashboardSummaryForRange(data, customRange)
        : buildDashboardSummary(data, rawPeriod as Period),
    });
  } catch {
    return NextResponse.json(
      { error: "대시보드 요약을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
