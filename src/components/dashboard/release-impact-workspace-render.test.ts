import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { demoDashboardData } from "@/data/demo";
import { ReleaseImpactWorkspace } from "./release-impact-workspace";
vi.mock("./echart", () => ({ EChart: () => null }));
describe("release impact while review details are deferred", () => {
  it("does not display empty review counts as real data while loading", () => {
    const html = renderToStaticMarkup(createElement(ReleaseImpactWorkspace, {
      data: { ...demoDashboardData, reviews: [], reviewsDeferred: true },
    }));
    expect(html).toContain("배포 영향 데이터를 불러오는 중");
    expect(html).not.toContain("수집 리뷰 0건");
  });
  it("still renders the existing local-data workspace", () => {
    const html = renderToStaticMarkup(createElement(ReleaseImpactWorkspace, { data: demoDashboardData }));
    expect(html).toContain("버전 리뷰 평점");
    expect(html).toContain("배포 후 다운로드");
  });

  it("distinguishes zero reviews from a pending download report", () => {
    const html = renderToStaticMarkup(createElement(ReleaseImpactWorkspace, {
      data: {
        ...demoDashboardData,
        reviews: [],
        metrics: demoDashboardData.metrics.map((item) => ({ ...item, downloads: null })),
        metricObservations: demoDashboardData.metricObservations?.filter((item) =>
          !["daily_user_installs", "first_time_downloads"].includes(item.metricKey)),
      },
    }));
    expect(html).toContain("리뷰 0건");
    expect(html).toContain("보고서 준비 중");
    expect(html).not.toContain("수집 데이터 없음");
  });
});
