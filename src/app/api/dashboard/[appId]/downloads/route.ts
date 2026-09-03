import { NextResponse } from "next/server";

import { loadDashboardData } from "@/services/mobile/dashboard.service";
import {
  buildDownloadTrend,
  buildInstallLifecycle,
  buildPeriodSummary,
} from "@/services/mobile/tabs/downloads.service";
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
    const period = rawPeriod as Period;
    return NextResponse.json({
      data: buildDownloadTrend(data, period),
      summary: buildPeriodSummary(data, period),
      installLifecycle: buildInstallLifecycle(data, period),
      availability: {
        androidInstallLifecycle: data.metrics.some(
          (item) =>
            item.platform === "android" &&
            (item.installs != null || item.uninstalls != null),
        ),
        iosInstallLifecycle: data.metrics.some(
          (item) =>
            item.platform === "ios" &&
            (item.installs != null || item.uninstalls != null),
        ),
        crashAndAnr: data.metrics.some(
          (item) => item.crashes != null || item.anrs != null,
        ),
      },
    });
  } catch {
    return NextResponse.json({ error: "다운로드 추이를 불러오지 못했습니다." }, { status: 500 });
  }
}
