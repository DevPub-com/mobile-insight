'use client';

import { useEffect, useState } from 'react';
import type { Platform } from '@/domain/types';
import type { CrashImpactData, CrashImpactMetric } from '@/services/firebase/crash-impact';
import type { MetricDateRange } from '@/services/mobile/common/metrics-calculator';
import { PlatformIcon } from './platform-icon';
import { MetricSparkline, metricTrendTone } from './metric-sparkline';
import { DpLayout } from '@/components/ui/dp/DpLayout';
import { DpText } from '@/components/ui/dp/DpText';

export type DisplayImpactMetric = CrashImpactMetric & {stale?:boolean};
export function retainImpactValues(previous:Record<Platform,DisplayImpactMetric>|null, next:CrashImpactData|null):Record<Platform,DisplayImpactMetric> {
  const merge=(platform:Platform):DisplayImpactMetric => {
    const fresh=next?.[platform];
    const old=previous?.[platform];
    if((!fresh || fresh.status==='error') && old?.value!=null) return {...old,stale:true};
    return fresh ?? {status:'error',value:null,change:null,date:null,trend:[]};
  };
  return {android:merge('android'),ios:merge('ios')};
}

const statuses: Record<CrashImpactMetric['status'],string> = {
  available:'전날 데이터 없음',
  no_data:'선택 기간 데이터 없음',
  inconsistent:'집계 데이터 확인 필요',
  not_configured:'Firebase 연결 필요',
  error:'조회 실패 · 재시도 중',
};
export function FirebaseCrashImpactMetric({platform,metric,loading=false}:{platform:Platform;metric?:DisplayImpactMetric;loading?:boolean}) {
  const change = metric?.change ?? null;
  return <DpLayout className={`mi-platform-metric mi-platform-metric--${platform}`}>
    <DpLayout direction="row" align="center" className="mi-platform-metric-label">
      <PlatformIcon platform={platform} size={17}/>
      <DpText as="span">{platform === 'android' ? 'Android' : 'iOS'}</DpText>
    </DpLayout>
    <DpText as="strong">{metric?.value == null ? '—' : `${metric.value.toFixed(2)}%`}</DpText>
    <DpText as="span" className={`mi-platform-delta ${metricTrendTone(change)}`}>
      {loading ? 'Firebase 조회 중' : metric?.stale ? '갱신 지연 · 이전 조회값' : change !== null
        ? `전날 대비 ${change > 0 ? '▲' : change < 0 ? '▼' : '—'} ${Math.abs(change).toFixed(2)}%p`
        : statuses[metric?.status ?? 'error']}
    </DpText>
    <MetricSparkline values={metric?.trend.map(point=>point.value) ?? []} color={platform === 'android' ? '#22A447' : '#8B5CF6'} smooth={false} singlePoint/>
  </DpLayout>;
}

export function FirebaseCrashImpactMetrics({appId,range}:{appId:string;range:MetricDateRange}) {
  const [result,setResult] = useState<{key:string;data:Record<Platform,DisplayImpactMetric>|null}|null>(null);
  const key = `${appId}:${range.startDate}:${range.endDate}`;
  useEffect(()=>{
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const query = new URLSearchParams({from:range.startDate,to:range.endDate});
        const response = await fetch(`/api/dashboard/${encodeURIComponent(appId)}/crash-impact?${query}`,{signal:controller.signal,cache:'no-store'});
        if(!response.ok) throw Error('Firebase request failed');
        const body = await response.json() as {data:CrashImpactData};
        if(!controller.signal.aborted) setResult(previous=>({key,data:retainImpactValues(previous?.key===key?previous.data:null,body.data)}));
      } catch {
        if(!controller.signal.aborted) setResult(previous=>({key,data:retainImpactValues(previous?.key===key?previous.data:null,null)}));
      } finally {
        if(!controller.signal.aborted) timer = setTimeout(refresh,60000);
      }
    }
    void refresh();
    return ()=>{controller.abort();clearTimeout(timer);};
  },[appId,range.startDate,range.endDate,key]);
  const current = result?.key === key ? result : null;
  return <>{(['android','ios'] as const).map(platform=><FirebaseCrashImpactMetric key={platform} platform={platform} metric={current?.data?.[platform]} loading={!current}/>)}</>;
}
