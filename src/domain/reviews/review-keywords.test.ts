import { describe, expect, it } from "vitest";
import type { AppReview, ReviewTopicPath } from "@/domain/types";
import {
  keywordChartRows,
  matchesKeyword,
  reviewKeywords,
  reviewTopicChips,
  summarizeReviewKeywords,
} from "./review-keywords";

const path = (
  major: ReviewTopicPath["major"],
  middle: string | null,
  minor: string | null,
): ReviewTopicPath => ({ major, middle, minor });

const review = (
  id: string,
  paths: ReviewTopicPath[] | null,
  extra: Partial<AppReview> = {},
) => ({
  id,
  appId: "app",
  platform: "android",
  externalId: id,
  aiTopicPaths: paths,
  aiTopics: ["legacy-topic-must-not-be-guessed"],
  rating: 2,
  title: null,
  content: "본문 단어로 토픽을 추론하지 않습니다",
  author: null,
  version: null,
  reviewedAt: "2026-09-01",
  ...extra,
}) as AppReview;

describe("review topic hierarchy", () => {
  it("returns minor topics for VOC aggregation with the full path key", () => {
    expect(reviewKeywords(review("1", [
      path("로그인·인증", "생체 인증", "지문 인증"),
    ]))).toEqual([{
      label: "지문 인증",
      key: '["로그인·인증","생체 인증","지문 인증"]',
      level: "minor",
      grade: "negative",
    }]);
  });

  it("exposes every available hierarchy level independently of sentiment", () => {
    expect(reviewTopicChips(review("1", [
      path("기타", null, "위젯"),
    ], { aiSentiment: "positive" }))).toEqual([
      {
        label: "기타",
        key: '["기타"]',
        level: "major",
        grade: "positive",
      },
      {
        label: "위젯",
        key: '["기타",null,"위젯"]',
        level: "minor",
        grade: "positive",
      },
    ]);
  });

  it("does not infer a hierarchy from review text or legacy flat topics", () => {
    const item = review("1", null, {
      content: "로그인과 위젯이 작동하지 않아요",
      aiTopics: ["로그인_오류", "위젯"],
    });
    expect(reviewTopicChips(item)).toEqual([{
      label: "기타",
      key: '["기타"]',
      level: "major",
      grade: "negative",
    }]);
    expect(reviewKeywords(item)).toEqual([]);
  });

  it("keeps identical minor labels distinct when their parent paths differ", () => {
    const groups = summarizeReviewKeywords([
      review("1", [path("로그인·인증", "생체 인증", "오류")]),
      review("2", [path("앱 안정성", "앱 실행", "오류")]),
    ]);
    expect(groups.map(({ label, key }) => ({ label, key }))).toEqual([
      { label: "오류", key: '["로그인·인증","생체 인증","오류"]' },
      { label: "오류", key: '["앱 안정성","앱 실행","오류"]' },
    ]);
  });

  it("counts each review once per full path and separates sentiments", () => {
    const login = path("로그인·인증", "로그인", "로그인 실패");
    const first = review("1", [login, login]);
    const groups = summarizeReviewKeywords([
      first,
      first,
      review("2", [login], { reviewedAt: "2026-09-02" }),
      review("3", [login], { rating: 5 }),
    ]);

    expect(groups.map(({ grade, count }) => ({ grade, count }))).toEqual([
      { grade: "positive", count: 1 },
      { grade: "negative", count: 2 },
    ]);
    expect(groups[1].review.id).toBe("2");
  });

  it("filters by the full hierarchy key without colliding on labels", () => {
    const item = review("1", [path("로그인·인증", "생체 인증", "오류")]);
    expect(matchesKeyword(item, {
      label: "오류",
      key: '["로그인·인증","생체 인증","오류"]',
      level: "minor",
      grade: "negative",
    })).toBe(true);
    expect(matchesKeyword(item, {
      label: "오류",
      key: '["앱 안정성","앱 실행","오류"]',
      level: "minor",
      grade: "all",
    })).toBe(false);
  });
});

describe("VOC keyword chart rows", () => {
  it("stacks matching full paths across sentiments", () => {
    const login = path("로그인·인증", "로그인", "로그인 실패");
    const groups = summarizeReviewKeywords([
      review("1", [login], { rating: 5 }),
      review("2", [login]),
      review("3", [path("속도·성능", "응답 속도", "지연")]),
      review("4", [path("속도·성능", "응답 속도", "지연")]),
      review("5", [login], { rating: 3 }),
    ]);

    expect(keywordChartRows(groups, "all")[0]).toEqual({
      label: "로그인 실패",
      key: '["로그인·인증","로그인","로그인 실패"]',
      total: 3,
      positive: 1,
      neutral: 1,
      negative: 1,
    });
    expect(keywordChartRows(groups, "negative").map(({ label, total }) => [label, total]))
      .toEqual([["지연", 2], ["로그인 실패", 1]]);
    expect(keywordChartRows([], "all")).toEqual([]);
  });
});
