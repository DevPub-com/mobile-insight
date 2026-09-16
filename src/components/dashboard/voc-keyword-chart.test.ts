import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { VocKeywordChart } from "./voc-keyword-chart";
import { summarizeReviewKeywords } from "@/domain/reviews/review-keywords";
import { REVIEW_TOPIC_LABELS } from "@/domain/reviews/review-taxonomy";
import type { AppReview } from "@/domain/types";

it("shows packed word cloud with accessible sentiment counts and no rank tab", () => {
  const groups = summarizeReviewKeywords(Array.from({ length: 9 }, (_, index) => ({
    id: `${index}`,
    aiTopicPaths: [{
      major: REVIEW_TOPIC_LABELS[index],
      middle: `중분류 ${index}`,
      minor: `소분류 ${index}`,
    }],
    rating: 2,
    reviewedAt: "2026-09-11",
  }) as AppReview));
  const html = renderToStaticMarkup(createElement(VocKeywordChart, { groups, onSelect: () => {} }));
  expect(html).toContain("mi-voc-wordcloud");
  expect(html).toContain("전체 키워드 목록");
  expect(html).not.toContain("mi-voc-map-topic");
  expect(html).toContain("소분류 8");
  expect(html).toContain("키워드맵");
  expect(html).not.toContain("순위");
  expect(html).toContain("키워드 검색");
  expect(html).not.toContain("<details open");
  expect(html).toContain("만족 0, 개선 0, 불만 1");
  expect(html).toContain('aria-pressed="true"');
});

it("explains when a period contains no keywords", () => {
  const html = renderToStaticMarkup(createElement(VocKeywordChart, { groups: [], onSelect: () => {} }));
  expect(html).toContain("이 조건에 집계된 키워드가 없습니다.");
  expect(html).not.toContain("<details");
});
