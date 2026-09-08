import type { AppReview, ReviewSentiment } from "@/domain/types";

type ReviewAnalysis = {
  sentiment: ReviewSentiment;
  topics: string[];
  summary: string;
};

export function toReviewInsertValue(
  review: AppReview,
  analysis?: ReviewAnalysis,
) {
  return {
    appId: review.appId,
    platform: review.platform,
    externalId: review.externalId,
    rating: review.rating,
    title: review.title,
    content: review.content,
    author: review.author,
    version: review.version,
    territory: review.territory,
    device: review.device,
    deviceMetadata: review.deviceMetadata,
    androidOsVersion: review.androidOsVersion,
    appVersionCode: review.appVersionCode,
    reviewerLanguage: review.reviewerLanguage,
    thumbsUpCount: review.thumbsUpCount,
    thumbsDownCount: review.thumbsDownCount,
    source: review.source,
    quality: review.quality,
    observedAt: review.observedAt ? new Date(review.observedAt) : undefined,
    description: review.description,
    reviewedAt: new Date(review.reviewedAt),
    aiSentiment: analysis?.sentiment ?? null,
    aiTopics: analysis?.topics ?? null,
    aiSummary: analysis?.summary ?? null,
  };
}
