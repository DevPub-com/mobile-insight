import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import {FirebaseCrashImpactMetric,retainImpactValues} from './firebase-crash-impact-metrics';
vi.mock('./metric-sparkline',()=>({MetricSparkline:()=>null,metricTrendTone:()=> 'is-muted'}));
it('shows the daily percentage without the removed date caption',()=>{
 const html=renderToStaticMarkup(createElement(FirebaseCrashImpactMetric,{platform:'ios',metric:{value:0.156,change:0.026,date:'2026-09-15',status:'available',trend:[]}}));
 expect(html).toContain('0.16%');expect(html).toContain('전날 대비 ▲ 0.03%p');expect(html).not.toContain('2026-09-15');expect(html).not.toContain('추정');
});

it('retains only failed platforms and clears stale state after recovery',()=>{
 const good={value:0.1,change:0,date:'2026-09-15',status:'available' as const,trend:[]};
 const failure={value:null,change:null,date:null,status:'error' as const,trend:[]};
 const merged=retainImpactValues({android:good,ios:good},{android:failure,ios:{...good,value:0.2}});
 expect(merged.android).toMatchObject({value:0.1,stale:true});
 expect(merged.ios).toMatchObject({value:0.2});
 expect(retainImpactValues(merged,{android:good,ios:good}).android.stale).toBeUndefined();
 expect(retainImpactValues(null,{android:failure,ios:good}).android.value).toBeNull();
 const html=renderToStaticMarkup(createElement(FirebaseCrashImpactMetric,{platform:'android',metric:merged.android}));
 expect(html).toContain('0.10%');expect(html).toContain('갱신 지연 · 이전 조회값');
});
it('retains successful values on a whole-request failure, but does not mask no-data',()=>{
 const good={value:0.1,change:0,date:'2026-09-15',status:'available' as const,trend:[]};
 expect(retainImpactValues({android:good,ios:good},null).ios.stale).toBe(true);
 const missing={...good,status:'no_data' as const,value:null};
 expect(retainImpactValues({android:good,ios:good},{android:missing,ios:good}).android.value).toBeNull();
});
