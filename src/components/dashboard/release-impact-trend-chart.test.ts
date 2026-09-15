import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ReleaseImpactTrendChart } from './release-impact-trend-chart';

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('./echart', () => ({ EChart: (props: unknown) => { capture(props); return null; } }));

it('aligns each version at day zero without filling uncollected days', () => {
  renderToStaticMarkup(createElement(ReleaseImpactTrendChart, { metric: 'crashes', data: [
    { offset: -3, date: '2026-09-09', downloads: null, crashes: 10 },
    { offset: -2, date: '2026-09-10', downloads: null, crashes: null },
    { offset: -1, date: '2026-09-11', downloads: null, crashes: 6 },
    { offset: 0, date: '2026-09-12', downloads: null, crashes: 4 },
    { offset: 1, date: '2026-09-13', downloads: null, crashes: 2 },
  ] }));
  const { option } = capture.mock.lastCall![0];
  expect(option.xAxis.data).toEqual(['0', '+1', '+2']);
  expect(option.xAxis.boundaryGap).toBe(false);
  expect(option.series[0].data).toEqual([10, null, 6]);
  expect(option.series[1].data).toEqual([4, 2, null]);
});
