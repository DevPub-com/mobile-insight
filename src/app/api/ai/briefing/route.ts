import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { aiInsightsCache } from "@/db/schema";
import { upsertAiInsightsCache } from "@/db/upsert";
import { getDefaultAppCode } from "@/lib/env";
import { getDashboardData } from "@/db/dashboard.repository";
import { generateDashboardSummaryBriefing } from "@/services/ai/dashboard-summary-briefing.service";
import { generateReleaseImpactBriefing } from "@/services/ai/release-impact-briefing.service";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";
import { selectLatestMatureRelease } from "@/services/mobile/tabs/releases.service";
import { buildDateRangeSummary } from "@/services/mobile/tabs/downloads.service";
import {
  latestDate,
  periodDateRange,
} from "@/services/mobile/common/metrics-calculator";
import type {
  DashboardExecutiveAiBriefing,
  ReleaseImpactAiBriefing,
} from "@/domain/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      appId?: string;
      appCode?: string;
      type?: "dashboard_executive" | "release_impact";
      cacheKey?: string;
      periodLabel?: string;
      startDate?: string;
      endDate?: string;
      refresh?: boolean;
    };

    const type = body.type ?? "dashboard_executive";
    const cacheKey = body.cacheKey ?? "default";
    const refresh = body.refresh ?? false;
    const appCode = body.appCode ?? getDefaultAppCode();

    const data = await getDashboardData(appCode);
    if (!data) {
      return NextResponse.json(
        { error: "Application data not found" },
        { status: 404 },
      );
    }

    const db = getDb();
    if (!refresh) {
      const [cached] = await db
        .select()
        .from(aiInsightsCache)
        .where(
          and(
            eq(aiInsightsCache.appId, data.app.id),
            eq(aiInsightsCache.insightType, type),
            eq(aiInsightsCache.cacheKey, cacheKey),
          ),
        );

      if (cached?.payload) {
        return NextResponse.json({ data: cached.payload, cached: true });
      }
    }

    if (type === "release_impact") {
      const targetRelease =
        (body.cacheKey && body.cacheKey.startsWith("release_")
          ? data.releases.find((item) => body.cacheKey?.includes(item.version))
          : null) ??
        selectLatestMatureRelease(data) ??
        data.releases[0];

      if (!targetRelease) {
        return NextResponse.json(
          { error: "No release data available for analysis" },
          { status: 400 },
        );
      }

      const workspace = buildReleaseImpactWorkspace(data, targetRelease);
      const briefing: ReleaseImpactAiBriefing =
        await generateReleaseImpactBriefing(workspace);

      await upsertAiInsightsCache(db, [
        {
          appId: data.app.id,
          insightType: type,
          cacheKey,
          payload: { ...briefing },
        },
      ]);

      return NextResponse.json({ data: briefing, cached: false });
    }

    const targetRange =
      body.startDate && body.endDate
        ? { startDate: body.startDate, endDate: body.endDate }
        : periodDateRange("30d", latestDate(data));

    const summary = buildDateRangeSummary(data, targetRange);

    const briefing: DashboardExecutiveAiBriefing =
      await generateDashboardSummaryBriefing(
        data,
        summary.downloads,
        summary.downloadChangePercent,
        body.periodLabel ?? "30일",
      );

    await upsertAiInsightsCache(db, [
      {
        appId: data.app.id,
        insightType: type,
        cacheKey,
        payload: { ...briefing },
      },
    ]);

    return NextResponse.json({ data: briefing, cached: false });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate AI briefing",
      },
      { status: 500 },
    );
  }
}
