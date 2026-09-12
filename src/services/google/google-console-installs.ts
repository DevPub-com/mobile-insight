import { z } from "zod";

export const consoleInstallMetric = "USER_ACQUISITION-NEW-EVENTS-PER_INTERVAL-DAY";

const snapshotSchema = z.object({
  packageName: z.string().regex(/^[A-Za-z][\w]*(?:\.[\w]+)+$/),
  sourceUrl: z.string().url(),
  observedAt: z.string().datetime({ offset: true }),
  metric: z.literal(consoleInstallMetric),
  dimension: z.literal("OVERALL"),
  expectedRowCount: z.number().int().positive().max(2000),
  rows: z.array(z.object({
    date: z.iso.date(),
    value: z.number().int().nonnegative().max(2147483647),
  })).min(1),
});

export function parseConsoleInstallSnapshot(input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  const url = new URL(snapshot.sourceUrl);
  if (url.protocol !== "https:" || url.hostname !== "play.google.com" ||
      !/^\/console\/.*\/statistics$/.test(url.pathname) ||
      url.searchParams.get("metrics") !== consoleInstallMetric ||
      !url.searchParams.get("dimensionValues")?.split(",").includes("OVERALL")) {
    throw new Error("Expected a Play Console daily new-user report with global totals.");
  }
  const rows = [...snapshot.rows].sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length !== snapshot.expectedRowCount) throw new Error("Incomplete table capture.");
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].date > snapshot.observedAt.slice(0, 10)) throw new Error("Future data is not allowed.");
    if (index && Date.parse(rows[index].date) - Date.parse(rows[index - 1].date) !== 86400000) {
      throw new Error("Dates must be unique and consecutive; never fill missing values.");
    }
  }
  return { ...snapshot, rows };
}
