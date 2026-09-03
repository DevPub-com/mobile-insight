import { NextResponse } from "next/server";

import { loadApps } from "@/services/mobile/dashboard.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: await loadApps() });
  } catch {
    return NextResponse.json({ error: "앱 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
