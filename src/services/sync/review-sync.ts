import type {
  AppReview,
  ReviewSentiment,
  ReviewTopicPath,
} from "@/domain/types";

type ReviewAnalysis = {
  sentiment: ReviewSentiment;
  topics: string[];
  topicPaths?: ReviewTopicPath[] | null;
  taxonomyVersion?: number | null;
  summary: string;
};

export function toReviewInsertValue(
  review: AppReview,
  analysis?: ReviewAnalysis,
) {
  const hasVersionedTaxonomy = analysis?.taxonomyVersion != null;

  return {
    appId: review.appId,
    platform: review.platform,
    externalId: review.externalId,
    rating: review.rating,
    title: review.title,
    content: review.content,
    author: review.author,
    version: review.version,
    device: review.device,
    deviceMetadata: review.deviceMetadata,
    androidOsVersion: review.androidOsVersion,
    thumbsUpCount: review.thumbsUpCount,
    thumbsDownCount: review.thumbsDownCount,
    reviewedAt: new Date(review.reviewedAt),
    aiSentiment: analysis?.sentiment ?? null,
    aiTopics: analysis?.topics ?? null,
    aiTopicPaths: hasVersionedTaxonomy ? analysis?.topicPaths ?? null : null,
  };
}
