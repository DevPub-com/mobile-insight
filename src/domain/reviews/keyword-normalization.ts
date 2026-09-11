// Normalize labels at both ingestion and read time so historical topics also
// participate in the same counts and review filters without rewriting reviews.
export function normalizeReviewKeyword(topic: string): string {
  const label = topic.normalize("NFKC").replace(/^\s*#+/, "").trim();
  const compact = label.toLowerCase().replace(/[\s_·/.-]+/g, "");
  const error = "(?:오류|에러|실패|불가|불능|안됨|안돼요|안되요|안됨현상|문제|장애)";
  if (new RegExp(`^(?:앱|어플|어플리케이션|애플리케이션)?(?:실행|구동|시작)${error}$`).test(compact)
      || /^(?:앱|어플)?(?:실행시|실행후|시작시)(?:튕김|꺼짐|강제종료|멈춤)$/.test(compact)) return "앱실행_오류";
  if (new RegExp(`^(?:자동)?로그인${error}$`).test(compact)) return "로그인_오류";
  if (/^(?:로딩|응답|반응)(?:지연|느림|느려짐|속도저하)$/.test(compact)) return "속도_지연";
  if (/^(?:앱|어플)?(?:속도저하|속도느림|성능저하)$/.test(compact)) return "속도_지연";
  if (/^(?:푸시|알림|푸시알림)(?:미수신|수신불가|안옴|오류)$/.test(compact)) return "알림_미수신";
  return label.replace(/[\s_-]+/g, "_");
}

export function normalizeReviewKeywords(topics: string[]): string[] {
  return [...new Set(topics.map(normalizeReviewKeyword).filter(Boolean))];
}
