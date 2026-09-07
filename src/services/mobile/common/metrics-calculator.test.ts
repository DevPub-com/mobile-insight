import { describe, expect, it } from "vitest";

import { demoDashboardData } from "@/data/demo";
import { availableMetricDateRange } from "@/services/mobile/common/metrics-calculator";

describe("availableMetricDateRange", () => {
  it("returns the inclusive first and last metric dates", () => {
    expect(availableMetricDateRange(demoDashboardData)).toEqual({
      startDate: "2025-04-11",
      endDate: "2025-05-10",
      days: 30,
    });
  });

  it("returns null when no dated metrics are available", () => {
    expect(
      availableMetricDateRange({ ...demoDashboardData, metrics: [] }),
    ).toBeNull();
  });
});
