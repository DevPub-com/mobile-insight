import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MetricSparkline } from './metric-sparkline';

type CapturedOption = { series: Array<{ data: number[]; showSymbol: boolean; symbol: string; symbolSize: number }> };
const capture = vi.hoisted(() => ({ option: { series: [] } as CapturedOption }));
vi.mock('./echart', () => ({ EChart: ({ option }: { option: CapturedOption }) => { capture.option = option; return null; } }));

describe('sparse metric charts', () => {
  it('renders a visible point for a single confirmed store rating without inventing history', () => {
    renderToStaticMarkup(createElement(MetricSparkline, { values: [4.386], color: '#22A447', singlePoint: true }));
    const series = capture.option.series[0];
    expect(series.data).toEqual([4.386]);
    expect(series.showSymbol).toBe(true);
    expect(series.symbol).toBe('circle');
    expect(series.symbolSize).toBeGreaterThan(0);
  });
});
