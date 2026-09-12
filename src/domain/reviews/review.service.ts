import type { AppReview } from "@/domain/types";

export function calculateNegativeReviewRate(ratings: number[]): number | null {
  if (ratings.length === 0) return null;

  const negativeCount = ratings.filter((rating) => rating <= 2).length;
  return (negativeCount / ratings.length) * 100;
}

export function reviewAuthorLabel(author: string | null): string {
  return author?.trim() || "이름 미제공";
}

export function reviewDeviceLabel(
  review: Pick<AppReview, "device" | "deviceMetadata">,
): string | null {
  const label = review.deviceMetadata?.productName?.trim() || review.device?.trim();
  if (!label) return null;
  return label.match(/\(([^()]+)\)\s*$/)?.[1]?.trim() || label;
}

// API levels: https://developer.android.com/guide/topics/manifest/uses-sdk-element
const androidVersions: Record<number, string> = {
  21: "5.0", 22: "5.1", 23: "6.0", 24: "7.0", 25: "7.1",
  26: "8.0", 27: "8.1", 28: "9", 29: "10", 30: "11",
  31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16", 37: "17",
};

export function reviewDeviceSpecs(
  review: Pick<AppReview, "platform" | "androidOsVersion" | "deviceMetadata">,
): string[] {
  const api = review.androidOsVersion;
  const os = review.platform === "android" && api != null && api > 0
    ? androidVersions[api] ? `Android ${androidVersions[api]}` : `Android API ${api}`
    : "OS —";
  const metadata = review.deviceMetadata;
  const width = metadata?.screenWidthPx;
  const height = metadata?.screenHeightPx;
  const screen = width != null && width > 0 && height != null && height > 0
    ? `${width} × ${height} px` : "화면 —";
  const ram = metadata?.ramMb;
  return [os, screen, ram != null && ram > 0 ? `RAM ${ram.toLocaleString("en-US")} MB` : "RAM —"];
}

export function latestNegativeReviews(
  reviews: AppReview[],
  limit = 5,
): AppReview[] {
  return [...reviews]
    .filter((review) => review.rating <= 2)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
    .slice(0, limit);
}

export function reviewTimeLabel(reviewedAt: string, now = new Date()): string {
  const reviewedTime = new Date(reviewedAt).getTime();
  const elapsed = now.getTime() - reviewedTime;
  const absoluteDate = reviewedAt.slice(0, 10).replaceAll("-", ".");

  if (!Number.isFinite(reviewedTime) || elapsed < 0) return absoluteDate;

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 24) return `${hours}시간 전`;

  return absoluteDate;
}

export function summarizeReviewRatings(ratings: number[]) {
  const total = ratings.length;
  return {
    average: total ? ratings.reduce((sum, value) => sum + value, 0) / total : null,
    total,
    positive: ratings.filter((value) => value >= 4).length,
    neutral: ratings.filter((value) => value === 3).length,
    negative: ratings.filter((value) => value <= 2).length,
  };
}
