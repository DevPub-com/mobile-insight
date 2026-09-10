import type { AppReview } from "@/domain/types";
import { summarizeReviewRatings } from "@/domain/reviews/review.service";

export function ReviewRatingSummary({ reviews, periodLabel }: { reviews: AppReview[]; periodLabel: string }) {
  const summary = summarizeReviewRatings(reviews.map((review) => review.rating));
  const groups = [
    { label: "긍정 (4~5점)", count: summary.positive, color: "#22A447" },
    { label: "중립 (3점)", count: summary.neutral, color: "#8993A7" },
    { label: "부정 (1~2점)", count: summary.negative, color: "#EF4444" },
  ];
  const percentage = (count: number) => summary.total ? count / summary.total * 100 : 0;
  const positiveEnd = percentage(summary.positive);
  const neutralEnd = positiveEnd + percentage(summary.neutral);

  return (
    <section className="mi-review-summary" aria-label="전체 리뷰 평점 요약">
      <article className="mi-review-summary-card">
        <h3>전체 평균 평점 (Android · iPhone)</h3>
        <p>최근 {periodLabel} · 수집 리뷰 {summary.total.toLocaleString("ko-KR")}건 기준</p>
        <strong className="mi-review-summary-average">{summary.average === null ? "—" : summary.average.toFixed(2)} <small>/ 5점</small></strong>
      </article>
      <article className="mi-review-summary-card">
        <h3>긍정 · 부정 리뷰 비율</h3>
        <p>Android · iPhone 전체 수집 리뷰 기준</p>
        {summary.total === 0 ? <p>선택 기간에 수집된 리뷰가 없습니다.</p> : (
          <div className="mi-review-sentiment">
            <div className="mi-review-pie" role="img" aria-label={groups.map((group) => `${group.label} ${percentage(group.count).toFixed(1)}%`).join(", ")} style={{ background: `conic-gradient(#22A447 0% ${positiveEnd}%, #8993A7 ${positiveEnd}% ${neutralEnd}%, #EF4444 ${neutralEnd}% 100%)` }} />
            <ul>{groups.map((group) => <li key={group.label}><span style={{ background: group.color }} />{group.label}<strong>{percentage(group.count).toFixed(1)}%</strong><small>{group.count.toLocaleString("ko-KR")}건</small></li>)}</ul>
          </div>
        )}
      </article>
    </section>
  );
}
