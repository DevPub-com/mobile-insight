import { describe, expect, it } from "vitest";
import { buildStoreRatingSummary } from "../tabs/overview.service";
import type { DashboardData, MetricObservation } from "@/domain/types";

const data: DashboardData = {
  app: { id: "kis", code: "kis", name: "한국투자", androidPackageName: "example", iosAppId: "1", iosBundleId: null },
  apps: [], metrics: [], reviews: [], releases: [], syncRuns: [], source: "database",
  ratingSnapshots: [
    { appId: "kis", platform: "android", territory: "GLOBAL", date: "2026-09-02", averageRating: 3.8258, ratingCount: null, source: "google_play_gcs", quality: "exact", observedAt: "2026-09-09T14:00:00Z" },
    { appId: "kis", platform: "ios", territory: "KOR", date: "2026-09-09", averageRating: 2.94, ratingCount: 100, source: "mobile_insight", quality: "derived", observedAt: "2026-09-09T14:00:00Z" },
  ],
};
const confirmed: MetricObservation = {
  appId: "kis", platform: "android", date: "2026-09-09", metricKey: "google_play_rating", value: 4.386,
  source: "manual", quality: "exact", observedAt: "2026-09-09T14:00:00Z", description: "사용자 제공 Play Console 화면",
};

describe("store rating summary", () => {
  it("keeps the confirmed Google Play rating separate from the bulk report average", () => {
    const result = buildStoreRatingSummary({ ...data, metricObservations: [confirmed] });
    expect(result.android).toMatchObject({ value: 4.386, date: "2026-09-09", source: "manual" });
    expect(result.ios).toMatchObject({ value: 2.94, date: "2026-09-09" });
  });
  it("does not substitute the bulk average when the Google Play rating is unavailable", () => {
    expect(buildStoreRatingSummary(data).android).toBeNull();
  });
  it("selects the newest valid confirmation regardless of input order", () => {
    const observations = [confirmed, { ...confirmed, date: "2026-09-01", value: 4.2 }, { ...confirmed, date: "2026-09-10", value: 0 }];
    expect(buildStoreRatingSummary({ ...data, metricObservations: observations }).android?.value).toBe(4.386);
  });
});

it("uses one latest public observation per day within the selected range without mixing manual values", () => {
 const row={...confirmed,metricKey:"google_play_public_rating_kr",source:"mobile_insight" as const};
 const result=buildStoreRatingSummary({...data,metricObservations:[confirmed,{...row,date:"2026-09-10",value:4.1},{...row,date:"2026-09-11",value:4.2},{...row,date:"2026-09-11",value:4.3,observedAt:"2026-09-11T12:00:00Z"}]},{startDate:"2026-09-11",endDate:"2026-09-12"});
 expect(result.android?.trend).toEqual([4.3]);
 expect(result.android?.change).toBeNull();
});

it('preserves missing calendar days and small real rating changes', () => {
 const row=data.ratingSnapshots![1];
 const result=buildStoreRatingSummary({...data,ratingSnapshots:[{...row,date:'2026-09-09',averageRating:2.94467},{...row,date:'2026-09-12',averageRating:2.94562}]});
 expect(result.ios?.trend).toEqual([2.94467,null,null,2.94562]);
 expect(result.ios?.change).toBeCloseTo(0.00095,5);
});
