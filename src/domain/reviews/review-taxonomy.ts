export const REVIEW_TOPIC_LABELS = [
  "시세·차트",
  "주문·거래",
  "로그인·인증",
  "앱 안정성",
  "속도·성능",
  "UI/UX",
  "알림",
  "계좌·자산",
  "이체·결제",
  "기능 요청",
  "기타",
] as const;

export const REVIEW_TAXONOMY_VERSION = 2;

export type ReviewTopicLabel = (typeof REVIEW_TOPIC_LABELS)[number];

export const REVIEW_TOPIC_DEFINITIONS: ReadonlyArray<{
  label: ReviewTopicLabel;
  description: string;
}> = [
  { label: "시세·차트", description: "가격·시장 데이터와 차트 조회 경험" },
  { label: "주문·거래", description: "매수·매도 주문부터 체결까지의 거래 경험" },
  { label: "로그인·인증", description: "접속, 본인 확인 및 보안 인증 과정" },
  { label: "앱 안정성", description: "실행, 충돌, 중단 등 앱의 정상 동작 여부" },
  { label: "속도·성능", description: "로딩, 응답성 및 전반적인 처리 성능" },
  { label: "UI/UX", description: "화면 구성, 탐색 및 사용 편의성" },
  { label: "알림", description: "앱이 제공하는 알림과 수신 경험" },
  { label: "계좌·자산", description: "계좌, 보유 자산 및 평가 정보" },
  { label: "이체·결제", description: "자금 이동과 결제 과정" },
  { label: "기능 요청", description: "현재 제공되지 않는 기능에 대한 요청" },
  { label: "기타", description: "위 영역에 속하지 않거나 판단할 수 없는 일반 의견" },
];

// Temporary compatibility shape for consumers that only need the major labels.
// Semantic classification belongs to the model; this list is not a word matcher.
export const REVIEW_TOPIC_GROUPS = REVIEW_TOPIC_DEFINITIONS.map(({ label }) => ({
  label,
  terms: [] as readonly string[],
}));

export function isReviewTopicLabel(value: string): value is ReviewTopicLabel {
  return (REVIEW_TOPIC_LABELS as readonly string[]).includes(value);
}

export function normalizeReviewTopic(topic: string): string {
  return topic
    .normalize("NFKC")
    .replace(/^\s*#+\s*/, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeReviewTopics(topics: string[]): string[] {
  return [...new Set(topics.map(normalizeReviewTopic).filter(Boolean))];
}

export function classifyReviewTopics(_content: string): ReviewTopicLabel[] {
  void _content;
  return ["기타"];
}
