import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { DashboardData, DailyMetric } from "@/domain/types";
import { FirebaseAcquisitionPanel } from "./firebase-acquisition-panel";

vi.mock("./echart", () => ({ EChart: () => null }));

it("groups Android and iOS under one date and omits trailing empty dates", () => {
  const metric = (platform: "android" | "ios"): DailyMetric => ({
    appId: "app",
    platform,
    date: "2026-09-18",
    downloads: null,
    rating: null,
    ratingCount: null,
    reviewCount: null,
    active1DayUsers: platform === "android" ? 100 : 50,
    active7DayUsers: null,
    active28DayUsers: null,
    sessions: 10,
    newUsers: 2,
    engagedSessions: 5,
  });
  const data = {
    app: { id: "app" },
    metrics: [metric("android"), metric("ios")],
    metricObservations: [],
  } as unknown as DashboardData;

  const html = renderToStaticMarkup(createElement(FirebaseAcquisitionPanel, {
    data,
    range: { startDate: "2026-09-18", endDate: "2026-09-20" },
  }));

  expect(html.match(/2026-09-18/g)).toHaveLength(1);
  expect(html).toContain('rowSpan="2"');
  expect(html.indexOf("Android")).toBeLessThan(html.indexOf("iOS"));
  expect(html).not.toContain("2026-09-19");
  expect(html).not.toContain("2026-09-20");
});
