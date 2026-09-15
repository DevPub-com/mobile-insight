import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import type { AppReview } from '@/domain/types';
import { ReviewRatingSummary } from './review-rating-summary';

const { chart } = vi.hoisted(() => ({ chart: vi.fn() }));
vi.mock('./echart', () => ({ EChart: (props: unknown) => { chart(props); return null; } }));

it('weights the combined average by reviews and leaves missing dates empty', () => {
  const reviews = [
    { platform: 'android', reviewedAt: '2026-09-01', rating: 1 },
    { platform: 'android', reviewedAt: '2026-09-01', rating: 1 },
    { platform: 'ios', reviewedAt: '2026-09-01', rating: 4 },
    { platform: 'ios', reviewedAt: '2026-09-03', rating: 5 },
  ] as AppReview[];
  const html = renderToStaticMarkup(createElement(ReviewRatingSummary, { reviews }));
  expect(html).toContain('2.75');
  const { option } = chart.mock.lastCall![0];
  expect(option.xAxis.data).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  expect(option.series[0].data).toEqual([2, null, 5]);
  expect(option.series[0].connectNulls).toBe(false);
});

it('shows an empty state without fabricating a trend', () => {
  chart.mockClear();
  const html = renderToStaticMarkup(createElement(ReviewRatingSummary, { reviews: [] }));
  expect(html).toContain('선택 기간에 수집된 리뷰가 없습니다.');
  expect(chart).not.toHaveBeenCalled();
});
