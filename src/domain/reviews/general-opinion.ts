import type { AppReview, ReviewTopicPath } from "@/domain/types";

export const GENERAL_REACTION_MIDDLE = "사용자 반응";
export const GENERAL_REACTION_LABELS = [
  "감사",
  "좋아요",
  "최고",
  "만족",
  "괜찮음",
  "아쉬움",
  "불만",
  "보통",
] as const;

export type GeneralReactionLabel = (typeof GENERAL_REACTION_LABELS)[number];

function isLegacyGeneralOpinion(path: ReviewTopicPath) {
  return path.major === "기타" && path.middle === "일반" && path.minor === "일반 의견";
}

export function classifyGeneralReaction(
  review: Pick<AppReview, "content" | "title" | "rating">,
): GeneralReactionLabel {
  const text = `${review.title ?? ""} ${review.content}`.normalize("NFKC").toLowerCase();
  if (/감사|고맙/.test(text)) return "감사";
  if (/좋아요|좋습니다|좋네요|좋네|굿|\bgood\b/.test(text)) return "좋아요";
  if (/최고|최곱|짱/.test(text)) return "최고";
  if (/만족/.test(text)) return "만족";
  if (/괜찮/.test(text)) return "괜찮음";
  if (/아쉽|별로/.test(text)) return "아쉬움";
  if (/불만|최악|싫|뭐\s*같|쓰레기/.test(text)) return "불만";
  if (review.rating >= 4) return "만족";
  if (review.rating <= 2) return "불만";
  return "보통";
}

export function refineGeneralOpinionPaths(
  review: Pick<AppReview, "content" | "title" | "rating"> & { aiTopicPaths?: ReviewTopicPath[] | null },
) {
  return review.aiTopicPaths?.map((path) => isLegacyGeneralOpinion(path)
    ? { major: "기타", middle: GENERAL_REACTION_MIDDLE, minor: classifyGeneralReaction(review) }
    : path) ?? null;
}
