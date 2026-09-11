import { NextResponse } from "next/server";

import { syncAllApps } from "@/services/sync/sync-app";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ appId: string }> },
) {
  // Browser mutations must originate from the dashboard itself.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  const { appId } = await params;
  try {
    const data = await syncAllApps("all", appId);
    if (!data.length) {
      return NextResponse.json({ error: "동기화할 활성 앱이 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "동기화를 완료하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}
