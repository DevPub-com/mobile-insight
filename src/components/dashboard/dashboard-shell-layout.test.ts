import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./dashboard-shell.tsx", import.meta.url),
  "utf8",
);
const platformIconSource = readFileSync(
  new URL("./platform-icon.tsx", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("Mobile Insight dashboard shell layout", () => {
  it("renders the reference sidebar and all six navigation views", () => {
    expect(source).toContain('className="mi-sidebar"');
    expect(source).toContain("대시보드");
    expect(source).toContain("다운로드");
    expect(source).toContain("평점 & 리뷰");
    expect(source).toContain("릴리즈");
    expect(source).toContain("릴리즈 임팩트");
    expect(source).toContain("앱 관리");
    expect(source).toContain("일별 다운로드");
    expect(source).toContain("수집 리뷰 별점 분포");
    expect(source).toContain("주요 지표 변화");
    expect(source).toContain("앱 목록");
  });

  it("keeps the real dashboard view builders connected to the redesigned UI", () => {
    expect(source).toContain("buildPeriodSummary(data, period)");
    expect(source).toContain("buildDownloadTrend(data, period)");
    expect(source).toContain("buildRatingTrend(data, period)");
    expect(source).toContain("buildReleaseImpact(");
    expect(source).toContain('className="mi-kpi-grid"');
    expect(source).toContain('className="mi-chart-grid"');
  });

  it("renders KPI changes from the selected real-data period instead of placeholders", () => {
    expect(source).toContain('title="다운로드"');
    expect(source).toContain('useState<Period>("28d")');
    expect(source).not.toContain('buildPeriodSummary(data, "28d")');
    expect(source).not.toContain('buildDownloadTrend(data, "28d")');
    expect(source).not.toContain('buildRatingTrend(data, "28d")');
    expect(source).not.toContain('buildReviewRateTrend(data, "28d")');
    expect(source).toContain("periodSummary.downloads");
    expect(source).toContain("periodSummary.downloadChangePercent");
    expect(source).toContain("periodSummary.androidRatingChange");
    expect(source).toContain("periodSummary.iosRatingChange");
    expect(source).toContain("periodSummary.negativeReviewRateChangePoints");
    expect(source).not.toContain("<Change value={12.3}");
    expect(source).not.toContain("<Change value={1.9}");
    expect(source).not.toContain("<Change value={2.3}");
    expect(source).not.toContain("개선 중");
    expect(source).toContain("percent(periodSummary.negativeReviewRate)");
    expect(source).not.toContain("periodSummary.negativeReviewRate ?? 0");
    expect(source).toContain("item.rate === null ? [] : [item.rate]");
  });

  it("formats KPI deltas like the reference cards", () => {
    expect(source).toContain("Triangle");
    expect(source).toContain("Minus");
    expect(source).toContain("<Triangle");
    expect(source).toContain("size={8}");
    expect(source).toContain('fill="currentColor"');
    expect(source).toContain('color="currentColor"');
    expect(source).toContain('className={value < 0 ? "is-down" : undefined}');
    expect(source).toContain("<Minus size={9}");
    expect(source).not.toContain('value > 0 ? "▲" : value < 0 ? "▼" : "—"');
    expect(source).toContain('comparisonLabel={`이전 ${periodLabel} 대비`}');
    expect(source).toMatch(/value\s*>\s*0\s*\?\s*"mi-change--increase"/s);
    expect(source).toMatch(/value\s*<\s*0\s*\?\s*"mi-change--decrease"\s*:\s*"mi-change--flat"/s);
    expect(source).not.toContain("lowerIsBetter");
    expect(source).not.toContain("ArrowUpRight");
    expect(source).not.toContain("ArrowDownRight");
  });

  it("uses reference-style sparklines and rating trend on the dashboard", () => {
    expect(source).toContain("MetricSparkline");
    expect(source).toContain("RatingChart");
    expect(source).toContain("평점 추이");
    expect(source).toContain("function ratingSparklineValues");
    expect(source).toContain("fallback === null ? [] : [fallback]");
    expect(source).toMatch(
      /ratingSparklineValues\(\s*ratingTrend,\s*"android",\s*periodSummary\.androidRating/s,
    );
    expect(source).toMatch(
      /ratingSparklineValues\(\s*ratingTrend,\s*"ios",\s*periodSummary\.iosRating/s,
    );
  });

  it("uses one global performance period control instead of per-chart controls", () => {
    expect(source.match(/<PeriodTabs/g)).toHaveLength(1);
    expect(source).toContain('className="mi-global-period"');
    expect(source).toContain("performancePeriodViews.has(view)");
    expect(source).toContain("({periodLabel})");
    expect(source).toContain("const firstDate = periodStart(period, latestDate)");
    expect(source).not.toContain("const firstDate = trend.at(0)?.date");
    expect(source).not.toContain("(최근 28일)");

    const dashboardCharts = source.slice(
      source.indexOf('{view === "dashboard" && (', source.indexOf("mi-kpi-grid")),
      source.indexOf('{view === "downloads" && ('),
    );
    expect(dashboardCharts).not.toContain("<PeriodTabs");
  });

  it("keeps the reference dashboard compact", () => {
    expect(source).not.toContain("28일 활성 사용자");
    expect(source).not.toContain("ActiveUserChart");
  });

  it("uses real platform icons instead of A and i placeholders", () => {
    expect(source).toContain("<PlatformIcon");
    expect(source).not.toContain('platform === "android" ? "A" : "i"');
    expect(platformIconSource).toContain("siAndroid");
    expect(platformIconSource).toContain("siApple");
    expect(platformIconSource).not.toContain("function AndroidIcon");
  });

  it("omits the unused notification and team controls from the header", () => {
    expect(source).not.toContain('aria-label="알림"');
    expect(source).not.toContain('className="mi-header-actions"');
    expect(source).not.toContain('className="mi-team"');
  });

  it("omits the connection management item from the sidebar", () => {
    expect(source).not.toContain("연동 관리");
  });

  it("renders the app selector between the brand and navigation", () => {
    const brand = source.indexOf('className="mi-brand"');
    const selector = source.indexOf("<AppSelector");
    const navigation = source.indexOf('as="nav"');

    expect(brand).toBeGreaterThanOrEqual(0);
    expect(selector).toBeGreaterThan(brand);
    expect(selector).toBeLessThan(navigation);
    expect(source.match(/<AppSelector/g)).toHaveLength(1);
    expect(source).not.toContain('className="mi-header-app"');
    expect(source).toContain("({periodLabel})");
  });

  it("matches the download reference information architecture", () => {
    expect(source).toContain("순증 설치");
    expect(source).toContain("설치 vs 삭제 추이");
    expect(source).toContain('className="mi-install-bars"');
    expect(source).toContain("CSV 다운로드");
  });

  it("matches the review reference information architecture", () => {
    expect(source).toContain("VOC 키워드 요약");
    expect(source).toContain('className="mi-voc-summary"');
    expect(source).toContain("전체 부정 리뷰 수");
  });

  it("shows the latest five negative reviews on the dashboard and links to the review tab", () => {
    expect(source.match(/mi-panel-head--compact/g)).toHaveLength(3);
    expect(source).not.toContain('<DpText as="b">{item.rating}점</DpText>');
    expect(source).toContain("latestNegativeReviews(data.reviews)");
    expect(source).toContain('"부정 리뷰" : "최근 리뷰"');
    expect(source).not.toContain("최근 부정 리뷰");
    expect(source).not.toContain("평점 1~2점의 최신 의견입니다.");
    expect(source).not.toContain("mi-review-head--compact");
    expect(source).toContain('className="mi-review-more"');
    expect(source).toContain("더보기");
    expect(source).toContain('setReviewRating("negative")');
    expect(source).toContain('setView("reviews")');
    expect(source).toContain('className="mi-review-author"');
    expect(source).toContain('className="mi-review-version"');
    expect(source).toContain("reviewTimeLabel(item.reviewedAt)");
    expect(source.indexOf('className="mi-review-author"')).toBeLessThan(
      source.indexOf('className="mi-review-stars"'),
    );
    expect(source.indexOf('className="mi-review-stars"')).toBeLessThan(
      source.indexOf('className="mi-review-version"'),
    );
    expect(globalStyles).toMatch(
      /\.mi-review-copy\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-more\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-more\s*\{[^}]*font-weight:\s*500;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-list\s*\{[^}]*flex:\s*1;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-empty\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*text-align:\s*center;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-panel-head\.mi-panel-head--compact\s*\{[^}]*min-height:\s*48px;[^}]*padding:\s*10px 18px;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-panel-head--compact p\s*\{[^}]*display:\s*none;/s,
    );
  });

  it("matches the app management reference information architecture", () => {
    expect(source).toContain("등록 앱 수");
    expect(source).toContain("연결된 스토어");
    expect(source).toContain("최근 동기화 상태");
    expect(source).toContain("정상 연동 비율");
    expect(source).toContain("스토어 연결 관리");
    expect(source).toContain('className="mi-app-summary-grid"');
  });

  it("renders the release workspace from real release records", () => {
    expect(source).toContain('className="mi-release-workspace"');
    expect(source).toContain("최신 Android 버전");
    expect(source).toContain("최신 iOS 버전");
    expect(source).toContain("최근 30일 배포 수");
    expect(source).toContain("평균 배포 주기");
    expect(source).toContain("릴리즈 타임라인");
    expect(source).toContain("item.releaseNotes");
    expect(source).toContain("item.phasedReleaseState");
    expect(source).toContain("item.status");
    expect(source).toContain("releaseDateEstimated");
    expect(source).toContain("item.buildNumber");
    expect(source).toContain("classifyVersionChange");
    expect(source).toContain("Major");
    expect(source).toContain("Minor");
    expect(source).toContain("Patch");
    expect(source).not.toContain('patch > 0 ? "patch" : "major"');
    expect(source).toContain("추정");
    expect(source).toContain('item.releaseDateSource !== "first_observed_at"');
    expect(source).toContain("releaseSearch");
    expect(source).toContain("releasePlatform");
    expect(source).toContain("releaseType");
  });

  it("shows the latest mature release impact without platform or version selectors", () => {
    expect(source).toContain("const selectedRelease = selectLatestMatureRelease(data)");
    expect(source).not.toContain("impactPlatform");
    expect(source).not.toContain("releaseKey");
    expect(source).not.toContain('className="mi-impact-platform-tabs"');
    expect(source).not.toContain("릴리즈 선택");
    expect(source).toContain("배포 전 7일");
    expect(source).toContain("배포 후 7일");
    expect(source).toContain("변화량");
    expect(source).toContain("변화율");
    expect(source).toContain("impact.windows.before.from");
    expect(source).toContain("impact.windows.after.to");
  });

  it("formats signed impact deltas for scanning", () => {
    expect(source).toContain("const signedDelta = (value: number | null");
    expect(source).toContain("const displayedDifference = (");
    expect(source).toContain('new Intl.NumberFormat("ko-KR"');
  });

  it("renders the release impact analysis workspace from the reference layout", () => {
    expect(source).toContain("ReleaseImpactWorkspace");
    const workspace = readFileSync(
      new URL("./release-impact-workspace.tsx", import.meta.url),
      "utf8",
    );
    expect(workspace).toContain("다운로드 변화");
    expect(workspace).toContain("평점 변화 (Android)");
    expect(workspace).toContain("평점 변화 (iOS)");
    expect(workspace).toContain("부정 리뷰 비율");
    expect(workspace).toContain("신규 리뷰");
    expect(workspace).toContain("크래시율");
    expect(workspace).toContain("배포 전후 추이");
    expect(workspace).toContain("핵심 인사이트");
    expect(workspace).toContain("릴리즈 요약");
    expect(workspace).toContain("Before vs After 비교");
    expect(workspace).toContain("VOC 변화");
    expect(workspace).toContain("대표 리뷰");
  });
});
