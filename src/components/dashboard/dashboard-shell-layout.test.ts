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
const dateRangePickerSource = readFileSync(
  new URL("./date-range-picker.tsx", import.meta.url),
  "utf8",
);
const releaseImpactSource = readFileSync(
  new URL("./release-impact-workspace.tsx", import.meta.url),
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
    expect(source).toContain("최근 업데이트 후 달라진 점");
    expect(source).toContain("앱 목록");
  });

  it("keeps the real dashboard view builders connected to the redesigned UI", () => {
    expect(source).toContain("buildDashboardSummaryForRange(data, dateRange)");
    expect(source).toContain("buildDateRangeSummary(data, dateRange)");
    expect(source).toContain("dashboardSummary.charts.downloads");
    expect(source).toContain("dashboardSummary.charts.ratings");
    expect(source).toContain("dashboardSummary.latestReleaseImpact.platforms");
    expect(source).toContain('className="mi-dashboard-kpi-grid"');
    expect(source).toContain('className="mi-chart-grid"');
    expect(source).toContain("disabled={!availableDateRange}");
    expect(dateRangePickerSource).toContain("disabled?: boolean");
  });

  it("matches the final dashboard reference information architecture", () => {
    expect(source).toContain('className="mi-dashboard-kpi-grid"');
    expect(source).not.toContain("Android 안정성");
    expect(source).not.toContain("function StabilityMetric");
    expect(source).not.toContain("최근 버전 신규 Crash Issue");
    expect(source).toContain("부정 리뷰 비율");
    expect(source).not.toContain("부정 평가 비율");
    expect(source).toContain('className="mi-dashboard-bottom-grid"');
    expect(source).toContain("부정 리뷰 Top 10");
    expect(source).toContain("최근 업데이트 후 달라진 점");
    expect(source).toContain("전체보기");
    expect(source).toContain("상세보기");
    expect(source).toContain("title={item.content}");
    expect(source).toContain('setView("impact")');
  });

  it("does not expose internal metric-quality badges in the UI", () => {
    expect(source).not.toContain("QualityBadge");
    expect(source).not.toContain("mi-quality-badge");
    expect(globalStyles).not.toContain(".mi-quality-badge");
    expect(releaseImpactSource).not.toContain("<DpBadge>추정</DpBadge>");
  });

  it("renders KPI changes from the selected real-data period instead of placeholders", () => {
    expect(source).toContain("최근 {periodLabel} 다운로드");
    expect(source).toContain("const [dateRange, setDateRange] = useState");
    expect(source).not.toContain('buildPeriodSummary(data, "30d")');
    expect(source).not.toContain('buildDownloadTrend(data, "30d")');
    expect(source).not.toContain('buildRatingTrend(data, "30d")');
    expect(source).not.toContain('buildReviewRateTrend(data, "30d")');
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
    expect(source).toContain("KoboyoIcon");
    expect(source).toContain('name="arrow-up"');
    expect(source).toContain('name="minus"');
    expect(source).toContain('className={value < 0 ? "is-down" : undefined}');
    expect(source).toContain('name="minus" size={9}');
    expect(source).not.toContain('value > 0 ? "▲" : value < 0 ? "▼" : "—"');
    expect(source).toContain("(vs. 이전 {periodLabel})");
    expect(source).toMatch(/value\s*>\s*0\s*\?\s*"mi-change--increase"/s);
    expect(source).toMatch(
      /value\s*<\s*0\s*\?\s*"mi-change--decrease"\s*:\s*"mi-change--flat"/s,
    );
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
    expect(source).not.toContain("<PeriodTabs");
    expect(source).toContain("<DashboardDateRangePicker");
    expect(source).toContain("buildDashboardSummaryForRange(data, dateRange)");
    expect(dateRangePickerSource).toContain('className="mi-global-date-range"');
    expect(source).toContain("performancePeriodViews.has(view)");
    expect(source).toContain("reviewedAt >= dateRange.startDate");
    expect(source).not.toContain("const firstDate = trend.at(0)?.date");
    expect(source).not.toContain("(최근 28일)");

    const dashboardCharts = source.slice(
      source.indexOf(
        '{view === "dashboard" && (',
        source.indexOf("mi-kpi-grid"),
      ),
      source.indexOf('{view === "downloads" && ('),
    );
    expect(dashboardCharts).not.toContain("DashboardDateRangePicker");
  });

  it("labels latest-release impact from the platform release date through the latest data date", () => {
    expect(source).toMatch(
      /\{releaseDate\(releaseImpact\.release\)\}\s*~\s*\{" "\}\s*\{date\(latestDate\)\}/s,
    );
  });

  it("keeps the reference dashboard compact", () => {
    expect(source).toContain("신규 크래시 이슈");
    expect(source).toMatch(
      /statusLabel=\{\s*crashIssue\.current === null\s*\? "데이터 미연동"\s*: undefined\s*\}/s,
    );
    expect(source).not.toContain("월간 활성 사용자");
    expect(source).not.toContain("activeUserSparkline");
    expect(releaseImpactSource).toContain("배포 후 비정상 종료율");
    expect(releaseImpactSource).toContain("배포 후 ANR 발생률");
    expect(releaseImpactSource).not.toContain("Firebase · Sentry 데이터 없음");
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
    expect(source).toContain("<DashboardDateRangePicker");
  });

  it("matches the download reference information architecture", () => {
    expect(source).toContain("순증 설치");
    expect(source).toContain("설치 vs 삭제 추이");
    expect(source).toContain('className="mi-install-bars"');
    expect(source).toContain("CSV 다운로드");
    expect(source).toContain("직전 ${dateRangeDays(dateRange)}일 대비");
    expect(source).toContain("데이터 없음");
    expect(source).toContain("수집 지연");
    expect(source).toContain('className={`mi-data-status mi-data-status--${status}`}');
  });

  it("matches the review reference information architecture", () => {
    expect(source).toContain("VOC 키워드 요약");
    expect(source).toContain('className="mi-voc-summary"');
    expect(source).toContain("전체 부정 리뷰 수");
  });

  it("places the sentiment chip beside the version and keeps only topics below", () => {
    const versionIndex = source.indexOf('className="mi-review-version"');
    const sentimentIndex = source.indexOf('className={`mi-ai-sentiment-badge');
    const timeIndex = source.indexOf('as="time"', sentimentIndex);

    expect(versionIndex).toBeGreaterThan(-1);
    expect(sentimentIndex).toBeGreaterThan(versionIndex);
    expect(timeIndex).toBeGreaterThan(sentimentIndex);
    expect(source).toContain('item.aiSentiment === "positive" && "긍정"');
    expect(source).toContain('item.aiSentiment === "neutral" && "개선"');
    expect(source).toContain('item.aiSentiment === "negative" && "불만"');
    expect(source).not.toContain("긍정 피드백");
    expect(source).not.toContain("개선 제안");
    expect(source).not.toContain("불만 이슈");
    expect(source).toContain('className="mi-review-classification"');
    expect(source).toContain('className="mi-review-device"');
    expect(source).toContain("reviewDeviceLabel(review)");
    expect(source).toContain("<ReviewDevice review={item} />");
    expect(source).toContain("[...new Set(item.aiTopics)]");
    expect(source).toContain("{item.aiTopics && item.aiTopics.length > 0 && (");
    expect(globalStyles).toMatch(
      /\.mi-review-meta \.mi-ai-sentiment-badge\s*\{[^}]*flex:\s*0 0 auto;/s,
    );
    expect(globalStyles).toMatch(
      /@media \(max-width:\s*760px\)\s*\{[\s\S]*?\.mi-review-meta\s*\{[^}]*flex-wrap:\s*wrap;[\s\S]*?\.mi-review-meta time\s*\{[^}]*flex-basis:\s*100%;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-ai-sentiment-badge\.is-positive\s*\{[^}]*color:\s*#166534;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-ai-sentiment-badge\.is-neutral\s*\{[^}]*color:\s*#92400e;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-ai-sentiment-badge\.is-negative\s*\{[^}]*color:\s*#991b1b;/s,
    );
  });

  it("shows up to ten negative reviews on the dashboard and links to the review tab", () => {
    expect(source.match(/mi-panel-head--compact/g)).toHaveLength(1);
    expect(source).not.toContain('<DpText as="b">{item.rating}점</DpText>');
    expect(source).toContain("latestNegativeReviews(data.reviews)");
    expect(source).not.toContain("latestNegativeReviews(data.reviews, 10)");
    expect(source).toContain("dashboardSummary.negativeReviewsTop10");
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
    expect(source).not.toContain('<DpText as="span">순위</DpText>');
    expect(source).toContain("<ReviewStars rating={item.rating} />");
    expect(source).toContain("Array.from({ length: 5 }");
    expect(globalStyles).toMatch(
      /\.mi-review-copy\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-dashboard-review-copy\s*\{[^}]*display:\s*-webkit-box;[^}]*-webkit-line-clamp:\s*2;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-more\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-review-more\s*\{[^}]*font-weight:\s*500;/s,
    );
    expect(globalStyles).toMatch(/\.mi-review-list\s*\{[^}]*flex:\s*1;/s);
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

  it("orders rating filters from high to low and progressively reveals reviews on scroll", () => {
    expect(source).toMatch(
      /\["all",\s*"positive",\s*"neutral",\s*"negative"\]/s,
    );
    expect(source).not.toContain(
      "<DpBadge>{filteredReviews.length}건</DpBadge>",
    );
    expect(source).toContain("new IntersectionObserver");
    expect(source).toContain("reviewLoadMoreRef");
    expect(source).toContain("filteredReviews.slice(0, reviewPage * pageSize)");
    expect(source).not.toContain('className="mi-pagination"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).not.toContain('role="status"');
    expect(source).not.toContain("리뷰 더 불러오는 중");
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

  it("shows the latest platform release impacts without dashboard selectors", () => {
    expect(source).toContain("const platformImpacts = Object.fromEntries");
    expect(source).not.toContain("impactPlatform");
    expect(source).not.toContain("releaseKey");
    expect(source).not.toContain('className="mi-impact-platform-tabs"');
    expect(source).not.toContain("릴리즈 선택");
    expect(source).toContain("최근 업데이트 후 달라진 점");
    expect(source).toContain('label: "새 크래시"');
    expect(source).not.toContain("새 충돌 문제");
    expect(source).toContain("releaseImpact.release.version");
    expect(source).toContain("releaseDate(releaseImpact.release)");
    expect(source).toContain("platformImpacts[platform]");
    expect(source).toContain("crashIssueFor(platform)");
  });

  it("shows current platform impact values together with their absolute changes", () => {
    expect(source).toContain("releaseImpact.rating.after");
    expect(source).toContain("releaseImpact.negativeReviews.after");
    expect(source).toContain('label: "리뷰 건수"');
    expect(source).toContain("releaseImpact.reviewCount.after");
    expect(source).toContain('label: "배포 후 신규 다운로드"');
    expect(source).toContain("releaseImpact.downloads.after");
    expect(source).toContain("current: crashIssue.current");
    expect(source).toContain("change: crashIssue.change");
    expect(source).toContain('className="mi-dashboard-impact-values"');
    expect(source).toContain('className="mi-dashboard-impact-current"');
    expect(source).toMatch(/signedDelta\(\s*row\.change,/s);
  });

  it("separates platform release impacts with a center divider instead of nested cards", () => {
    expect(globalStyles).toMatch(
      /\.mi-dashboard-impact-platform\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(globalStyles).toMatch(
      /\.mi-dashboard-impact-platform\s*\+\s*\.mi-dashboard-impact-platform\s*\{[^}]*border-left:\s*1px solid #e5eaf1;/s,
    );
    expect(globalStyles).toMatch(
      /@media \(max-width:\s*760px\)[\s\S]*\.mi-dashboard-impact-platform\s*\+\s*\.mi-dashboard-impact-platform\s*\{[^}]*border-left:\s*0;[^}]*border-top:\s*1px solid #e5eaf1;/s,
    );
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
    expect(workspace).toContain("배포 후 비정상 종료율");
    expect(workspace).toContain("배포 후 ANR 발생률");
    expect(workspace).toContain(
      'value === null ? "—" : `${formatNumber(value, decimals)}%`',
    );
    expect(workspace).toContain("배포 전후 추이");
    expect(workspace).toContain("핵심 인사이트");
    expect(workspace).toContain("릴리즈 요약");
    expect(workspace).toContain("Before vs After 비교");
    expect(workspace).toContain("VOC 변화");
    expect(workspace).toContain("대표 리뷰");
  });
});
