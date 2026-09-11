import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { CrashHistory } from './crash-history';
import { demoDashboardData } from '@/data/demo';
import type { MetricObservation } from '@/domain/types';

vi.mock('./echart',()=>({EChart:({ariaLabel}:{ariaLabel:string})=>createElement('div',null,ariaLabel)}));
it('shows rate history explicitly when Android counts are missing, and Apple report counts separately',()=>{
 const point:MetricObservation={appId:'app',platform:'android',date:'2026-09-08',metricKey:'user_perceived_crash_rate_28d',value:0.23,source:'google_play_api',quality:'exact',observedAt:'2026-09-09T00:00:00Z'};
 const html=renderToStaticMarkup(createElement(CrashHistory,{data:{...demoDashboardData,metricObservations:[point,{...point,platform:'ios',metricKey:'crash_report_count',value:42,source:'app_store_analytics'}]},range:{startDate:'2026-09-08',endDate:'2026-09-09'}}));
 expect(html).toContain('0.23%');
 expect(html).toContain('사용자 인지 크래시율');
 expect(html).toContain('42건');
 expect(html).toContain('1일 수집분');
 expect(html).toContain('크래시 보고 건수 일별 추이');
 expect(html).not.toContain('신규 크래시 이슈');
});
