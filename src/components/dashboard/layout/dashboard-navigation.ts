export type View =
  | "dashboard"
  | "downloads"
  | "reviews"
  | "releases"
  | "impact"
  | "apps";

export const viewCopy: Record<View, [string, string]> = {
  dashboard: ["대시보드", "앱 상태와 최신 배포 이후 변화를 한눈에 확인하세요."],
  downloads: [
    "다운로드",
    "앱의 활성 사용자, 신규 사용자, 삭제 및 참여율을 확인하세요.",
  ],
  reviews: ["평점 & 리뷰", "앱의 평점과 리뷰 데이터를 종합적으로 확인하세요."],
  releases: ["릴리스", "앱의 버전 배포 현황과 변경사항을 한눈에 확인하세요."],
  impact: [
    "배포 후 변화",
    "특정 버전의 배포 전후 성과 변화를 한눈에 분석하세요.",
  ],
  apps: ["앱 관리", "연결된 앱과 스토어를 관리하고 동기화 상태를 확인하세요."],
};

export const performancePeriodViews = new Set<View>([
  "dashboard",
  "downloads",
  "reviews",
]);
