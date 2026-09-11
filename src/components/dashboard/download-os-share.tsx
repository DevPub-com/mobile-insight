import { DpCard } from "@/components/ui/dp/DpCard";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { buildOsDownloadShare } from "@/services/mobile/tabs/download-breakdown.service";
import { PlatformIcon } from "./platform-icon";

export function DownloadOsShare({ android, ios }: { android: number | null; ios: number | null }) {
  const rows = buildOsDownloadShare(android, ios);
  return (
    <DpCard className="mi-panel p-5">
      <DpLayout className="mi-panel-head">
        <DpText as="h3">OS별 다운로드 점유율</DpText>
        <DpText>선택 기간의 앱 다운로드 기준 · Android / iOS</DpText>
      </DpLayout>
      <div className="grid gap-5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.platform} className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><PlatformIcon platform={row.platform} size={18} />{row.label}</span>
              <strong>{row.share === null ? "—" : `${row.share.toFixed(1)}%`}</strong>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className={`h-full rounded-full ${row.platform === "android" ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${row.share ?? 0}%` }} />
            </div>
            <p className="text-sm text-slate-500">{row.downloads === null ? "미수집" : `${row.downloads.toLocaleString("ko-KR")}건`}</p>
          </div>
        ))}
      </div>
      {rows[0].share === null && <DpText className="mt-4 text-sm text-slate-500">{android === null || ios === null ? "양쪽 OS의 다운로드 데이터가 수집되면 점유율을 표시합니다." : "선택 기간의 다운로드가 0건입니다."}</DpText>}
    </DpCard>
  );
}
