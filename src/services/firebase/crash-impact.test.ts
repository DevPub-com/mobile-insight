import {expect,it} from 'vitest';
import {summarizeCrashImpact,crashImpactQuery} from './crash-impact';
const range={startDate:'2026-09-09',endDate:'2026-09-11'};
it('shows the latest paired day and compares only the preceding calendar day',()=>{
 const result=summarizeCrashImpact([{date:'2026-09-09',users:10},{date:'2026-09-10',users:15},{date:'2026-09-11',users:20}],[{date:'2026-09-09',users:1000},{date:'2026-09-10',users:1000}],range);
 expect(result).toMatchObject({date:'2026-09-10',value:1.5,change:0.5});
 expect(result.trend.at(-1)?.value).toBeNull();
});
it('does not fill missing crashes or compare across missing days',()=>{
 const result=summarizeCrashImpact([{date:'2026-09-09',users:1},{date:'2026-09-11',users:0}],[{date:'2026-09-09',users:100},{date:'2026-09-10',users:100},{date:'2026-09-11',users:100}],range);
 expect(result).toMatchObject({value:0,change:null,date:'2026-09-11'});
 expect(result.trend[1].value).toBeNull();
});
it('rejects invalid denominators and incompatible populations without clamping',()=>{
 for(const users of [0,5]) expect(summarizeCrashImpact([{date:'2026-09-11',users:10}],[{date:'2026-09-11',users}],range)).toMatchObject({status:'inconsistent',value:null});
});
it('queries daily unique fatal installations across all versions in the GA4 time zone',()=>{
 const q=crashImpactQuery({projectId:'project',dataset:'firebase_crashlytics',location:'asia-northeast3',serviceAccountJsonEnv:'TEST',tables:{android:'app_ANDROID_REALTIME',ios:'app_IOS_REALTIME'}},'ios',range,'Asia/Seoul');
 expect(q.query).toContain("COUNT(DISTINCT IF(error_type='FATAL',NULLIF(installation_uuid,''),NULL))");
 expect(q.query).not.toContain('display_version');
 expect(q.queryParameters).toContainEqual({name:'zone',parameterType:{type:'STRING'},parameterValue:{value:'Asia/Seoul'}});
});
