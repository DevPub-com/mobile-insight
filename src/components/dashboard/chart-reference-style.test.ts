import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./download-chart.tsx", import.meta.url),
  "utf8",
);
const sparklineSource = readFileSync(
  new URL("./metric-sparkline.tsx", import.meta.url),
  "utf8",
);
const ratingSource = readFileSync(
  new URL("./rating-chart.tsx", import.meta.url),
  "utf8",
);
const activeUserSource = readFileSync(
  new URL("./active-user-chart.tsx", import.meta.url),
  "utf8",
);
const impactTrendSource = readFileSync(
  new URL("./release-impact-trend-chart.tsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("./dashboard-shell.tsx", import.meta.url),
  "utf8",
);
const packageJson = readFileSync(
  new URL("../../../package.json", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("reference dashboard chart style", () => {
  it("renders dashboard charts with ECharts and removes Recharts", () => {
    expect(source).toContain('from "echarts/core"');
    expect(sparklineSource).toContain('from "echarts/core"');
    expect(packageJson).toContain('"echarts"');
    expect(packageJson).not.toContain('"recharts"');
    expect(source).not.toContain('from "recharts"');
    expect(sparklineSource).not.toContain('from "recharts"');
  });

  it("matches the reference legend order, palette, solid lines, and filled circle markers", () => {
    expect(source).toContain('["전체", "total", "#8993A7"]');
    expect(source).toContain('["Android", "android", "#16B84E"]');
    expect(source).toContain('["iOS", "ios", "#8B3DFF"]');
    expect(source.indexOf('["전체", "total"')).toBeLessThan(
      source.indexOf('["Android", "android"'),
    );
    expect(ratingSource).toContain('["Android", "android", "#16B84E"]');
    expect(ratingSource).toContain('["iOS", "ios", "#8B3DFF"]');
    expect(source).toContain("symbolSize: 5");
    expect(source).toContain(
      'lineStyle: { color, width: 2.25, type: "solid" as const }',
    );
    expect(source).toContain(
      "itemStyle: { color, borderColor: color, borderWidth: 0 }",
    );
    expect(source).not.toContain('show: true,\n        position: "top"');
    expect(ratingSource).toContain("symbolSize: 5");
    expect(ratingSource).toContain("lineStyle: { color, width: 2.25 }");
    expect(ratingSource).toContain(
      "itemStyle: { color, borderColor: color, borderWidth: 0 }",
    );
    expect(activeUserSource).toContain('["Total", "total", "#8993A7", 2.4]');
    expect(activeUserSource).toContain(
      '["Android", "android", "#22A447", 1.8]',
    );
    expect(activeUserSource).toContain('["iOS", "ios", "#8B5CF6", 1.8]');
  });

  it("formats the download axis without repeating zero K labels for small datasets", () => {
    expect(source).toContain("value >= 10_000");
    expect(source).toContain("`${Number((value / 10_000).toFixed(1))}만`");
    expect(source).toContain("value >= 1_000");
    expect(source).toContain("`${Number((value / 1_000).toFixed(1))}천`");
  });

  it("centers the rating chart empty-state message", () => {
    expect(ratingSource).toContain(
      '<DpLayout align="center" justify="center" className="chart-empty">',
    );
  });

  it("matches the reference chart tick density without changing download values", () => {
    expect(source).toContain(
      "const xAxisLabelInterval = Math.max(0, Math.ceil(data.length / 8) - 1);",
    );
    expect(source).toContain("interval: xAxisLabelInterval");
    expect(source).toContain("showMinLabel: true");
    expect(source).toContain("showMaxLabel: true");
    expect(source).toContain("splitNumber: 5");
  });

  it("defines separate brand, platform, and status color tokens", () => {
    for (const declaration of [
      "--mi-brand: #4c73ec",
      "--mi-brand-strong: #3f6aeb",
      "--mi-brand-soft: #eef3fe",
      "--mi-brand-border: #e3eafd",
      "--mi-ink: #101622",
      "--mi-text-secondary: #566178",
      "--mi-muted: #8993a7",
      "--mi-border: #e3e8f0",
      "--mi-surface: #ffffff",
      "--mi-bg: #f7f9fc",
      "--mi-android: #22a447",
      "--mi-android-soft: #ecf8f0",
      "--mi-ios: #8b5cf6",
      "--mi-ios-soft: #f5f0ff",
      "--mi-success: #16a34a",
      "--mi-warning: #f59e0b",
      "--mi-danger: #ef4444",
    ]) {
      expect(globalStyles).toContain(declaration);
    }
  });

  it("colors delta states and review stars with semantic tokens", () => {
    expect(globalStyles).toMatch(
      /\.mi-change--increase\s*\{[^}]*color:\s*var\(--mi-success\);/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-change--decrease\s*\{[^}]*color:\s*var\(--mi-danger\);/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-change--flat\s*\{[^}]*color:\s*var\(--mi-warning\);/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-stars \.is-filled\s*\{[^}]*color:\s*#f5b800;/s,
    );
    expect(globalStyles).not.toMatch(/\.mi-review-meta--ios strong\s*\{/s);
    expect(dashboardSource).not.toContain('tone="orange"');
    expect(dashboardSource).toContain('tone="red"');
    expect(globalStyles).toMatch(
      /\.mi-metric-icon--red\s*\{[^}]*color:\s*var\(--mi-danger\);/s,
    );
  });

  it("uses neutral gray before and brand blue after in release impact charts", () => {
    expect(impactTrendSource).toContain(
      'lineStyle: { color: "#8993A7", width: 2 }',
    );
    expect(impactTrendSource).toContain(
      'lineStyle: { color: "#4C73EC", width: 2.5 }',
    );
  });

  it("removes KPI sparkline markers, smooths the curve, and uses a one-pixel line", () => {
    expect(sparklineSource).toContain(
      "values.every((value) => value === values[0])",
    );
    expect(sparklineSource).toMatch(
      /\?\s*\[values\[0\], values\[0\]\]\s*:\s*values/s,
    );
    expect(sparklineSource).toContain("data: chartValues");
    expect(sparklineSource).toContain("boundaryGap: false");
    expect(sparklineSource).toContain("const flatPadding = 1");
    expect(sparklineSource).toContain("min: chartValues[0] - flatPadding");
    expect(sparklineSource).toContain("max: chartValues[0] + flatPadding");
    expect(sparklineSource).toContain('origin: "start"');
    expect(sparklineSource).toContain("smooth: 0.4");
    expect(sparklineSource).toContain('symbol: "none"');
    expect(sparklineSource).toContain("showSymbol: false");
    expect(sparklineSource).not.toContain("symbolSize:");
    expect(sparklineSource).toContain(
      "lineStyle: { color: chartColor, width: 1 }",
    );
    expect(sparklineSource).not.toContain("itemStyle:");
    expect(sparklineSource).toContain("color: `${chartColor}77`");
    expect(globalStyles).toMatch(
      /\.mi-metric-card \.mi-sparkline\s*\{[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-metric-card\s*\{[^}]*align-items:\s*center;/s,
    );
    expect(globalStyles).not.toMatch(
      /\.mi-metric-card \.mi-sparkline\s*\{[^}]*bottom:\s*26px;/s,
    );
  });
});
