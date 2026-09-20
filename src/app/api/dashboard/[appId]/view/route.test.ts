import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoDashboardData } from "@/data/demo";
import { loadDashboardData } from "@/services/mobile/dashboard.service";
import { loadDashboardView } from "@/services/mobile/dashboard-page.service";
import { availableMetricDateRange } from "@/services/mobile/common/metrics-calculator";
import { buildDashboardView, defaultDashboardRange } from "@/services/mobile/dashboard-view";
import { GET } from "./route";
vi.mock("@/services/mobile/dashboard.service", () => ({ loadDashboardData: vi.fn() }));
vi.mock("@/services/mobile/dashboard-page.service", () => ({ loadDashboardView: vi.fn() }));
const context = { params: Promise.resolve({ appId: "kis" }) };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(loadDashboardData).mockResolvedValue(demoDashboardData); });
describe("server dashboard view", () => {
  it("returns the same range model without raw review arrays", async () => {
    const range = defaultDashboardRange(demoDashboardData);
    const view = buildDashboardView(demoDashboardData, range);
    vi.mocked(loadDashboardView).mockResolvedValue(view);
    const response = await GET(new Request(`https://example.test/api/dashboard/kis/view?from=${range.startDate}&to=${range.endDate}`), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: view });
    expect(loadDashboardData).toHaveBeenCalledWith("kis", "shell");
    expect(loadDashboardView).toHaveBeenCalledWith(demoDashboardData, range);
    expect(view).not.toHaveProperty("reviews");
  });
  it("rejects invalid dates before loading data", async () => {
    expect((await GET(new Request("https://example.test/api/dashboard/kis/view?from=2026-02-30&to=2026-03-01"), context)).status).toBe(400);
    expect(loadDashboardData).not.toHaveBeenCalled();
  });
  it("preserves the available-date boundary", async () => {
    const available = availableMetricDateRange(demoDashboardData)!;
    const response = await GET(new Request(`https://example.test/api/dashboard/kis/view?from=2000-01-01&to=2000-01-02`), context);
    expect(response.status).toBe(422);
    expect((await response.json()).availableDateRange).toEqual(available);
    expect(loadDashboardView).not.toHaveBeenCalled();
  });
});
