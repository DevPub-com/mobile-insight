import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getSyncSecret } from "@/lib/env";
import { syncAllApps } from "@/services/sync/sync-app";
import type { SyncScope } from "@/services/mobile/common/store-adapter";

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = getSyncSecret();
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) {
    return false;
  }
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

async function handleSync(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const searchParams = new URL(request.url).searchParams;
  const rawType = searchParams.get("type");
  const scope: SyncScope =
    rawType === "voc" || rawType === "metrics" ? rawType : "all";
  try {
    return NextResponse.json({ data: await syncAllApps(scope) });
  } catch {
    return NextResponse.json(
      { error: "동기화를 시작하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
