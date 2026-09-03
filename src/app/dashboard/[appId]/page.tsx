import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { loadDashboardData } from "@/services/mobile/dashboard.service";

export const dynamic = "force-dynamic";

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
