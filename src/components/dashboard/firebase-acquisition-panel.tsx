"use client";

import { useMemo } from "react";
import type { EChartsCoreOption } from 'echarts/core';
import type { DashboardData } from "@/domain/types";
import type { MetricDateRange } from "@/services/mobile/common/metrics-calculator";
import {buildAcquisitionDays,acquisitionPlatforms,acquisitionSummary,type AcquisitionDay,type AcquisitionValues, acquisitionTotal} from '@/services/mobile/tabs/acquisition.service';
import { EChart } from "./echart";
import { PlatformIcon } from './platform-icon';
import { DpCard } from "@/components/ui/dp/DpCard";

const count = (value: number | null) => value === null ? "수집 데이터 없음" : Math.round(value).toLocaleString("ko-KR");
const percent=(value:number|null)=>value===null?'수집 데이터 없음':`${value.toFixed(2)}%`;
const names={android:'Android',ios:'iOS'};
const colors={android:'#22a447',ios:'#8b5cf6'};
const definitions=[
 {key:'dau',title:'DAU',help:'선택 기간 중 수집된 날짜의 일평균 DAU입니다. 전체 추이는 Android와 iOS 합계이며 플랫폼 간 중복 사용자를 제거하지 않습니다.'},
 {key:'newUsers',title:'신규 사용자',help:'GA4 일별 신규 사용자 합계입니다. 전체는 플랫폼별 합계입니다.'},
 {key:'removals',title:'삭제 사용자',help:'실제 집계 단위는 삭제 건수이며 고유 사용자 수가 아닙니다. Android는 Firebase, iOS는 Apple 데이터 공유 동의 사용자 표본입니다. 전체는 두 출처의 수집 건수 합계이며 전체 앱 삭제 규모를 의미하지 않습니다.'},
 {key:'engagement',title:'참여율',help:'참여 세션 ÷ 전체 세션 × 100. 전체는 두 플랫폼의 세션을 합쳐 계산합니다.'},
] as const;
function AcquisitionChart({rows,metric,title,description,bar=false}:{rows:AcquisitionDay[];metric:keyof AcquisitionValues;title:string;description:string;bar?:boolean}) {
 const chartRows=useMemo(()=>{
  const hasData=(row:AcquisitionDay)=>acquisitionPlatforms.some(p=>row[p][metric]!==null);
  const first=rows.findIndex(hasData);
  const last=rows.findLastIndex(hasData);
  return first<0?[]:rows.slice(first,last+1);
 },[rows,metric]);
 const stacked=metric==='dau'||metric==='newUsers'||metric==='removals';
 const option=useMemo<EChartsCoreOption>(()=>({
  tooltip:{trigger:'axis',confine:true,valueFormatter:(value:unknown)=>typeof value==='number'?(metric==='engagement'?percent(value):count(value)):'수집 데이터 없음'},
  legend:{top:12,left:20,itemWidth:20,itemHeight:6,itemGap:20,textStyle:{color:'#465267',fontSize:11}},
  grid:{left:58,right:22,top:60,bottom:38},
  xAxis:{type:'category',data:chartRows.map(row=>row.date.slice(5).replace('-','.')),axisLabel:{color:'#7c879b'},boundaryGap:bar||stacked},
  yAxis:{type:'value',min:0,max:metric==='engagement'?100:undefined,axisLabel:{color:'#7c879b',formatter:metric==='engagement'?'{value}%':undefined},splitLine:{lineStyle:{color:'#e4eaf5',type:'dashed'}}},
  series:[...acquisitionPlatforms,'total' as const].map(p=>({name:p==='total'?'전체':names[p],type:(bar||stacked)&&p!=='total'?'bar':'line',stack:stacked&&p!=='total'?metric:undefined,data:chartRows.map(row=>p==='total'?acquisitionTotal(row,metric):row[p][metric]),smooth:false,showSymbol:true,symbol:"circle",symbolSize:5,connectNulls:false,barMaxWidth:28,lineStyle:{color:p==='total'?'#4B5563':colors[p],width:2},itemStyle:{color:p==='total'?'#4B5563':colors[p],borderRadius:0}})),
 }),[chartRows,metric,bar,stacked]);
 return <DpCard className="mi-panel mi-chart-card mi-chart-card--large"><div className="mi-panel-head"><h3 title={description}>{title}</h3></div>{rows.some(row=>acquisitionPlatforms.some(p=>row[p][metric]!==null))?<EChart option={option} ariaLabel={title}/>:<p className="mi-empty">수집 데이터 없음</p>}</DpCard>;
}
export function FirebaseAcquisitionPanel({ data, range }: { data: DashboardData; range: MetricDateRange }) {
 const rows=useMemo(()=>buildAcquisitionDays(data,range),[data,range]);
 const summary=useMemo(()=>({android:acquisitionSummary(rows,'android'),ios:acquisitionSummary(rows,'ios')}),[rows]);
 return <>
  <section className="mi-acquisition-usage-summary">
   {definitions.map(item=><DpCard key={item.key} className="mi-acquisition-usage-card">
    <h3 title={item.help}>{item.title}</h3><div className="mi-acquisition-usage-platforms">{acquisitionPlatforms.map(p=><div key={p}><span className="mi-acquisition-platform"><PlatformIcon platform={p} size={17}/>{names[p]}</span><strong>{item.key==='engagement'?percent(summary[p][item.key]):count(summary[p][item.key])}</strong></div>)}</div>
   </DpCard>)}
  </section>
  <section className="mi-acquisition-usage-charts">
   {definitions.map(item=><AcquisitionChart key={item.key} rows={rows} metric={item.key} title={`${item.title} 추이`} description={item.help} bar={item.key==='removals'}/>)}
  </section>
  <DpCard className="mi-panel mi-daily-table"><div className="mi-panel-head"><h3>플랫폼별 일별 상세</h3></div>
   <div className="mi-acquisition-table-scroll"><table className="mi-acquisition-table"><thead><tr><th>날짜</th><th>플랫폼</th><th>DAU</th><th>신규 사용자</th><th title={definitions[2].help}>삭제 사용자</th><th>참여율</th></tr></thead><tbody>{[...rows].reverse().flatMap(row=>acquisitionPlatforms.map(p=><tr key={`${row.date}:${p}`}><td>{row.date}</td><td><span className="mi-acquisition-platform"><PlatformIcon platform={p} size={14}/>{names[p]}</span></td><td>{count(row[p].dau)}</td><td>{count(row[p].newUsers)}</td><td>{count(row[p].removals)}</td><td>{percent(row[p].engagement)}</td></tr>))}</tbody></table></div>
  </DpCard>
 </>;
}
