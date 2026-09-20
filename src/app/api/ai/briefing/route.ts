import {loadFirebaseStability} from '@/services/firebase/release-stability';
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { aiInsightsCache, apps } from "@/db/schema";
import { upsertAiInsightsCache } from "@/db/upsert";
import { getDefaultAppCode } from "@/lib/env";
import { getDashboardData, getReleaseImpactData } from "@/db/dashboard.repository";
import { generateDashboardSummaryBriefing } from "@/services/ai/dashboard-summary-briefing.service";
import { generateReleaseImpactBriefing } from "@/services/ai/release-impact-briefing.service";
import { releaseBriefingFingerprint, shareReleaseBriefing } from "@/services/ai/release-briefing-cache";
import { buildReleaseImpactWorkspace } from "@/services/mobile/tabs/release-impact.service";
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
  // Browser mutations must originate from the dashboard itself.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      appId?: string;
      releaseId?: string;
      appCode?: string;
      type?: "dashboard_executive" | "release_impact";
      cacheKey?: string;
      periodLabel?: string;
      startDate?: string;
      endDate?: string;
      refresh?: boolean;
      cacheOnly?: boolean;
    };

    const type = body.type ?? "dashboard_executive";
    const cacheKey = type === "release_impact" ? `release:firebase-v1:${body.releaseId}` : body.cacheKey ?? "default";
    const refresh = body.refresh ?? false;
    const appCode = body.appCode ?? getDefaultAppCode();

    if (type === "release_impact" && body.cacheOnly) {
      const db = getDb();
      const [cached] = await db.select({ payload: aiInsightsCache.payload })
        .from(aiInsightsCache).innerJoin(apps, eq(apps.id, aiInsightsCache.appId))
        .where(and(eq(apps.code, appCode), eq(aiInsightsCache.insightType, type), eq(aiInsightsCache.cacheKey, cacheKey)));
      const payload = cached?.payload ? { ...cached.payload } : null;
      if (payload) {
        delete payload._inputHash;
        delete payload._expiresAt;
      }
      return NextResponse.json({ data: payload, cached: !!cached });
    }

    const data = await getDashboardData(appCode, type === "release_impact" ? "releases" : "full");
    if (!data) {
      return NextResponse.json(
        { error: "Application data not found" },
        { status: 404 },
      );
    }

    const db = getDb();
    if (!refresh && type !== "release_impact") {
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
      const targetRelease = data.releases.find((item) => item.id === body.releaseId);

      if (!targetRelease) {
        return NextResponse.json(
          { error: "No release data available for analysis" },
          { status: 400 },
        );
      }

      const impactData = await getReleaseImpactData(appCode, targetRelease.platform, targetRelease.version, data);
      if (!impactData) {
        return NextResponse.json({ error: "Application data not found" }, { status: 404 });
      }
      const workspace = await loadFirebaseStability(impactData.app.code, buildReleaseImpactWorkspace(impactData, targetRelease));
      const inputHash = releaseBriefingFingerprint(workspace);
      if (!refresh) {
        const [cached] = await db.select({ payload: aiInsightsCache.payload }).from(aiInsightsCache).where(and(
          eq(aiInsightsCache.appId, data.app.id), eq(aiInsightsCache.insightType, type), eq(aiInsightsCache.cacheKey, cacheKey),
        ));
        if (cached?.payload?._inputHash === inputHash && typeof cached.payload._expiresAt === "number" && cached.payload._expiresAt > Date.now()) {
          const payload = { ...cached.payload };
          delete payload._inputHash;
          delete payload._expiresAt;
          return NextResponse.json({ data: payload, cached: true });
        }
      }
      const briefing: ReleaseImpactAiBriefing = await shareReleaseBriefing(JSON.stringify([data.app.id, cacheKey, inputHash]), async () => {
        const generated = await generateReleaseImpactBriefing(workspace);
        await upsertAiInsightsCache(db, [{ appId: data.app.id, insightType: type, cacheKey, payload: { ...generated, _inputHash: inputHash, _expiresAt: Date.now() + 30 * 60 * 1000 } }]);
        return generated;
      });
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
