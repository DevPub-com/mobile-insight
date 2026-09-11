import { NextResponse } from "next/server";

import type { Platform } from "@/domain/types";
import { loadDashboardData } from "@/services/mobile/dashboard.service";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const query = new URL(request.url).searchParams;
  const version = query.get("version");
  const platform = query.get("platform") as Platform | null;
  if (!version) return NextResponse.json({ error: "version이 필요합니다." }, { status: 400 });
  if (platform !== "android" && platform !== "ios") {
    return NextResponse.json({ error: "platform은 android 또는 ios여야 합니다." }, { status: 400 });
  }
  try {
    const data = await loadDashboardData(appId);
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const release = data.releases.find((item) => item.version === version && item.platform === platform);
    if (!release) return NextResponse.json({ error: "릴리즈를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json({ data: buildReleaseImpactWorkspace(data, release) });
  } catch {
    return NextResponse.json({ error: "릴리즈 영향을 계산하지 못했습니다." }, { status: 500 });
  }
}
