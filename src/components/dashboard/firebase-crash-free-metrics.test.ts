import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect,it,vi } from 'vitest';
import { FirebaseCrashFreeMetric } from './firebase-crash-free-metrics';
import { emptyCrashFreeMetric } from '@/services/firebase/crash-free';
vi.mock('./metric-sparkline',()=>({MetricSparkline:()=>null,metricTrendTone:()=> 'is-muted'}));
it('shows Firebase percentages and period changes for iOS',()=>{
 const html=renderToStaticMarkup(createElement(FirebaseCrashFreeMetric,{platform:'ios',metric:{...emptyCrashFreeMetric('available'),value:98.59,change:0.91}}));
 expect(html).toContain('98.59%');
 expect(html).toContain('이전 기간 대비 ▲ 0.91%p');
 expect(html).not.toContain('전날 대비');
});
it('shows pending instead of a fabricated percentage when sessions are missing',()=>{
 const html=renderToStaticMarkup(createElement(FirebaseCrashFreeMetric,{platform:'android',metric:emptyCrashFreeMetric('sessions_missing')}));
 expect(html).toContain('세션 데이터 수집 대기');
 expect(html).not.toContain('100.00%');
});
