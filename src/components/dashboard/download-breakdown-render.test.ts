import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { demoDashboardData } from "@/data/demo";
import { parseGoogleDeviceInstalls } from "@/services/google/google-device-installs";
import { DownloadModels } from "./download-models";
import { DownloadOsShare } from "./download-os-share";

describe("download breakdown presentation", () => {
  it("renders actual model counts, both rankings, and collection limits", () => {
    const data = { ...demoDashboardData, metricObservations: parseGoogleDeviceInstalls(demoDashboardData.app.id, [
      { Date: "2026-09-01", Device: "Galaxy S26", "Daily Device Installs": "12", "Daily User Installs": "10" },
      { Date: "2026-09-01", Device: "Pixel 10", "Daily Device Installs": "0" },
      { Date: "2026-09-01", Device: "unknown", "Daily Device Installs": "9999" },
    ], "2026-09-02T00:00:00Z") };
    const html = renderToStaticMarkup(createElement(DownloadModels, { data, range: { startDate: "2026-09-01", endDate: "2026-09-02" } }));
    expect(html).toContain("많이 설치한 모델 TOP 5");
    expect(html).toContain("적게 설치한 모델 TOP 5");
    expect(html).toContain("Galaxy S26");
    expect(html).toContain("12건");
    expect(html).toContain("0건");
    expect(html).toContain("iOS 기종별 데이터 미수집");
    expect(html).toContain("모델 미확인");
    expect(html.slice(0, html.indexOf("모델별 상세"))).not.toContain("9,999");
  });
  it("renders missing OS data without a misleading 100 percent", () => {
    const html = renderToStaticMarkup(createElement(DownloadOsShare, { android: 30, ios: null }));
    expect(html).not.toContain("100.0%");
    expect(html).toContain("미수집");
  });
});
