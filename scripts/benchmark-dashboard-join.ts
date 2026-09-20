import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { getDashboardData } from "../src/db/dashboard.repository";
import { getReviewsForAnalysis } from "../src/db/review.repository";
import { dashboardReviewRange } from "../src/services/mobile/dashboard-page.service";
import { buildDashboardView, defaultDashboardRange } from "../src/services/mobile/dashboard-view";

// Read-only comparison: two scoped reads versus the existing full aggregated JOIN.
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const rangeMode of ["default", "custom"] as const) {
  const run = async (mode: "separate" | "joined") => {
    const data = await getDashboardData("kis", mode === "separate" ? "shell" : "full");
    if (!data) throw new Error("Application not found");
    const range = rangeMode === "default" ? defaultDashboardRange(data) : { startDate: "2026-09-12", endDate: "2026-09-19" };
    const reviews = mode === "separate" ? await getReviewsForAnalysis(data.app.id, dashboardReviewRange(data, range)) : data.reviews;
    return {
      view: buildDashboardView({ ...data, reviews, reviewDataTruncated: false }, range),
      reviews: reviews.length,
      decodedBytes: Buffer.byteLength(JSON.stringify({ ...data, reviews })),
    };
  };
  const baseline = await run("separate");
  const candidate = await run("joined");
  assert.deepEqual(candidate.view, baseline.view);
  const times = { separate: [] as number[], joined: [] as number[] };
  for (let round = 0; round < 7; round++) {
    for (const mode of round % 2 ? ["joined", "separate"] as const : ["separate", "joined"] as const) {
      const start = performance.now();
      await run(mode);
      times[mode].push(performance.now() - start);
    }
  }
  console.log(JSON.stringify({ rangeMode, identical: true, reviews: { separate: baseline.reviews, joined: candidate.reviews }, decodedBytes: { separate: baseline.decodedBytes, joined: candidate.decodedBytes }, medianMs: { separate: median(times.separate), joined: median(times.joined) }, times }));
}
process.exit(0);
