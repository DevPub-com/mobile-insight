import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DashboardShell } from './dashboard-shell';
import { demoDashboardData } from '@/data/demo';

vi.mock('./app-selector', () => ({ AppSelector: () => null }));
vi.mock('./date-range-picker', () => ({ DashboardDateRangePicker: () => null }));
vi.mock('./echart', () => ({ EChart: ({ option }: { option: { series?: Array<{ data?: unknown }> } }) => createElement('output', null, JSON.stringify(option.series?.[0]?.data)) }));

describe('dashboard metric presentation', () => {
  it('shows each platform own negative review trend and the selected period', () => {
    const review = demoDashboardData.reviews[0];
    const data = { ...demoDashboardData, metrics: [], releases: [], ratingSnapshots: [], metricObservations: [], reviews: [
      { ...review, id: 'a1', platform: 'android' as const, reviewedAt: '2026-09-08T00:00:00Z', rating: 1 },
      { ...review, id: 'a2', platform: 'android' as const, reviewedAt: '2026-09-09T00:00:00Z', rating: 5 },
      { ...review, id: 'i1', platform: 'ios' as const, reviewedAt: '2026-09-08T00:00:00Z', rating: 5 },
      { ...review, id: 'i2', platform: 'ios' as const, reviewedAt: '2026-09-09T00:00:00Z', rating: 1 },
    ] };
    const html = renderToStaticMarkup(createElement(DashboardShell, { data }));
    const card = html.slice(html.indexOf('부정 리뷰 비율'), html.indexOf('부정 리뷰 Top 10'));
    expect(card).toContain('<output>[100,0]</output>');
    expect(card).toContain('<output>[0,100]</output>');
    expect(card).toContain('1~2점');
    expect(html).not.toContain('AI Executive Briefing');
  });
});
