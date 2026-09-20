import { NextResponse } from "next/server";
import { parseReviewQuery } from "@/contracts/review-query";
import { getReviewPage } from "@/db/review.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  let query;
  try { query = parseReviewQuery(new URL(request.url).searchParams); }
  catch { return NextResponse.json({ error: "지원하지 않는 리뷰 조회 조건입니다." }, { status: 400 }); }
  try {
    const { appId } = await params;
    const result = await getReviewPage(appId, query);
    if (!result) return NextResponse.json({ error: "앱을 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "리뷰를 불러오지 못했습니다." }, { status: 500 });
  }
}
