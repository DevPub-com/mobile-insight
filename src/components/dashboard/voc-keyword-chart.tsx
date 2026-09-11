"use client";

import { useState } from "react";
import { keywordChartRows, keywordGradeLabel, type KeywordFilter, type KeywordSelection, type summarizeReviewKeywords } from "@/domain/reviews/review-keywords";

const grades = ["positive", "neutral", "negative"] as const;

export function VocKeywordChart({ groups, onSelect }: {
  groups: ReturnType<typeof summarizeReviewKeywords>;
  onSelect: (selection: KeywordSelection) => void;
}) {
  const [filter, setFilter] = useState<KeywordFilter>("all");
  const rows = keywordChartRows(groups, filter);
  const top = rows.slice(0, 7);
  const maximum = Math.max(1, ...top.map((row) => row.total));
  const chips = groups.filter((group) => filter === "all" || group.grade === filter);
  return <div className="mi-voc-visual">
    <div className="mi-voc-filters" role="group" aria-label="키워드 감정 필터">
      {(["all", "negative", "neutral", "positive"] as const).map((value) =>
        <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
          {value === "all" ? "전체" : keywordGradeLabel[value]}
        </button>)}
    </div>
    <div className="mi-voc-chart-heading"><strong>많이 언급된 키워드 TOP 7</strong><span>언급 리뷰 수</span></div>
    {top.length ? <ol className="mi-voc-chart" aria-label="키워드별 감정 분포">
      {top.map((row) => <li key={row.label}>
        <button type="button" className="mi-voc-chart-row" onClick={() => onSelect({ label: row.label, grade: filter })}
          aria-label={`${row.label}: ${row.total}개 리뷰 · ${grades.map((grade) => `${keywordGradeLabel[grade]} ${row[grade]}`).join(", ")} · 관련 리뷰 보기`}>
          <span className="mi-voc-chart-label">{row.label}</span>
          <span className="mi-voc-chart-track" aria-hidden="true">
            {grades.map((grade) => row[grade] > 0 && <span key={grade} className={`mi-voc-chart-segment is-${grade}`} style={{ width: `${row[grade] / maximum * 100}%` }} />)}
          </span>
          <strong>{row.total}</strong>
        </button>
      </li>)}
    </ol> : <p className="mi-summary-caption">이 조건에 집계된 키워드가 없습니다.</p>}
    <p className="mi-voc-chart-note">키워드를 누르면 관련 리뷰를 볼 수 있습니다. 한 리뷰에 여러 키워드가 포함될 수 있습니다.</p>
    {chips.length > 0 && <details className="mi-voc-keyword-details">
      <summary>전체 키워드 보기 <span>{rows.length}개</span></summary>
      <div className="mi-voc-keyword-buttons">{chips.map(({ label, grade, count }) =>
        <button type="button" key={`${grade}:${label}`} className={`mi-ai-topic-chip is-${grade}`} onClick={() => onSelect({ label, grade })}
          aria-label={`${label} · ${keywordGradeLabel[grade]} ${count}개 리뷰 보기`}>
          {label} <small>{count}</small>
        </button>)}</div>
    </details>}
  </div>;
}
