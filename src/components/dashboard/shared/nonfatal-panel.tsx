"use client";
import { DpButton } from "@/components/ui/dp/DpButton";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import { useEffect, useMemo, useState, useRef } from "react";
import type {
  CustomLogData,
  CustomLogIssue,
} from "@/services/firebase/crashlytics";
import { MetricSparkline } from "../charts/metric-sparkline";
import { DpCard } from "@/components/ui/dp/DpCard";
const PAGE_SIZE = 20;
const number = (value: number) => value.toLocaleString("ko-KR");
function shortLogName(title: string) {
  const symbol = title.split(" - ").at(-1)?.trim() || title;
  const dollar = symbol.indexOf("$");
  if (dollar >= 0) return symbol.slice(0, dollar).split(".").at(-1) || symbol;
  const objc = symbol.match(/^[+-]?\[\S+\s+(.+)\]$/);
  if (objc) return objc[1];
  const paren = symbol.indexOf("(");
  const head = paren < 0 ? symbol : symbol.slice(0, paren);
  const name = head
    .slice(head.lastIndexOf(".") + 1)
    .replace(/^(?:(?:specialized|static)\s+)+/, "");
  return name + (paren < 0 ? "" : symbol.slice(paren));
}
function LogTrend({
  issue,
  start,
  color,
}: {
  issue: CustomLogIssue;
  start: string;
  color: string;
}) {
  const first = Date.parse(start.slice(0, 10));
  const last = issue.daily.at(-1)?.date;
  const days = last
    ? Math.max(1, Math.round((Date.parse(last) - first) / 86400000) + 1)
    : 1;
  const counts = new Map(issue.daily.map((d) => [d.date, d.count]));
  const values = Array.from(
    { length: days },
    (_, i) =>
      counts.get(new Date(first + i * 86400000).toISOString().slice(0, 10)) ??
      null,
  );
  return (
    <div
      className="ri-log-trend"
      title={issue.daily
        .map((d) => `${d.date}: ${number(d.count)}건`)
        .join("\n")}
    >
      <MetricSparkline values={values} color={color} smooth />
    </div>
  );
}
export function NonfatalPanel({
  appId,
  releaseId,
  platform,
  releasedAt,
}: {
  appId: string;
  releaseId: string;
  platform: string;
  releasedAt: string;
}) {
  const generation = useRef(0);
  const detailRows = useRef(new Map<string, HTMLDetailsElement>());
  const [selectedLog, setSelectedLog] = useState<{ name: string } | null>(null);
  const [data, setData] = useState<CustomLogData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [traces, setTraces] = useState<
    Record<string, { text: string; failed?: boolean }>
  >({});
  const url = `/api/dashboard/${encodeURIComponent(appId)}/nonfatal?releaseId=${encodeURIComponent(releaseId)}`;
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    fetch(url, { signal: controller.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        if (!controller.signal.aborted) {
          setData(j.data ?? null);
          setMessage(j.unavailable ?? "");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMessage(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, retry]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return (data?.issues ?? []).filter(
      (i) =>
        !q ||
        [
          i.name,
          i.cause,
          i.location,
          i.version,
          ...i.os.map((o) => o.label),
          ...i.devices.map((d) => d.label),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(q),
    );
  }, [data, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = useMemo(
    () =>
      filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage],
  );
  const chartIssues = useMemo(() => filtered.slice(0, 10), [filtered]);
  const platformColor = platform === "android" ? "#22a447" : "#8b5cf6";
  const heatmapDates = useMemo(() => {
    const start = Date.parse(releasedAt.slice(0, 10));
    const last = data?.issues
      .flatMap((i) => i.daily.map((d) => d.date))
      .sort()
      .at(-1);
    return last
      ? Array.from(
          {
            length: Math.max(
              1,
              Math.round((Date.parse(last) - start) / 86400000) + 1,
            ),
          },
          (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10),
        )
      : [];
  }, [data, releasedAt]);
  const maxTotal = Math.max(1, ...chartIssues.map((i) => i.count));
  useEffect(() => {
    if (!selectedLog) return;
    const row = detailRows.current.get(selectedLog.name);
    if (row) {
      row.open = true;
      row.scrollIntoView({ behavior: "smooth", block: "start" });
      row.querySelector("summary")?.focus({ preventScroll: true });
    }
  }, [selectedLog, currentPage]);
  function openLog(name: string) {
    setPage(0);
    setSelectedLog({ name });
  }
  async function trace(name: string) {
    const current = generation.current;
    setTraces((v) => ({ ...v, [name]: { text: "상세 로그를 불러오는 중…" } }));
    try {
      const r = await fetch(`${url}&issueId=${encodeURIComponent(name)}`);
      const j = await r.json();
      if (!r.ok) throw Error();
      if (current === generation.current)
        setTraces((v) => ({
          ...v,
          [name]: { text: j.data?.trace ?? "제공된 상세 로그가 없습니다." },
        }));
    } catch {
      if (current === generation.current)
        setTraces((v) => ({
          ...v,
          [name]: { text: "상세 로그를 불러오지 못했습니다.", failed: true },
        }));
    }
  }
  return (
    <DpCard className="ri-card ri-custom-logs">
      <DpLayout direction="row" className="ri-card-head ri-log-header">
        <div>
          <DpText as="h3" wrap="inherit">
            커스텀 로그{" "}
            <DpText
              as="span"
              wrap="inherit"
              className={`ri-log-platform is-${platform}`}
            >
              {platform === "android" ? "Android" : "iOS"}
            </DpText>
          </DpText>
          <DpText as="p" wrap="inherit">
            선택 버전에서 수집된 로그와 영향 범위를 확인하세요.
          </DpText>
        </div>
        <DpButton
          variant="custom"
          className="ri-log-button"
          type="button"
          onClick={() => {
            generation.current++;
            setLoading(true);
            setMessage("");
            setTraces({});
            setRetry((v) => v + 1);
          }}
          disabled={loading}
        >
          새로고침
        </DpButton>
      </DpLayout>
      {loading ? (
        <DpLayout display="grid" className="ri-log-loading" role="status">
          <DpText as="span" wrap="inherit">
            커스텀 로그를 불러오는 중…
          </DpText>
          <div className="ri-skeleton-line" />
          <div className="ri-skeleton-line" />
          <div className="ri-skeleton-line" />
        </DpLayout>
      ) : message ? (
        <DpText as="p" wrap="inherit" className="ri-log-empty" role="status">
          {message}
        </DpText>
      ) : (
        data && (
          <>
            <DpLayout direction="row" className="ri-log-toolbar">
              <div>
                <DpText as="strong" wrap="inherit">
                  전체 로그 {number(data.issues.length)}개
                </DpText>
                <DpText as="span" wrap="inherit">
                  발생 건수순
                </DpText>
              </div>
              <input
                type="search"
                aria-label="커스텀 로그 검색"
                placeholder="로그 내용, OS, 단말 검색"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />
            </DpLayout>
            {visible.length ? (
              <>
                <div className="ri-log-chart">
                  <DpText as="h4" wrap="inherit">
                    배포 후 로그 발생 패턴{" "}
                    <DpText as="span" wrap="inherit">
                      상위 {chartIssues.length}개 / {number(filtered.length)}개
                    </DpText>
                  </DpText>
                  <div className="ri-log-heatmap-scroll">
                    <DpLayout
                      display="grid"
                      className="ri-log-heatmap"
                      style={{
                        gridTemplateColumns: `240px repeat(${heatmapDates.length}, minmax(48px, 64px)) minmax(0, 1fr) 190px`,
                      }}
                      role="group"
                      aria-label="상위 로그 날짜별 히트맵과 합계 막대"
                    >
                      <div className="ri-heatmap-heading ri-heatmap-name">
                        로그
                      </div>
                      {heatmapDates.map((date, i) => (
                        <div
                          key={date}
                          className="ri-heatmap-heading"
                          title={date}
                        >
                          {i === 0 ? "배포일 0" : `+${i}`}
                          <DpText as="small" wrap="inherit">
                            {date.slice(5).replace("-", ".")}
                          </DpText>
                        </div>
                      ))}
                      <div aria-hidden="true" />
                      <div className="ri-heatmap-heading">총 발생 건수</div>
                      {chartIssues.map((issue) => {
                        const counts = new Map(
                          issue.daily.map((d) => [d.date, d.count]),
                        );
                        const peak = Math.max(
                          1,
                          ...issue.daily.map((d) => d.count),
                        );
                        return (
                          <div className="ri-heatmap-row" key={issue.name}>
                            <DpButton
                              variant="custom"
                              type="button"
                              className="ri-heatmap-name"
                              title={issue.cause || issue.name}
                              onClick={() => openLog(issue.name)}
                            >
                              {shortLogName(issue.cause || issue.name)}
                            </DpButton>
                            {heatmapDates.map((date) => {
                              const count = counts.get(date);
                              const strength =
                                count === undefined ? 0 : count / peak;
                              const label = `${shortLogName(issue.cause || issue.name)} · ${date} · ${count === undefined ? "기록 없음 (미발생 또는 미수집)" : `${number(count)}건`} · 상세 열기`;
                              return (
                                <DpButton
                                  variant="custom"
                                  type="button"
                                  key={date}
                                  className={`ri-heatmap-cell${count === undefined ? " is-missing" : ""}`}
                                  aria-label={label}
                                  title={label}
                                  onClick={() => openLog(issue.name)}
                                  style={
                                    count === undefined
                                      ? undefined
                                      : {
                                          backgroundColor: `color-mix(in srgb, ${platformColor} ${Math.round(8 + strength * 92)}%, white)`,
                                        }
                                  }
                                >
                                  <span className="sr-only">
                                    {count === undefined
                                      ? "기록 없음"
                                      : `${number(count)}건`}
                                  </span>
                                </DpButton>
                              );
                            })}
                            <div aria-hidden="true" />
                            <DpButton
                              variant="custom"
                              type="button"
                              className="ri-heatmap-total"
                              onClick={() => openLog(issue.name)}
                              aria-label={`${shortLogName(issue.cause || issue.name)} 합계 ${number(issue.count)}건, 상세 열기`}
                            >
                              <span className="ri-heatmap-total-track">
                                <i
                                  style={{
                                    width: `${(issue.count / maxTotal) * 100}%`,
                                    backgroundColor: platformColor,
                                  }}
                                />
                              </span>
                              <DpText as="strong" wrap="inherit">
                                {number(issue.count)}
                              </DpText>
                            </DpButton>
                          </div>
                        );
                      })}
                    </DpLayout>
                  </div>
                  <DpLayout direction="row" className="ri-heatmap-legend">
                    <DpText as="span" wrap="inherit">
                      로그별 일간 발생 강도
                    </DpText>
                    <DpText as="span" wrap="inherit">
                      낮음
                    </DpText>
                    <i
                      style={{
                        background: `linear-gradient(to right, ${platformColor}15, ${platformColor})`,
                      }}
                    />
                    <DpText as="span" wrap="inherit">
                      높음
                    </DpText>
                    <span className="ri-heatmap-missing-key" />
                    기록 없음
                    <DpText as="span" wrap="inherit">
                      총량은 오른쪽 막대로 비교 · 셀을 누르면 상세 보기
                    </DpText>
                  </DpLayout>
                </div>
                <div className="ri-log-table-wrap">
                  <div className="ri-log-table">
                    <DpLayout
                      display="grid"
                      className="ri-log-columns ri-log-table-head"
                    >
                      <DpText as="span" wrap="inherit">
                        로그
                      </DpText>
                      <DpText as="span" wrap="inherit">
                        버전
                      </DpText>
                      <DpText as="span" wrap="inherit">
                        발생 추이
                      </DpText>
                      <DpText as="span" wrap="inherit">
                        이벤트
                      </DpText>
                      <DpText
                        as="span"
                        wrap="inherit"
                        title="Crashlytics의 고유 앱 설치 ID 기준입니다. 동일 사용자의 재설치·여러 기기는 별도로 집계될 수 있습니다."
                      >
                        사용자
                      </DpText>
                    </DpLayout>
                    {visible.map((issue) => (
                      <details
                        className="ri-log-row"
                        key={issue.name}
                        ref={(node) => {
                          if (node) detailRows.current.set(issue.name, node);
                          else detailRows.current.delete(issue.name);
                        }}
                        onToggle={(e) => {
                          if (e.currentTarget.open && !traces[issue.name])
                            void trace(issue.name);
                        }}
                      >
                        <summary className="ri-log-columns">
                          <div className="ri-log-identity">
                            <DpText as="strong" wrap="inherit">
                              {issue.cause || "이름 없는 로그"}
                            </DpText>
                            <DpText as="p" wrap="inherit">
                              {issue.location}
                            </DpText>
                            <DpLayout direction="row" className="ri-log-tags">
                              <DpText as="span" wrap="inherit">
                                OS {issue.os.length}종
                              </DpText>
                              <DpText as="span" wrap="inherit">
                                단말 {issue.devices.length}종
                              </DpText>
                              <DpText as="span" wrap="inherit">
                                상세 보기 ›
                              </DpText>
                            </DpLayout>
                          </div>
                          <DpText as="span" wrap="inherit">
                            v{issue.version}
                          </DpText>
                          <LogTrend
                            issue={issue}
                            start={releasedAt}
                            color={platformColor}
                          />
                          <DpText as="strong" wrap="inherit">
                            {number(issue.count)}
                          </DpText>
                          <DpText as="strong" wrap="inherit">
                            {number(issue.users)}
                          </DpText>
                        </summary>
                        <div className="ri-log-detail">
                          <DpLayout display="grid" className="ri-log-impact">
                            <section>
                              <DpText as="h4" wrap="inherit">
                                영향받은 OS{" "}
                                <DpText as="small" wrap="inherit">
                                  이벤트 건수
                                </DpText>
                              </DpText>
                              <ul>
                                {issue.os.map((o) => (
                                  <li key={o.label}>
                                    <DpText as="span" wrap="inherit">
                                      {platform === "android"
                                        ? "Android"
                                        : "iOS"}{" "}
                                      {o.label}
                                    </DpText>
                                    <DpText as="strong" wrap="inherit">
                                      {number(o.count)}건
                                    </DpText>
                                  </li>
                                ))}
                              </ul>
                            </section>
                            <section>
                              <DpText as="h4" wrap="inherit">
                                영향받은 단말{" "}
                                <DpText as="small" wrap="inherit">
                                  이벤트 건수
                                </DpText>
                              </DpText>
                              <ul>
                                {issue.devices.map((d) => (
                                  <li key={d.label}>
                                    <DpText as="span" wrap="inherit">
                                      {d.label}
                                    </DpText>
                                    <DpText as="strong" wrap="inherit">
                                      {number(d.count)}건
                                    </DpText>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          </DpLayout>
                          <DpLayout
                            direction="row"
                            className="ri-log-trace-head"
                          >
                            <DpText as="h4" wrap="inherit">
                              상세 로그
                            </DpText>
                            {traces[issue.name]?.failed && (
                              <DpButton
                                variant="custom"
                                className="ri-log-button"
                                onClick={() => void trace(issue.name)}
                              >
                                다시 시도
                              </DpButton>
                            )}
                          </DpLayout>
                          <pre>
                            {traces[issue.name]?.text ??
                              "상세 로그를 불러오는 중…"}
                          </pre>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
                <DpLayout direction="row" className="ri-log-pagination">
                  <DpText as="span" wrap="inherit">
                    검색 결과 {number(filtered.length)}개 · {currentPage + 1} /{" "}
                    {pages} 페이지
                  </DpText>
                  <DpLayout direction="row">
                    <DpButton
                      variant="custom"
                      className="ri-log-button"
                      disabled={currentPage === 0}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      이전
                    </DpButton>
                    <DpButton
                      variant="custom"
                      className="ri-log-button"
                      disabled={currentPage >= pages - 1}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      다음
                    </DpButton>
                  </DpLayout>
                </DpLayout>
              </>
            ) : (
              <DpText as="p" wrap="inherit" className="ri-log-empty">
                {search
                  ? "검색 조건에 맞는 로그가 없습니다."
                  : "해당 버전에서 수집된 커스텀 로그가 없습니다."}
              </DpText>
            )}
          </>
        )
      )}
    </DpCard>
  );
}
