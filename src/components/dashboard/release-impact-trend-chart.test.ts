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

it.each(['crashes', 'anrs'] as const)('combines %s counts and users with separate units', metric => {
  const usersMetric = metric === 'crashes' ? 'crashUsers' : 'anrUsers';
  renderToStaticMarkup(createElement(ReleaseImpactTrendChart, {metric, beforeLabel: 'v1', afterLabel: 'v2', data: [
    {offset: -1, date: '2026-09-11', downloads: null, [metric]: 10, [usersMetric]: 8},
    {offset: 0, date: '2026-09-12', downloads: null, [metric]: 4, [usersMetric]: 3},
    {offset: 1, date: '2026-09-13', downloads: null, [metric]: null, [usersMetric]: null},
  ]}));
  const {option} = capture.mock.lastCall![0];
  expect(option.series.map((series: {name: string}) => series.name)).toEqual(['v1 · 보고 건수', 'v2 · 보고 건수', 'v1 · 영향받은 사용자', 'v2 · 영향받은 사용자']);
  expect(option.series[3].data).toEqual([3, null]);
  expect(option.series[3].lineStyle.type).toBe('dashed');
  expect(option.tooltip.valueFormatter(4)).toBe('4건');
  expect(option.series[3].tooltip.valueFormatter(3)).toBe('3명');
});
