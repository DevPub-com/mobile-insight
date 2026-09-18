import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { loadDashboardData } from "@/services/mobile/dashboard.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{appId:string}>}):Promise<Metadata> {
  const {appId}=await params;
  const path=`/dashboard/${encodeURIComponent(appId)}`;
  const title=appId==='kis'?'한국투자 앱 | Mobile Insight':'앱 대시보드 | Mobile Insight';
  const description='Android·iOS의 활성 사용자, 평점·리뷰, 크래시와 릴리즈 성과를 한곳에서 확인하는 모바일 앱 통합 대시보드입니다.';
  return {title,description,alternates:{canonical:path},openGraph:{title,description,url:path,type:'website',locale:'ko_KR',siteName:'Mobile Insight',images:[{url:'/share-preview.png',width:1200,height:630,alt:'Mobile Insight 앱 성과 통합 대시보드'}]},twitter:{card:'summary_large_image',title,description,images:[{url:'/share-preview.png',alt:'Mobile Insight 앱 성과 통합 대시보드'}]}};
}


export default async function DashboardPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  let data;
  try {
    data = await loadDashboardData(appId);
  } catch {
    return <SetupState title="데이터 연결이 필요합니다" detail="DATABASE_URL과 migration 상태를 확인하거나, 로컬 검토 시 MOBILE_INSIGHT_DEMO_MODE=true를 설정하세요." />;
  }
  if (!data) return <SetupState title="앱을 찾을 수 없습니다" detail={`'${appId}' 앱이 active 상태로 등록되어 있는지 확인하세요.`} />;
  return <DashboardShell data={data} />;
}

function SetupState({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="setup-state">
      <div className="brand-mark">MI</div>
      <p>MOBILE INSIGHT</p>
      <h1>{title}</h1>
      <span>{detail}</span>
      <code>cp .env.example .env.local</code>
    </main>
  );
}
