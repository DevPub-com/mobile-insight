import { describe, expect, it } from "vitest";

import { calculateReleaseImpact } from "./release-impact";

const metrics = [
  { date: "2026-08-17", downloads: 100, rating: 4.2 },
  { date: "2026-08-18", downloads: 100, rating: 4.2 },
  { date: "2026-08-19", downloads: 100, rating: 4.3 },
  { date: "2026-08-20", downloads: 100, rating: 4.3 },
  { date: "2026-08-21", downloads: 100, rating: 4.4 },
  { date: "2026-08-22", downloads: 100, rating: 4.4 },
  { date: "2026-08-23", downloads: 100, rating: 4.4 },
  { date: "2026-08-24", downloads: 999, rating: 1 },
  { date: "2026-08-25", downloads: 110, rating: 4.4 },
  { date: "2026-08-26", downloads: 110, rating: 4.5 },
  { date: "2026-08-27", downloads: 110, rating: 4.5 },
  { date: "2026-08-28", downloads: 110, rating: 4.5 },
  { date: "2026-08-29", downloads: 110, rating: 4.6 },
  { date: "2026-08-30", downloads: 110, rating: 4.6 },
  { date: "2026-08-31", downloads: 110, rating: 4.6 },
];

const reviews = [
  { reviewedAt: "2026-08-18", rating: 1 },
  { reviewedAt: "2026-08-19", rating: 2 },
  { reviewedAt: "2026-08-20", rating: 5 },
  { reviewedAt: "2026-08-21", rating: 4 },
  { reviewedAt: "2026-08-25", rating: 1 },
  { reviewedAt: "2026-08-26", rating: 5 },
  { reviewedAt: "2026-08-27", rating: 5 },
  { reviewedAt: "2026-08-28", rating: 4 },
  { reviewedAt: "2026-08-29", rating: 5 },
];

describe("calculateReleaseImpact", () => {
  it("compares configurable windows and excludes release day", () => {
    const impact = calculateReleaseImpact({
      releasedAt: "2026-08-24",
      metrics,
      reviews,
      beforeDays: 7,
      afterDays: 7,
    });

    expect(impact.downloads).toEqual({ before: 700, after: 770, changePercent: 10 });
    expect(impact.rating.before).toBeCloseTo(4.31, 2);
    expect(impact.rating.after).toBeCloseTo(4.53, 2);
    expect(impact.negativeReviews).toEqual({ before: 50, after: 20, changePoints: -30 });
    expect(impact.newReviews).toEqual({ before: 4, after: 5, changePercent: 25 });
  });

  it("returns null comparisons when a window has no data", () => {
    const impact = calculateReleaseImpact({
      releasedAt: "2026-08-24",
      metrics: metrics.filter((metric) => metric.date > "2026-08-24"),
      reviews: [],
      beforeDays: 7,
      afterDays: 7,
    });

    expect(impact.downloads.before).toBeNull();
    expect(impact.downloads.changePercent).toBeNull();
    expect(impact.negativeReviews.before).toBeNull();
  });

  it("does not report a percent change for incomplete metric windows", () => {
    const impact = calculateReleaseImpact({
      releasedAt: "2026-08-24",
      metrics: metrics.filter((metric) => metric.date !== "2026-08-19"),
      reviews,
      beforeDays: 7,
      afterDays: 7,
    });

    expect(impact.downloads.before).toBe(600);
    expect(impact.downloads.changePercent).toBeNull();
    expect(impact.coverage.downloads).toEqual({ before: 6, after: 7, expectedBefore: 7, expectedAfter: 7 });
  });
});

it("uses review ratings when daily rating metrics are missing", () => {
  const impact = calculateReleaseImpact({
    releasedAt: "2026-09-10", beforeDays: 1, afterDays: 1, includeReleaseDay: true,
    metrics: [],
    reviews: [{ reviewedAt: "2026-09-09", rating: 4 }, { reviewedAt: "2026-09-10", rating: 1 }, { reviewedAt: "2026-09-10", rating: 2 }, { reviewedAt: "2026-09-11", rating: 5 }],
  });
  expect(impact.newReviews.after).toBe(2);
  expect(impact.rating).toEqual({ before: 4, after: 1.5 });
});
