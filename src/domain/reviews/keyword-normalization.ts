import { normalizeReviewTopic, normalizeReviewTopics } from "./review-taxonomy";

export function normalizeReviewKeyword(topic: string): string {
  return normalizeReviewTopic(topic);
}

export function normalizeReviewKeywords(topics: string[]): string[] {
  return normalizeReviewTopics(topics);
}
