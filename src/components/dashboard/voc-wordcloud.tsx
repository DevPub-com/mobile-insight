"use client";

import { useEffect, useRef, useState } from "react";
import type { keywordChartRows } from "@/domain/reviews/review-keywords";
import { keywordGradeLabel } from "@/domain/reviews/review-keywords";

type Row = ReturnType<typeof keywordChartRows>[number];
const grades = ["positive", "neutral", "negative"] as const;
const colors = { positive: "#22a447", neutral: "#f59e0b", negative: "#ef4444" };
const tiePriority = ["negative", "neutral", "positive"] as const;

export function VocWordCloud({ rows, onSelect }: { rows: Row[]; onSelect: (row: Row) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState(false);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    async function render() {
      // The extension reads canvas at import time, so load it only in the browser.
      const echarts = await import("echarts/core");
      const { CanvasRenderer } = await import("echarts/renderers");
      const { TooltipComponent } = await import("echarts/components");
      await import("echarts-wordcloud");
      await document.fonts.ready;
      if (disposed || !container.current) return;
      echarts.use([CanvasRenderer, TooltipComponent]);
      const chart = echarts.init(container.current);
      const resize = new ResizeObserver(() => chart.resize());
      cleanup = () => { resize.disconnect(); chart.dispose(); };
      chart.setOption({
        tooltip: { renderMode: "richText", confine: true, formatter: (params: { dataIndex: number }) => {
          const row = rows[params.dataIndex];
          return `${JSON.parse(row.key).filter(Boolean).join(" › ")}\n언급 리뷰 ${row.total}건\n${grades.map(grade => `${keywordGradeLabel[grade]} ${row[grade]}건`).join("  ")}`;
        } },
        series: [{ type: "wordCloud", shape: "circle", left: "center", top: "center", width: "96%", height: "94%",
          sizeRange: [13, Math.min(88, container.current.clientWidth / 9)], rotationRange: [-45, 45], rotationStep: 15,
          gridSize: 3, drawOutOfBound: false, shrinkToFit: true, layoutAnimation: true,
          textStyle: { fontFamily: getComputedStyle(container.current).fontFamily, fontWeight: 700 },
          emphasis: { focus: "self", textStyle: { textShadowBlur: 8, textShadowColor: "#00000020" } },
          data: rows.map(row => {
            const dominant = tiePriority.reduce((selected, grade) => row[grade] > row[selected] ? grade : selected);
            return { name: row.label, value: row.total, textStyle: { color: colors[dominant] } };
          }),
        }],
      });
      chart.on("click", params => {
        if (typeof params.dataIndex === "number" && rows[params.dataIndex]) selectRef.current(rows[params.dataIndex]);
      });
      resize.observe(container.current);
    }
    render().catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; cleanup?.(); };
  }, [rows]);
  return <>
    {error && <p className="mi-summary-caption">키워드맵을 불러오지 못했습니다. 아래 전체 키워드 목록에서 확인해 주세요.</p>}
    <div ref={container} className="mi-voc-wordcloud" role="img" aria-label="언급량에 따른 키워드맵. 아래 전체 키워드 목록에서도 리뷰를 선택할 수 있습니다." />
    <details className="mi-voc-keyword-details">
      <summary>전체 키워드 목록 <span>{rows.length}개</span></summary>
      <div className="mi-voc-keyword-buttons">{rows.map(row => <button type="button" key={row.key}
        title={JSON.parse(row.key).filter(Boolean).join(" › ")}
        aria-label={`${row.label}: ${grades.map(grade => `${keywordGradeLabel[grade]} ${row[grade]}`).join(", ")} · 관련 리뷰 보기`}
        onClick={() => onSelect(row)}>{row.label} <small>{row.total}</small></button>)}</div>
    </details>
  </>;
}
