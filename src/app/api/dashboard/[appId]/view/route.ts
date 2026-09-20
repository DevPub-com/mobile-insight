import { NextResponse } from "next/server";
import { dateRangeSchema } from "@/contracts/review-query";
import { loadDashboardData } from "@/services/mobile/dashboard.service";
import { loadDashboardView } from "@/services/mobile/dashboard-page.service";
import { availableMetricDateRange } from "@/services/mobile/common/metrics-calculator";

export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const query = new URL(request.url).searchParams;
  const parsed = dateRangeSchema.safeParse({ startDate: query.get("from"), endDate: query.get("to") });
  if (!parsed.success) return NextResponse.json({ error: "지원하지 않는 기간입니다." }, { status: 400 });
  try {
    const { appId } = await params;
    const data = await loadDashboardData(appId, "shell");
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const available = availableMetricDateRange(data);
    if (!available || parsed.data.startDate < available.startDate || parsed.data.endDate > available.endDate) {
      return NextResponse.json({ error: "조회 가능한 데이터 기간을 벗어났습니다.", availableDateRange: available }, { status: 422 });
    }
    return NextResponse.json({ data: await loadDashboardView(data, parsed.data) });
  } catch { return NextResponse.json({ error: "대시보드 요약을 불러오지 못했습니다." }, { status: 500 }); }
}
