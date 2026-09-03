import type {
  AppleCustomerReview,
  AppleRatingLookup,
  AppleReviewResponse,
} from "@/domain/models/apple.model";
import type { AppReview, DailyMetric, RatingSnapshot } from "@/domain/types";

export type {
  AppleCustomerReview,
  AppleRatingLookup,
} from "@/domain/models/apple.model";

export function toAppleRatingMetric(
  appId: string,
  date: string,
  result: AppleRatingLookup,
): DailyMetric | null {
  const rating = result.averageUserRating;
  if (typeof rating !== "number" || rating <= 0 || rating > 5) {
    return null;
  }
  return {
    appId,
    platform: "ios",
    date,
    downloads: null,
    rating,
    ratingCount:
      typeof result.userRatingCount === "number" && result.userRatingCount >= 0
        ? result.userRatingCount
        : null,
    reviewCount: null,
    active1DayUsers: null,
    active7DayUsers: null,
    active28DayUsers: null,
    sessions: null,
  };
}

export function toAppleRatingReport(
  appId: string,
  date: string,
  territory: string,
  result: AppleRatingLookup,
  observedAt = new Date().toISOString(),
): { metric: DailyMetric; snapshot: RatingSnapshot } | null {
  const metric = toAppleRatingMetric(appId, date, result);
  if (!metric || metric.rating === null) return null;
  return {
    metric,
    snapshot: {
      appId,
      platform: "ios",
      territory,
      date,
      averageRating: metric.rating,
      ratingCount: metric.ratingCount,
      source: "mobile_insight",
      quality: "derived",
      observedAt,
      description: "Snapshot of the public App Store lookup aggregate.",
    },
  };
}

export function toAppleVersionReviews(
  appId: string,
  version: string,
  reviews: AppleCustomerReview[],
): AppReview[] {
  return reviews.map((review) => ({
    id: review.id,
    appId,
    platform: "ios",
    externalId: review.id,
    rating: review.attributes.rating,
    title: review.attributes.title ?? null,
    content: review.attributes.body,
    author: review.attributes.reviewerNickname ?? null,
    version,
    reviewedAt: new Date(review.attributes.createdDate).toISOString(),
  }));
}

export function toAppleAppReviews(
  appId: string,
  reviews: AppleCustomerReview[],
  observedAt = new Date().toISOString(),
): AppReview[] {
  return reviews.map((review) => ({
    id: review.id,
    appId,
    platform: "ios",
    externalId: review.id,
    rating: review.attributes.rating,
    title: review.attributes.title ?? null,
    content: review.attributes.body,
    author: review.attributes.reviewerNickname ?? null,
    version: null,
    territory: review.attributes.territory ?? null,
    source: "app_store_reviews",
    quality: "exact",
    observedAt,
    reviewedAt: new Date(review.attributes.createdDate).toISOString(),
  }));
}

export async function fetchAppleAppReviews(
  appId: string,
  appleAppId: string,
  request: (path: string) => Promise<AppleReviewResponse>,
  observedAt = new Date().toISOString(),
): Promise<AppReview[]> {
  const reviewsById = new Map<string, AppReview>();
  let next: string | undefined =
    `/v1/apps/${encodeURIComponent(appleAppId)}/customerReviews?limit=200&sort=-createdDate`;
  while (next) {
    const response = await request(next);
    for (const review of toAppleAppReviews(appId, response.data, observedAt)) {
      reviewsById.set(review.externalId, review);
    }
    next = response.links?.next;
  }
  return [...reviewsById.values()];
}
