import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { loadScriptEnv } from "../src/config/load-script-env";
import { getDb } from "../src/db";
import { reviews } from "../src/db/schema";
import { analyzeReviewsBatch } from "../src/services/ai/review-analyzer.service";
import type { AppReview } from "../src/domain/types";

loadScriptEnv();
const apply = process.argv.includes("--apply");
const limitArgument = process.argv.find(value => value.startsWith("--limit="));
const limit = Number(limitArgument?.split("=")[1] ?? 100);
if (!Number.isInteger(limit) || limit < 1 || limit > 5000) throw new Error("limit must be 1–5000");
const db = getDb();
const pending = or(isNull(reviews.aiTopicPaths), sql`jsonb_array_length(${reviews.aiTopicPaths}) = 0`);
const rows = await db.select().from(reviews).where(pending)
  .orderBy(desc(reviews.reviewedAt), desc(reviews.id)).limit(limit);
console.info(`Pending selection: ${rows.length}; apply=${apply}`);
if (apply) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  let updated = 0;
  for (let offset = 0; offset < rows.length; offset += 15) {
    const batch = rows.slice(offset, offset + 15);
    // Use database IDs for this batch to avoid cross-app external ID collisions.
    const results = await analyzeReviewsBatch(batch.map(row => ({
      ...row, externalId: row.id, reviewedAt: row.reviewedAt.toISOString(),
    })) as AppReview[]);
    for (const row of batch) {
      const result = results.get(row.id);
      if (result?.taxonomyVersion !== 2 || !result.topicPaths?.length) continue;
      const saved = await db.update(reviews).set({
        aiTopicPaths: result.topicPaths,
        aiTopics: result.topics,
        updatedAt: new Date(),
      }).where(and(
        eq(reviews.id, row.id), eq(reviews.content, row.content),
        row.title === null ? isNull(reviews.title) : eq(reviews.title, row.title),
        eq(reviews.rating, row.rating), pending,
      )).returning({ id: reviews.id });
      updated += saved.length;
    }
    console.info(`Processed ${Math.min(offset + 15, rows.length)}/${rows.length}; updated=${updated}`);
  }
  console.info(`Updated ${updated}; remaining selected=${rows.length - updated}`);
  process.exitCode = updated === rows.length ? 0 : 1;
}
