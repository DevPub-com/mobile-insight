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

  it("keeps hierarchical review topics in the dashboard response", () => {
    expect(source).toMatch(/aiTopicPaths:\s*review\.aiTopicPaths/);
    expect(source).not.toContain("review.aiTaxonomyVersion");
  });

  it("does not load device-model observations into the default dashboard payload", () => {
    expect(source).toContain('notLike(metricObservations.metricKey, "device_downloads:%")');
    expect(source).not.toContain("modelDownloadObservations:");
  });
});
