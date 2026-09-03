import type {
  AppInfo,
  AppRelease,
  AppReview,
  DailyMetric,
  DashboardData,
  Platform,
  SyncStatus,
} from "@/domain/types";

export const demoApp: AppInfo = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "kis",
  name: "KB스타뱅킹",
  androidPackageName: "com.kbstar.kbbank",
  iosAppId: "373742138",
  iosBundleId: "com.kbstar.kbbank",
};

export const demoApps: AppInfo[] = [
  demoApp,
  {
    id: "22222222-2222-4222-8222-222222222222",
    code: "kb-mobile",
    name: "KB국민은행 스타뱅킹",
    androidPackageName: "com.kbstar.kbbank.mobile",
    iosAppId: null,
    iosBundleId: null,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    code: "kb-pay",
    name: "KB Pay",
    androidPackageName: "com.kbcard.kbpay",
    iosAppId: null,
    iosBundleId: null,
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    code: "star-quiz",
    name: "스타퀴즈",
    androidPackageName: null,
    iosAppId: "6443571001",
    iosBundleId: "com.kbstar.quiz",
  },
];

const dates = [
  "2025-04-11",
  "2025-04-12",
  "2025-04-13",
  "2025-04-14",
  "2025-04-15",
  "2025-04-16",
  "2025-04-17",
  "2025-04-18",
  "2025-04-19",
  "2025-04-20",
  "2025-04-21",
  "2025-04-22",
  "2025-04-23",
  "2025-04-24",
  "2025-04-25",
  "2025-04-26",
  "2025-04-27",
  "2025-04-28",
  "2025-04-29",
  "2025-04-30",
  "2025-05-01",
  "2025-05-02",
  "2025-05-03",
  "2025-05-04",
  "2025-05-05",
  "2025-05-06",
  "2025-05-07",
  "2025-05-08",
  "2025-05-09",
  "2025-05-10",
];
const totals = [
  24_200, 25_100, 26_300, 25_800, 27_100, 24_900, 26_600, 25_400, 27_300,
  26_100, 24_800, 26_900, 25_700, 27_500, 26_200, 25_697, 19_000, 19_200,
  19_050, 19_100, 19_300, 19_089, 20_000, 16_200, 17_800, 18_300, 20_700,
  19_100, 17_600, 19_245,
];
const android = [
  13_800, 14_200, 14_900, 14_600, 15_300, 14_100, 15_100, 14_400, 15_500,
  14_800, 14_000, 15_200, 14_500, 15_600, 14_900, 14_002, 13_000, 13_000,
  13_000, 13_000, 13_000, 13_000, 13_000, 11_000, 12_000, 12_300, 13_900,
  12_900, 11_800, 13_045,
];
const androidRatings = dates.map((_, index) =>
  index < 16
    ? 4.2 + (index % 5) * 0.01
    : [
        4.25, 4.25, 4.26, 4.25, 4.26, 4.25, 4.26, 4.28, 4.27, 4.3, 4.31, 4.3,
        4.31, 4.32,
      ][index - 16],
);
const iosRatings = dates.map((_, index) =>
  index < 16
    ? 4.27 + (index % 4) * 0.01
    : [
        4.31, 4.32, 4.32, 4.31, 4.32, 4.32, 4.33, 4.36, 4.35, 4.38, 4.4, 4.39,
        4.4, 4.41,
      ][index - 16],
);

export const demoMetrics: DailyMetric[] = dates.flatMap((date, index) =>
  (["android", "ios"] as Platform[]).map((platform) => {
    const downloads =
      platform === "android" ? android[index] : totals[index] - android[index];
    return {
      appId: demoApp.id,
      platform,
      date,
      downloads,
      rating:
        platform === "android" ? androidRatings[index] : iosRatings[index],
      ratingCount: (platform === "android" ? 84_200 : 63_100) + index * 37,
      reviewCount: Math.max(1, Math.round(downloads / 920)),
      active1DayUsers: Math.round(downloads * 0.24),
      active7DayUsers: Math.round(downloads * 0.82),
      active28DayUsers: Math.round(downloads * 2.4),
      sessions: Math.round(downloads * 0.75),
    };
  }),
);

const reviewContents = [
  "새로운 UI가 직관적이고 사용하기 편해졌어요!",
  "이체 속도가 빨라져서 너무 만족합니다.",
  "간헐적으로 앱이 종료되는 문제가 있어요.",
  "업데이트 후 메뉴를 찾기가 더 쉬워졌습니다.",
  "로그인 단계가 조금 더 간단해지면 좋겠어요.",
];

function reviewDate(daysAgo: number) {
  const date = new Date("2025-05-10T12:00:00.000Z");
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

export const demoReviews: AppReview[] = Array.from(
  { length: 52 },
  (_, index) => {
    const inCurrentWindow = index < 23;
    const windowIndex = inCurrentWindow ? index : index - 23;
    const daysAgo = (inCurrentWindow ? 0 : 7) + (windowIndex % 7);
    const rating = inCurrentWindow
      ? index === 2
        ? 2
        : index === 18
          ? 1
          : index % 4 === 1
            ? 4
            : 5
      : windowIndex < 3
        ? windowIndex === 1
          ? 2
          : 1
        : windowIndex % 5 === 0
          ? 4
          : 5;
    const platform: Platform = index % 2 === 0 ? "android" : "ios";
    return {
      id: `demo-review-${index}`,
      appId: demoApp.id,
      platform,
      externalId: `demo-${platform}-${index}`,
      rating,
      title: null,
      content: reviewContents[index % reviewContents.length],
      author: `사용자 ${String(index + 1).padStart(2, "0")}`,
      version: daysAgo < 3 ? "5.12.0" : "5.11.1",
      reviewedAt: reviewDate(daysAgo),
    };
  },
).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));

export const demoReleases: AppRelease[] = [
  {
    id: "release-a-512",
    appId: demoApp.id,
    platform: "android",
    version: "5.12.0",
    releasedAt: "2025-05-08T01:00:00.000Z",
  },
  {
    id: "release-i-512",
    appId: demoApp.id,
    platform: "ios",
    version: "5.12.0",
    releasedAt: "2025-05-08T02:00:00.000Z",
  },
  {
    id: "release-a-511",
    appId: demoApp.id,
    platform: "android",
    version: "5.11.1",
    releasedAt: "2025-04-24T01:00:00.000Z",
  },
  {
    id: "release-i-511",
    appId: demoApp.id,
    platform: "ios",
    version: "5.11.0",
    releasedAt: "2025-04-24T02:00:00.000Z",
  },
];

export const demoSyncRuns: SyncStatus[] = (
  ["android", "ios"] as Platform[]
).map((platform) => ({
  platform,
  syncType: "all",
  status: "success",
  startedAt: "2025-05-10T00:00:00.000Z",
  finishedAt: "2025-05-10T00:03:00.000Z",
  recordsCount: 128,
  errorMessage: null,
}));

export const demoDashboardData: DashboardData = {
  apps: demoApps,
  app: demoApp,
  metrics: demoMetrics,
  reviews: demoReviews,
  releases: demoReleases,
  syncRuns: demoSyncRuns,
  source: "demo",
};
