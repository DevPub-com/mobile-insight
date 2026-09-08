import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./dashboard.repository.ts", import.meta.url),
  "utf8",
);

describe("dashboard review repository contract", () => {
  it("keeps review device fields in the dashboard response", () => {
    expect(source).toMatch(/device:\s*review\.device,/);
    expect(source).toMatch(/deviceMetadata:\s*review\.deviceMetadata/);
  });
});
