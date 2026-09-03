import { NextResponse } from "next/server";

import type { Platform } from "@/domain/types";
import { loadDashboardData } from "@/services/mobile/dashboard.service";
import {
  periodStart,
  type Period,
} from "@/services/mobile/common/metrics-calculator";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const query = new URL(request.url).searchParams;
  const platform = query.get("platform") as Platform | null;
  const rating = Number(query.get("rating") ?? 0);
  const period = (query.get("period") ?? "30d") as Period;
  const page = Math.max(1, Number(query.get("page") ?? 1));
  const pageSize = 10;
  try {
    const data = await loadDashboardData(appId);
    if (!data) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    const lastDate = data.metrics.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
    const start = periodStart(period, lastDate);
    const filtered = data.reviews.filter(
      (review) =>
        review.reviewedAt.slice(0, 10) >= start &&
        (!platform || review.platform === platform) &&
        (!rating || review.rating === rating),
    );
    const offset = (page - 1) * pageSize;
    return NextResponse.json({
      data: filtered.slice(offset, offset + pageSize),
      pagination: { page, pageSize, total: filtered.length, totalPages: Math.ceil(filtered.length / pageSize) },
    });
  } catch {
    return NextResponse.json({ error: "리뷰를 불러오지 못했습니다." }, { status: 500 });
  }
}
