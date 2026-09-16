'use client';

import { useEffect, useState } from 'react';
import type { Platform } from '@/domain/types';
import type { CrashFreeData, CrashFreeMetric, CrashFreeStatus } from '@/services/firebase/crash-free';
import type { MetricDateRange } from '@/services/mobile/common/metrics-calculator';
import { PlatformIcon } from './platform-icon';
import { MetricSparkline, metricTrendTone } from './metric-sparkline';
import { DpLayout } from '@/components/ui/dp/DpLayout';
import { DpText } from '@/components/ui/dp/DpText';

const statuses: Record<CrashFreeStatus,string> = {
  available:'이전 기간 비교 불가',
  sessions_missing:'세션 데이터 수집 대기',
  crashes_missing:'크래시 데이터 연결 필요',
  no_data:'선택 기간 데이터 없음',
  partial:'선택 기간 수집 미완료',
  inconsistent:'집계 데이터 확인 필요',
  not_configured:'Firebase 연결 필요',
  error:'조회 실패 · 재시도 중',
};
export function FirebaseCrashFreeMetric({platform,metric,loading=false}:{platform:Platform;metric?:CrashFreeMetric;loading?:boolean}) {
  const change = metric?.change ?? null;
  return <DpLayout className={`mi-platform-metric mi-platform-metric--${platform}`}>
    <DpLayout direction="row" align="center" className="mi-platform-metric-label">
      <PlatformIcon platform={platform} size={17}/>
      <DpText as="span">{platform === 'android' ? 'Android' : 'iOS'}</DpText>
    </DpLayout>
    <DpText as="strong">{metric?.value == null ? '—' : `${metric.value.toFixed(2)}%`}</DpText>
    <DpText as="span" className={`mi-platform-delta ${metricTrendTone(change)}`}>
      {loading ? 'Firebase 조회 중' : change !== null
        ? `이전 기간 대비 ${change > 0 ? '▲' : change < 0 ? '▼' : '—'} ${Math.abs(change).toFixed(2)}%p`
        : statuses[metric?.status ?? 'error']}
    </DpText>
    <MetricSparkline values={metric?.trend.map(point=>point.value) ?? []} color={platform === 'android' ? '#22A447' : '#8B5CF6'} smooth={false} singlePoint/>
  </DpLayout>;
}

export function FirebaseCrashFreeMetrics({appId,range}:{appId:string;range:MetricDateRange}) {
  const [result,setResult] = useState<{key:string;data:CrashFreeData|null}|null>(null);
  const key = `${appId}:${range.startDate}:${range.endDate}`;
  useEffect(()=>{
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const query = new URLSearchParams({from:range.startDate,to:range.endDate});
        const response = await fetch(`/api/dashboard/${encodeURIComponent(appId)}/crash-free?${query}`,{signal:controller.signal,cache:'no-store'});
        if(!response.ok) throw Error('Firebase request failed');
        const body = await response.json() as {data:CrashFreeData};
        if(!controller.signal.aborted) setResult({key,data:body.data});
      } catch {
        if(!controller.signal.aborted) setResult({key,data:null});
      } finally {
        if(!controller.signal.aborted) timer = setTimeout(refresh,60000);
      }
    }
    void refresh();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[appId,range.startDate,range.endDate,key]);
  const current = result?.key === key ? result : null;
  return <>{(['android','ios'] as const).map(platform=><FirebaseCrashFreeMetric key={platform} platform={platform} metric={current?.data?.[platform]} loading={!current}/>)}</>;
}
