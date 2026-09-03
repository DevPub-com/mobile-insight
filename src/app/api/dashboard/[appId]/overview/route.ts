import { NextResponse } from "next/server";

import { loadDashboardData } from "@/services/mobile/dashboard.service";
import { buildOverview } from "@/services/mobile/tabs/overview.service";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  try {
    const data = await loadDashboardData(appId);
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ data: buildOverview(data) });
  } catch {
    return NextResponse.json({ error: "Overview를 불러오지 못했습니다." }, { status: 500 });
  }
}
