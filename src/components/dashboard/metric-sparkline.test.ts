import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  metricTrendTone,
  releaseImpactSparklineColor,
  resolveSparklineColor,
} from "./metric-sparkline";

const dashboardSource = readFileSync(
  new URL("./dashboard-shell.tsx", import.meta.url),
  "utf8",
);

describe("metric sparkline identity colors", () => {
  it("keeps the series identity color for a rising chart", () => {
    expect(resolveSparklineColor("#22A447")).toBe("#22A447");
    expect(resolveSparklineColor("#8B5CF6")).toBe("#8B5CF6");
    expect(resolveSparklineColor("#8993A7")).toBe("#8993A7");
    expect(metricTrendTone(1)).toBe("is-increase");
  });

  it("keeps each series color for a falling chart", () => {
    expect(resolveSparklineColor("#22A447")).toBe("#22A447");
    expect(resolveSparklineColor("#8B5CF6")).toBe("#8B5CF6");
    expect(resolveSparklineColor("#8993A7")).toBe("#8993A7");
    expect(metricTrendTone(-1)).toBe("is-decrease");
  });

  it("keeps each series color for a flat chart", () => {
    expect(resolveSparklineColor("#22A447")).toBe("#22A447");
    expect(resolveSparklineColor("#8B5CF6")).toBe("#8B5CF6");
    expect(resolveSparklineColor("#8993A7")).toBe("#8993A7");
    expect(metricTrendTone(0)).toBe("is-flat");
  });

  it("colors dashboard mini-chart deltas by direction, not desirability", () => {
    expect(dashboardSource).toContain("metricTrendTone(change)");
    expect(dashboardSource).toContain("metricTrendTone(row.change)");
    expect(dashboardSource).not.toMatch(
      /row\.lowerIsBetter\s*\?\s*row\.value\s*<=\s*0/,
    );
  });

  it("uses graphite for MAU and orange for DAU", () => {
    expect(dashboardSource).toContain('color="#F97316"');
    expect(dashboardSource).toContain('color="#4B5563"');
  });

  it("uses semantic trend colors only for release-impact mini charts", () => {
    expect(releaseImpactSparklineColor(1)).toBe("#22A447");
    expect(releaseImpactSparklineColor(-1)).toBe("#EF4444");
    expect(releaseImpactSparklineColor(0)).toBe("#F59E0B");
    expect(releaseImpactSparklineColor(null)).toBe("#8993A7");
    expect(dashboardSource).toContain(
      "color={releaseImpactSparklineColor(row.change)}",
    );
  });
});
