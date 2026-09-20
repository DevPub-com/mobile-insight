import { z } from "zod";
import type { KeywordSelection } from "@/domain/reviews/review-keywords";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
export const dateRangeSchema = z.object({ startDate: isoDate, endDate: isoDate }).refine(
  ({ startDate, endDate }) => startDate <= endDate && (Date.parse(endDate) - Date.parse(startDate)) / 86400000 < 366,
);
const cursorSchema = z.object({ reviewedAt: z.iso.datetime(), id: z.uuid() });
const keywordSchema = z.object({
  label: z.string().min(1).max(200),
  grade: z.enum(["all", "positive", "neutral", "negative"]),
  level: z.enum(["major", "middle", "minor"]).optional(),
  key: z.string().max(1000).optional(),
}).superRefine((value, ctx) => {
  if (!value.key) return;
  try {
    const path = JSON.parse(value.key);
    if (!Array.isArray(path) || path.length < 1 || path.length > 3 || !path.every(item => item === null || typeof item === "string")) throw Error();
  } catch { ctx.addIssue({ code: "custom", message: "Invalid keyword path" }); }
});
const querySchema = z.object({
  platform: z.enum(["android", "ios", "all"]).default("all"),
  rating: z.coerce.number().int().min(0).max(5).default(0),
  ratingGroup: z.enum(["all", "negative", "neutral", "positive"]).default("all"),
  period: z.enum(["7d", "28d", "30d", "3m", "6m", "1y", "all"]).default("30d"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  from: isoDate.optional(), to: isoDate.optional(),
  cursor: z.string().max(1000).optional(),
  keyword: z.string().max(2000).optional(),
}).superRefine((value, ctx) => {
  if ((value.from || value.to) && !dateRangeSchema.safeParse({ startDate: value.from, endDate: value.to }).success) {
    ctx.addIssue({ code: "custom", message: "Invalid date range" });
  }
  if (value.cursor && value.page !== 1) ctx.addIssue({ code: "custom", message: "Cursor and page cannot be combined" });
});

export function parseReviewQuery(params: URLSearchParams) {
  const input = querySchema.parse(Object.fromEntries(params));
  return {
    ...input,
    cursor: input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8"))) : undefined,
    keyword: input.keyword ? keywordSchema.parse(JSON.parse(input.keyword)) as KeywordSelection : undefined,
  };
}
export type ReviewQuery = ReturnType<typeof parseReviewQuery>;
