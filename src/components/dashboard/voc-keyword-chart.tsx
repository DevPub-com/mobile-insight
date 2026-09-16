"use client";

import { useMemo, useState } from "react";
import { keywordChartRows, keywordGradeLabel, type KeywordFilter, type KeywordSelection, type summarizeReviewKeywords } from "@/domain/reviews/review-keywords";

import { VocWordCloud } from "./voc-wordcloud";

export function VocKeywordChart({ groups, onSelect }: {
  groups: ReturnType<typeof summarizeReviewKeywords>;
  onSelect: (selection: KeywordSelection) => void;
}) {
  const [filter, setFilter] = useState<KeywordFilter>("all");
  const [query, setQuery] = useState("");
  const rows = useMemo(() => keywordChartRows(groups, filter).filter(row =>
    `${row.label} ${JSON.parse(row.key).filter(Boolean).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [groups, filter, query]);
  return <div className="mi-voc-visual">
    <div className="mi-voc-toolbar">
    <div className="mi-voc-filters" role="group" aria-label="키워드 감정 필터">
      {(["all", "negative", "neutral", "positive"] as const).map((value) =>
        <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
          {value === "all" ? "전체" : keywordGradeLabel[value]}
        </button>)}
    </div>
      <input type="search" aria-label="키워드 검색" placeholder="키워드 검색" value={query} onChange={event => setQuery(event.target.value)} />
    </div>
    {!rows.length ? <p className="mi-summary-caption">이 조건에 집계된 키워드가 없습니다.</p> :
      <VocWordCloud rows={rows} onSelect={row => onSelect({ label: row.label, key: row.key, grade: filter })} />}
    <p className="mi-voc-chart-note">크기는 언급량, 색은 가장 많은 감정입니다. 동률은 불만·개선·만족 순으로 색을 표시합니다. 키워드를 누르면 관련 리뷰를 볼 수 있습니다. 한 리뷰에 여러 키워드가 포함될 수 있습니다.</p>
  </div>;
}
