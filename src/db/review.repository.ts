import { and, count, desc, eq, gte, lt, lte, max, or, sql, type SQL } from "drizzle-orm";
import type { AppReview } from "@/domain/types";
import type { ReviewQuery } from "@/contracts/review-query";
import { normalizeReviewKeyword } from "@/domain/reviews/keyword-normalization";
import { GENERAL_REACTION_MIDDLE, refineGeneralOpinionPaths } from "@/domain/reviews/general-opinion";
import { periodDays } from "@/services/mobile/common/metrics-calculator";
import { addDays } from "@/lib/date";
import { joinedRows } from "./joined-rows";
import { getDb } from "./index";
import { apps, dailyMetrics, reviews } from "./schema";

export function toAppReview(review: typeof reviews.$inferSelect): AppReview {
  const mapped: AppReview = {
    id: review.id, appId: review.appId, platform: review.platform, externalId: review.externalId,
    rating: review.rating, title: review.title, content: review.content, author: review.author,
    version: review.version, device: review.device, deviceMetadata: review.deviceMetadata ?? null,
    androidOsVersion: review.androidOsVersion ?? null, reviewedAt: review.reviewedAt.toISOString(),
    aiSentiment: review.aiSentiment === "positive" || review.aiSentiment === "neutral" || review.aiSentiment === "negative" ? review.aiSentiment : null,
    aiTopics: review.aiTopics ?? null, aiTopicPaths: review.aiTopicPaths ?? null,
  };
  mapped.aiTopicPaths = refineGeneralOpinionPaths(mapped);
  mapped.aiTopics = mapped.aiTopicPaths?.map((path) => path.minor ?? path.middle ?? path.major) ?? mapped.aiTopics;
  return mapped;
}

export async function getReviewsForAnalysis(appId: string, range?: { startDate: string; endDate: string }) {
  const rows = await getDb().select().from(reviews).where(and(
    eq(reviews.appId, appId),
    range ? gte(reviews.reviewedAt, new Date(`${range.startDate}T00:00:00Z`)) : undefined,
    range ? lt(reviews.reviewedAt, new Date(`${addDays(range.endDate, 1)}T00:00:00Z`)) : undefined,
  )).orderBy(desc(reviews.reviewedAt), desc(reviews.id));
  return rows.map(toAppReview);
}

function keywordCondition(selection: NonNullable<ReviewQuery["keyword"]>): SQL {
  const paths = sql`case when jsonb_array_length(coalesce(${reviews.aiTopicPaths}, '[]'::jsonb)) > 0
    then ${reviews.aiTopicPaths} else '[{"major":"기타","middle":null,"minor":null}]'::jsonb end`;
  const path = selection.key ? JSON.parse(selection.key) as (string | null)[] : undefined;
  const levels = selection.level ? ["major", "middle", "minor"] : ["minor"];
  const selectedGeneralReaction = path?.[0] === "기타" && path[1] === GENERAL_REACTION_MIDDLE && typeof path[2] === "string"
    ? path[2] : null;
  const reviewText = sql`lower(concat(coalesce(${reviews.title}, ''), ' ', ${reviews.content}))`;
  const generalReaction = sql`case
    when ${reviewText} ~ '(감사|고맙)' then '감사'
    when ${reviewText} ~ '(좋아요|좋습니다|좋네요|좋네|(^|[^[:alnum:]])굿([^[:alnum:]]|$)|(^|[^[:alnum:]])good([^[:alnum:]]|$))' then '좋아요'
    when ${reviewText} ~ '(최고|최곱|짱)' then '최고'
    when ${reviewText} ~ '만족' then '만족'
    when ${reviewText} ~ '괜찮' then '괜찮음'
    when ${reviewText} ~ '(아쉽|별로)' then '아쉬움'
    when ${reviewText} ~ '(불만|최악|싫|뭐[[:space:]]*같|쓰레기)' then '불만'
    when ${reviews.rating} >= 4 then '만족'
    when ${reviews.rating} <= 2 then '불만'
    else '보통' end`;
  const exactPathMatch = path
    ? and(...path.map((value, index) => sql`topic ->> ${["major", "middle", "minor"][index]} is not distinct from ${value}`),
      sql`nullif(btrim(topic ->> ${["major", "middle", "minor"][path.length - 1]}), '') is not null`,
      !selection.level && path.length !== 3 ? sql`false` : undefined)
    : or(...levels.map(level => sql`topic ->> ${level} = ${normalizeReviewKeyword(selection.label)}`));
  const match = selectedGeneralReaction
    ? or(exactPathMatch, and(
      sql`topic ->> 'major' = '기타'`,
      sql`topic ->> 'middle' = '일반'`,
      sql`topic ->> 'minor' = '일반 의견'`,
      sql`${generalReaction} = ${selectedGeneralReaction}`,
    ))
    : exactPathMatch;
  const grade = sql`case when ${reviews.aiSentiment} in ('positive','neutral','negative') then ${reviews.aiSentiment}
    when ${reviews.rating} <= 2 then 'negative' when ${reviews.rating} >= 4 then 'positive' else 'neutral' end`;
  return and(sql`exists (select 1 from jsonb_array_elements(${paths}) topic where ${match})`,
    selection.grade === "all" ? undefined : sql`${grade} = ${selection.grade}`)!;
}

export async function getReviewPage(appCode: string, query: ReviewQuery) {
  const db = getDb();
  const latest = db.select({ date: max(dailyMetrics.date).as("latest_date") }).from(dailyMetrics)
    .where(eq(dailyMetrics.appId, apps.id)).as("latest_metric");
  const from = query.from ? new Date(`${query.from}T00:00:00Z`) : query.period === "all" ? undefined
    : sql`((coalesce(${latest.date}, ${new Date().toISOString().slice(0, 10)}::date) - ${periodDays[query.period] - 1}::integer)::timestamp at time zone 'UTC')`;
  const filters = and(eq(reviews.appId, apps.id),
    from ? gte(reviews.reviewedAt, from) : undefined,
    query.to ? lt(reviews.reviewedAt, new Date(`${addDays(query.to, 1)}T00:00:00Z`)) : undefined,
    query.platform === "all" ? undefined : eq(reviews.platform, query.platform),
    query.rating ? eq(reviews.rating, query.rating) : undefined,
    query.ratingGroup === "negative" ? lte(reviews.rating, 2) : query.ratingGroup === "neutral" ? eq(reviews.rating, 3) : query.ratingGroup === "positive" ? gte(reviews.rating, 4) : undefined,
    query.keyword ? keywordCondition(query.keyword) : undefined,
  );
  const afterCursor = query.cursor ? or(
    lt(reviews.reviewedAt, new Date(query.cursor.reviewedAt)),
    and(eq(reviews.reviewedAt, new Date(query.cursor.reviewedAt)), lt(reviews.id, query.cursor.id)),
  ) : undefined;
  const totals = db.select({ total: count().as("total") }).from(reviews).where(filters).as("review_totals");
  const page = joinedRows(reviews, db.select().from(reviews).where(and(filters, afterCursor))
    .orderBy(desc(reviews.reviewedAt), desc(reviews.id))
    .limit(query.pageSize + 1).offset(query.cursor ? 0 : (query.page - 1) * query.pageSize), "review_page");
  const [result] = await db.select({ total: totals.total, rows: page.rows }).from(apps)
    .leftJoinLateral(latest, sql`true`)
    .leftJoinLateral(totals, sql`true`)
    .leftJoinLateral(page, sql`true`)
    .where(and(eq(apps.code, appCode), eq(apps.isActive, true)));
  if (!result) return null;
  const rows = result.rows;
  const items = rows.slice(0, query.pageSize).map(toAppReview);
  const last = items.at(-1);
  const total = result.total ?? 0;
  return {
    data: items,
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize),
      nextCursor: rows.length > query.pageSize && last ? Buffer.from(JSON.stringify({ reviewedAt: last.reviewedAt, id: last.id })).toString("base64url") : null },
  };
}
