"use client";

import { useMemo, useState } from "react";
import { DpCard } from "@/components/ui/dp/DpCard";
import { DpText } from "@/components/ui/dp/DpText";
import type { DashboardData } from "@/domain/types";
import { googleDeviceLabel } from "@/domain/google-device-label";
import { buildModelDownloads, buildModelInstallRanking, type ModelDownloadRow } from "@/services/mobile/tabs/download-breakdown.service";
import type { MetricDateRange } from "@/services/mobile/common/metrics-calculator";

const count = (value: number | null) => value === null ? "미수집" : value === 0 ? "—" : value.toLocaleString("ko-KR");

function Ranking({ title, rows }: { title: string; rows: Pick<ModelDownloadRow, "model" | "installs">[] }) {
  const maximum = Math.max(1, ...rows.map((row) => row.installs ?? 0));
  return (
    <DpCard className="mi-panel p-5">
      <DpText as="h3" className="mb-5 font-semibold">{title}</DpText>
      {rows.length ? <ol className="space-y-4">
        {rows.map((row, index) => <li key={row.model}>
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words"><span className="mr-2 text-slate-400">{index + 1}</span>{row.model}</span>
            <strong className="shrink-0 tabular-nums">{count(row.installs)}건</strong>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100" aria-hidden="true"><div className="h-full rounded-full bg-blue-400" style={{ width: `${((row.installs ?? 0) / maximum) * 100}%` }} /></div>
        </li>)}
      </ol> : <DpText className="mi-empty">선택 기간의 기종별 설치 데이터가 없습니다.</DpText>}
    </DpCard>
  );
}

export function DownloadModels({ data, range }: { data: DashboardData; range: MetricDateRange }) {
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState("desc");
  const [expanded, setExpanded] = useState(false);
  const rows = useMemo(() => buildModelDownloads(data.modelDownloadObservations ?? data.metricObservations ?? [], range, data.app.id), [data.modelDownloadObservations, data.metricObservations, data.app.id, range]);
  const displayModel = googleDeviceLabel;
  const visibleRows = rows.filter((row) => (row.installs ?? 0) > 0 || (row.downloads ?? 0) > 0);
  const ranked = buildModelInstallRanking(visibleRows);
  const ascending = [...ranked].sort((a, b) => a.installs! - b.installs! || a.model.localeCompare(b.model));
  const filtered = visibleRows.filter((row) => displayModel(row.model).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => {
      if (a.installs === null) return b.installs === null ? a.model.localeCompare(b.model) : 1;
      if (b.installs === null) return -1;
      return (order === "asc" ? a.installs - b.installs : b.installs - a.installs) || a.model.localeCompare(b.model);
    });
  return (
    <section className="space-y-5" aria-label="모델별 다운로드 및 설치">
      <div>
        <h2 className="text-lg font-semibold">모델별 다운로드 · 설치</h2>
        <p className="mt-1 text-sm text-slate-500">{range.startDate} ~ {range.endDate} 합계 · Google Play 기종별 보고서 · iOS 기종별 데이터 미수집</p>
        <p className="mt-1 text-xs text-slate-500">순위는 이용자 수가 아닌 기간 내 기기 설치 건수입니다. 공식 목록에서 같은 제품으로 확인된 기기 코드는 합산합니다. 설치가 1건 이상인 기종만 순위에 표시합니다. 모델명은 Google 공식 기기 목록 기준이며, 여러 모델이 공유하거나 확인되지 않은 코드는 별도로 안내합니다.</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Ranking title="많이 설치한 모델 TOP 5" rows={ranked.slice(0, 5)} />
        <Ranking title="적게 설치한 모델 TOP 5" rows={ascending.slice(0, 5)} />
      </div>
      <DpCard className="mi-panel p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">모델별 상세 <span className="text-sm font-normal text-slate-400">{filtered.length}개</span></h3>
          <div className="flex flex-wrap gap-2">
            <input aria-label="모델 검색" placeholder="모델 검색" value={query} onChange={(event) => { setQuery(event.target.value); setExpanded(false); }} className="max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select aria-label="설치 수 정렬" value={order} onChange={(event) => setOrder(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="desc">설치 많은 순</option><option value="asc">설치 적은 순</option>
            </select>
          </div>
        </div>
        {rows.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-slate-500">{["모델", "OS", "다운로드", "설치", "수집 일수"].map((label) => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{(expanded ? filtered : filtered.slice(0, 20)).map((row) => <tr key={`${row.platform}:${row.model}`} className="border-b border-slate-100">
              <th scope="row" className="max-w-64 break-words px-3 py-3 font-medium">{displayModel(row.model)}</th>
              <td className="px-3 py-3">{row.platform === "android" ? "Android" : "iOS"}</td>
              <td className="px-3 py-3 tabular-nums">{count(row.downloads)}</td><td className="px-3 py-3 tabular-nums">{count(row.installs)}</td><td className="px-3 py-3">{row.days}일</td>
            </tr>)}</tbody>
          </table>
          {!filtered.length && <p className="py-8 text-center text-sm text-slate-500">검색 결과가 없습니다.</p>}
        </div> : <p className="py-8 text-center text-sm text-slate-500">기종별 보고서가 아직 수집되지 않았습니다. 데이터 동기화 후 확인할 수 있습니다.</p>}
        {filtered.length > 20 && <button type="button" onClick={() => setExpanded(!expanded)} className="mt-4 self-center rounded-lg border border-slate-200 px-4 py-2 text-sm">{expanded ? "접기" : `${filtered.length}개 모델 모두 보기`}</button>}
        <p className="mt-4 text-xs text-slate-500">다운로드: 일별 사용자 설치 합계 · 설치: 일별 기기 설치 합계 · 다운로드와 설치가 모두 0건이거나 미수집인 기종은 표시하지 않습니다.</p>
      </DpCard>
    </section>
  );
}
