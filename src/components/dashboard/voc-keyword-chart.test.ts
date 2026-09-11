import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { VocKeywordChart } from "./voc-keyword-chart";
import { summarizeReviewKeywords } from "@/domain/reviews/review-keywords";
import type { AppReview } from "@/domain/types";

it("shows the top seven, accessible sentiment counts, and collapsed full keywords", () => {
  const groups = summarizeReviewKeywords(Array.from({ length: 9 }, (_, index) => ({ id: `${index}`, aiTopics: [`키워드${index}`], rating: 2, reviewedAt: "2026-09-11" }) as AppReview));
  const html = renderToStaticMarkup(createElement(VocKeywordChart, { groups, onSelect: () => {} }));
  expect(html.match(/class="mi-voc-chart-row"/g)).toHaveLength(7);
  expect(html).toContain("키워드8");
  expect(html).toContain("전체 키워드 보기");
  expect(html).not.toContain("<details open");
  expect(html).toContain("만족 0, 개선 0, 불만 1");
  expect(html).toContain('aria-pressed="true"');
});

it("explains when a period contains no keywords", () => {
  const html = renderToStaticMarkup(createElement(VocKeywordChart, { groups: [], onSelect: () => {} }));
  expect(html).toContain("이 조건에 집계된 키워드가 없습니다.");
  expect(html).not.toContain("<details");
});
