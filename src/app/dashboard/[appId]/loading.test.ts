import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./loading.tsx", import.meta.url), "utf8");
const styles = readFileSync(
  new URL("../../globals.css", import.meta.url),
  "utf8",
);

describe("dashboard loading UI", () => {
  it("preserves the dashboard shell while data is loading", () => {
    expect(source).toContain('className="mi-loading-shell"');
    expect(source).toContain('className="mi-loading-sidebar"');
    expect(source).toContain('className="mi-loading-workspace"');
    expect(source).toContain('className="mi-loading-header"');
    expect(source).toContain('className="mi-loading-kpis"');
    expect(source).toContain('className="mi-loading-panels"');
    expect(source).toContain("length: 4");
    expect(source).toContain('aria-busy="true"');
    expect(source).toContain('aria-label="대시보드 데이터를 불러오는 중"');
    expect(source).not.toContain('className="loading-bar"');
    expect(source).not.toContain('className="loading-grid"');
  });

  it("uses the dashboard palette, a restrained shimmer, and reduced-motion fallback", () => {
    expect(styles).toMatch(
      /\.mi-loading-shell\s*\{[^}]*background:\s*var\(--mi-bg\);/s,
    );
    expect(styles).toMatch(
      /\.mi-loading-sidebar\s*\{[^}]*width:\s*280px;[^}]*background:\s*var\(--mi-surface\);/s,
    );
    expect(styles).toContain("@keyframes mi-loading-shimmer");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.mi-loading-block::after\s*\{[^}]*animation:\s*mi-loading-shimmer/s,
    );
  });
});
