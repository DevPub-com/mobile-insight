import { expect, it } from "vitest";
import { buildActiveAudience, audienceDailyDifference } from "../tabs/active-audience.service";

it("uses daily and rolling active counts without accumulating them or replacing missing dates", () => {
  const metrics = [
    { appId: "a", platform: "android", date: "2026-09-10", active1DayUsers: 100, active28DayUsers: 500 },
    { appId: "a", platform: "android", date: "2026-09-11", active1DayUsers: 80, active28DayUsers: 480 },
    { appId: "a", platform: "android", date: "2026-09-12", active1DayUsers: null, active28DayUsers: null },
  ];
  const result = buildActiveAudience(metrics as never[], "a", { startDate: "2026-09-10", endDate: "2026-09-12" });
  expect(result.trend.map(row => row.androidDau)).toEqual([100, 80, null]);
  expect(result.latest.android).toEqual({ date: "2026-09-11", dau: 80, mau: 480 });
  expect(result.latest.ios).toBeNull();
});

it("compares exact calendar days and requires both platforms for combined differences", () => {
 const metrics=[
 {appId:"a",platform:"android",date:"2026-09-10",active1DayUsers:100,active28DayUsers:500},
 {appId:"a",platform:"android",date:"2026-09-11",active1DayUsers:80,active28DayUsers:510},
 {appId:"a",platform:"ios",date:"2026-09-10",active1DayUsers:50,active28DayUsers:200},
 {appId:"a",platform:"ios",date:"2026-09-11",active1DayUsers:60,active28DayUsers:200},
 ] as never[];
 expect(audienceDailyDifference(metrics,"a","2026-09-11","android","dau")).toBe(-20);
 expect(audienceDailyDifference(metrics,"a","2026-09-11","ios","mau")).toBe(0);
 expect(audienceDailyDifference(metrics,"a","2026-09-11","total","dau")).toBe(-10);
 expect(audienceDailyDifference(metrics.slice(0,3),"a","2026-09-11","total","dau")).toBeNull();
 expect(audienceDailyDifference(metrics,"a","2026-09-12","android","dau")).toBeNull();
});
