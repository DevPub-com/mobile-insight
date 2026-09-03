import type { AppReview } from "@/domain/types";

export const VOC_GROUPS = [
  { label: "로그인", terms: ["로그인", "인증", "접속"] },
  { label: "속도", terms: ["속도", "느려", "빠르", "로딩"] },
  { label: "UI/UX", terms: ["ui", "ux", "메뉴", "화면", "편하", "직관"] },
  { label: "안정성", terms: ["종료", "오류", "버그", "튕", "멈"] },
  { label: "이체·주문", terms: ["이체", "주문", "결제", "송금"] },
  { label: "알림", terms: ["알림", "푸시"] },
] as const;

export function contentMatchesTerms(
  content: string,
  terms: readonly string[],
): boolean {
  const normalized = content.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function countVocKeywords(reviews: AppReview[]) {
  const negative = reviews.filter((review) => review.rating <= 2);
  return VOC_GROUPS.map(({ label, terms }) => ({
    label,
    count: negative.filter((review) =>
      contentMatchesTerms(review.content, terms),
    ).length,
  })).sort((a, b) => b.count - a.count);
}
