"use client";

import { useMemo } from 'react';
import { EChart } from './echart';
import { DpCard } from '@/components/ui/dp/DpCard';
import { DpLayout } from '@/components/ui/dp/DpLayout';
import { DpText } from '@/components/ui/dp/DpText';
import type { DashboardData } from '@/domain/types';
import { buildCrashHistory } from '@/services/mobile/crash-history.service';
import type { MetricDateRange } from '@/services/mobile/common/metrics-calculator';

export function CrashHistory({data, range}: {data: DashboardData; range: MetricDateRange}) {
  const history = useMemo(()=>buildCrashHistory(data,range),[data,range]);
  const androidRate = (data.metricObservations ?? []).filter(row=>row.platform==='android'&&row.metricKey==='user_perceived_crash_rate_28d'&&row.quality!=='unavailable'&&row.value!==null&&row.date>=range.startDate&&row.date<=range.endDate).toSorted((a,b)=>a.date.localeCompare(b.date));
  return (
    <DpCard className="mi-panel mi-chart-card">
      <DpLayout className="mi-panel-head"><DpText as="h3">크래시 이력</DpText><DpText>선택 기간의 스토어 크래시 보고 건수 · 같은 오류의 반복 발생 포함</DpText></DpLayout>
      <DpLayout className="mi-chart-grid px-5 pb-4">
        {(['android','ios'] as const).map(platform=>{
          const summary=history[platform];
          const useRate=platform==='android'&&summary.value===null&&androidRate.length>0;
          const dates=useRate?androidRate.map(row=>row.date):history.trend.map(row=>row.date);
          const values=useRate?androidRate.map(row=>row.value):history.trend.map(row=>row[platform]);
          const label=useRate?'사용자 인지 크래시율 (28일 가중 평균)':'크래시 보고 건수';
          return <DpLayout key={platform}>
            <DpText as="h4" className="font-semibold">{platform==='android'?'Android':'iOS'} · {label}</DpText>
            <DpText>{useRate?`최신 ${androidRate.at(-1)!.value!.toFixed(2)}% · ${androidRate.at(-1)!.date}`:summary.value===null?'보고서 데이터 없음':`${summary.value.toLocaleString('ko-KR')}건 · ${summary.days}일 수집분 · 최신 ${summary.latestDate}`}</DpText>
            {summary.value!==null||useRate?<EChart ariaLabel={`${platform} ${label} 일별 추이`} option={{
              tooltip:{trigger:'axis',valueFormatter:(value:number|string)=>value==null?'미수집':`${value}${useRate?'%':'건'}`},
              grid:{left:50,right:20,top:20,bottom:35},
              xAxis:{type:'category',data:dates.map(date=>date.slice(5)),boundaryGap:false},
              yAxis:{type:'value',min:0,minInterval:useRate?undefined:1,axisLabel:{formatter:useRate?'{value}%':'{value}'}},
              series:[{name:label,type:'line',data:values,connectNulls:false,smooth:false,showSymbol:true,symbolSize:5,itemStyle:{color:platform==='android'?'#22A447':'#8B5CF6'}}],
            }}/>:<DpLayout className="chart-empty">스토어 보고서가 제공되면 이곳에 표시됩니다.</DpLayout>}
            <DpText className="mi-dashboard-overall-note">{platform==='android'?(useRate?'건수 보고서 미수집 · 확보된 크래시율 이력 표시':'Google Play · 미국 LA 날짜 기준'):'App Store · 데이터 공유 동의 사용자 기준 · 개인정보 보호 기준에 따라 일부 데이터 제외'}</DpText>
          </DpLayout>;
        })}
      </DpLayout>
    </DpCard>
  );
}
