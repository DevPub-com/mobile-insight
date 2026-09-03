import { NextResponse } from "next/server";

import { loadDashboardData } from "@/services/mobile/dashboard.service";
import { buildActiveUserTrend } from "@/services/mobile/tabs/overview.service";
import type { Period } from "@/services/mobile/common/metrics-calculator";

const periods = new Set<Period>(["7d", "30d", "3m", "6m", "1y"]);

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const rawPeriod = new URL(request.url).searchParams.get("period") ?? "30d";
  if (!periods.has(rawPeriod as Period)) {
    return NextResponse.json({ error: "지원하지 않는 기간입니다." }, { status: 400 });
  }
  try {
    const data = await loadDashboardData(appId);
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ data: buildActiveUserTrend(data, rawPeriod as Period) });
  } catch {
    return NextResponse.json({ error: "활성 사용자 추이를 불러오지 못했습니다." }, { status: 500 });
  }
}
