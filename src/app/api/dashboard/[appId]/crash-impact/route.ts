import { NextResponse } from 'next/server';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { apps, metricObservations } from '@/db/schema';
import { storedCrashImpact, CRASH_IMPACT_KEY } from '@/services/firebase/stored-crash-impact';
import { dateRangeDays, shiftDate } from '@/services/mobile/common/metrics-calculator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
function validDate(value:string|null): value is string {
  if(!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export async function GET(request:Request,{params}:{params:Promise<{appId:string}>}) {
  const query = new URL(request.url).searchParams;
  const from = query.get('from'), to = query.get('to');
  if(!validDate(from) || !validDate(to) || from > to || dateRangeDays({startDate:from,endDate:to}) > 366) {
    return NextResponse.json({error:'지원하지 않는 기간입니다.'},{status:400});
  }
  try {
    const {appId} = await params;
    const [app] = await getDb().select({code:apps.code}).from(apps).where(and(eq(apps.id,appId),eq(apps.isActive,true)));
    if(!app) return NextResponse.json({error:'앱을 찾을 수 없습니다.'},{status:404});
    const rows=await getDb().select().from(metricObservations).where(and(eq(metricObservations.appId,appId),eq(metricObservations.metricKey,CRASH_IMPACT_KEY),eq(metricObservations.source,'firebase'),gte(metricObservations.date,shiftDate(from,-1)),lte(metricObservations.date,to)));
    const data=storedCrashImpact(appId,rows.map(row=>({...row,observedAt:row.observedAt.toISOString()})),{startDate:from,endDate:to});
    return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'Firebase 비율을 조회하지 못했습니다.'},{status:502}); }
}
