import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoDashboardData } from "@/data/demo";
import { loadDashboardData } from "@/services/mobile/dashboard.service";

import { GET } from "./route";

vi.mock("@/services/mobile/dashboard.service", () => ({
  loadDashboardData: vi.fn(),
}));

const context = { params: Promise.resolve({ appId: "kis" }) };

describe("GET /api/dashboard/[appId]/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadDashboardData).mockResolvedValue(demoDashboardData);
  });

  it("returns the complete dashboard summary contract", async () => {
    const response = await GET(
      new Request("https://example.test/api/dashboard/kis/summary?period=30d"),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.period.value).toBe("30d");
    expect(body.data.kpis.downloads.value).toBe(679_281);
    expect(body.data.charts.downloads).toHaveLength(30);
    expect(body.data.negativeReviewsTop10).toBeInstanceOf(Array);
    expect(body.data.latestReleaseImpact.platforms.android).toBeDefined();
    expect(body.data.dataQuality.crashIssues).toBe("derived");
  });

  it("rejects unsupported periods without loading dashboard data", async () => {
    const response = await GET(
      new Request("https://example.test/api/dashboard/kis/summary?period=28d"),
      context,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "지원하지 않는 기간입니다.",
    });
    expect(loadDashboardData).not.toHaveBeenCalled();
  });

  it("accepts an inclusive custom from/to range", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/dashboard/kis/summary?from=2025-04-20&to=2025-04-24",
      ),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.period).toMatchObject({
      value: "custom",
      days: 5,
      startDate: "2025-04-20",
      endDate: "2025-04-24",
    });
    expect(body.data.charts.downloads).toHaveLength(5);
  });

  it("rejects a custom range outside the dates that have dashboard data", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/dashboard/kis/summary?from=2025-04-01&to=2025-04-24",
      ),
      context,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "조회 가능한 데이터 기간을 벗어났습니다.",
      availableDateRange: {
        startDate: "2025-04-11",
        endDate: "2025-05-10",
        days: 30,
      },
    });
  });

  it("rejects a preset period longer than the available data", async () => {
    const response = await GET(
      new Request("https://example.test/api/dashboard/kis/summary?period=3m"),
      context,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "조회 가능한 데이터 기간을 벗어났습니다.",
      availableDateRange: {
        startDate: "2025-04-11",
        endDate: "2025-05-10",
        days: 30,
      },
    });
  });

  it("rejects custom ranges when the app has no dated metrics", async () => {
    vi.mocked(loadDashboardData).mockResolvedValue({
      ...demoDashboardData,
      metrics: [],
    });

    const response = await GET(
      new Request(
        "https://example.test/api/dashboard/kis/summary?from=2025-04-20&to=2025-04-24",
      ),
      context,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "조회할 수 있는 날짜 데이터가 없습니다.",
      availableDateRange: null,
    });
  });

  it("rejects incomplete, reversed, or oversized custom ranges", async () => {
    const urls = [
      "?from=2025-04-20",
      "?from=2025-04-24&to=2025-04-20",
      "?from=2024-01-01&to=2025-04-20",
      "?from=2025-02-30&to=2025-03-02",
    ];

    for (const query of urls) {
      const response = await GET(
        new Request(`https://example.test/api/dashboard/kis/summary${query}`),
        context,
      );
      expect(response.status).toBe(400);
    }
  });
});
