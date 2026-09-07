import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

const shell = read("dashboard-shell.tsx");
const picker = read("date-range-picker.tsx");
const selector = read("app-selector.tsx");
const impact = read("release-impact-workspace.tsx");

describe("Koboyo dashboard icons", () => {
  it("uses the shared Koboyo icon component instead of Lucide", () => {
    for (const source of [shell, picker, selector, impact]) {
      expect(source).not.toContain('from "lucide-react"');
      expect(source).toContain("KoboyoIcon");
    }
  });

  it("maps dashboard navigation and KPI meanings to explicit Koboyo names", () => {
    for (const name of [
      "dashboard",
      "download",
      "star",
      "rocket",
      "bar-chart",
      "settings",
      "message-square",
      "shield-alert",
      "calendar",
    ]) {
      expect(`${shell}\n${picker}`).toContain(`name="${name}"`);
    }
  });

  it("loads official Koboyo SVGs through a color-inheriting mask", () => {
    const component = readFileSync(
      new URL("../ui/koboyo-icon.tsx", import.meta.url),
      "utf8",
    );

    expect(component).toContain("https://koboyo.com/icons/svg/");
    expect(component).toContain("maskImage");
    expect(component).toContain('aria-hidden="true"');
  });
});
