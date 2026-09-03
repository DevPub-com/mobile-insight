export function publicSyncError(message: string | null): string | null {
  if (!message) return null;
  const normalized = message.toLowerCase();
  if (normalized.includes("failed query:") || normalized.includes("postgres")) {
    return "데이터베이스 동기화에 실패했습니다.";
  }
  if (
    normalized.includes("storage.objects.list") ||
    normalized.includes("cloud storage bucket")
  ) {
    return "Google Play 보고서 버킷 읽기 권한이 없습니다.";
  }
  if (normalized.includes("403") || normalized.includes("forbidden_error")) {
    return "App Store Connect API 키에 필요한 보고서 권한이 없습니다.";
  }
  if (normalized.includes("401") || normalized.includes("not_authorized")) {
    return "App Store Connect 인증 정보가 유효하지 않습니다.";
  }
  if (normalized.includes("first report") || normalized.includes("1~2일")) {
    return "Apple Analytics 첫 보고서를 준비 중입니다. 1~2일 뒤 다시 동기화하세요.";
  }
  if (normalized.includes("credentials are not configured")) {
    return "스토어 연동 자격 증명이 설정되지 않았습니다.";
  }
  return "외부 데이터 동기화에 실패했습니다.";
}
