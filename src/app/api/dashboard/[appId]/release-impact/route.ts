import { loadFirebaseStability } from "@/services/firebase/release-stability";
export const maxDuration = 60;
import { NextResponse } from "next/server";

import type { Platform } from "@/domain/types";
import { loadReleaseImpactData } from "@/services/mobile/dashboard.service";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";

export const dynamic = "force-dynamic";

type SharedWorkspace = { appCode: string; workspace: ReturnType<typeof buildReleaseImpactWorkspace> | null } | null;
const pendingDashboardData = new Map<string, Promise<SharedWorkspace>>();

function loadSharedDashboardData(appId: string, platform: Platform, version: string) {
  const key = JSON.stringify([appId, platform, version]);
  const existing = pendingDashboardData.get(key);
  if (existing) return existing;

  const pending = loadReleaseImpactData(appId, platform, version).then(data => {
    if (!data) return null;
    const release = data.releases.find(item => item.version === version && item.platform === platform);
    return { appCode: data.app.code, workspace: release ? buildReleaseImpactWorkspace(data, release) : null };
  });
  pendingDashboardData.set(key, pending);
  const clear = () => {
    if (pendingDashboardData.get(key) === pending) {
      pendingDashboardData.delete(key);
    }
  };
  void pending.then(clear, clear);
  return pending;
}

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
    // The stored and Firebase requests are issued together. Share their DB read
    // while it is in flight so the same multi-megabyte dataset is not loaded twice.
    const data = await loadSharedDashboardData(appId, platform, version);
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const workspace = data.workspace;
    if (!workspace) return NextResponse.json({ error: "릴리스를 찾을 수 없습니다." }, { status: 404 });
    if (query.get("stored") === "true") return NextResponse.json({ data: workspace });
    return NextResponse.json({
      data: await loadFirebaseStability(data.appCode, workspace),
    });
  } catch {
    return NextResponse.json({ error: "릴리스 영향을 계산하지 못했습니다." }, { status: 500 });
  }
}
