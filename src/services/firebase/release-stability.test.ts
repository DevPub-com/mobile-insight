import {describe,it,expect} from 'vitest';
import {applyFirebaseStability,stabilityQuery} from './release-stability';
import type {ReleaseImpactWorkspaceView} from '@/services/mobile/tabs/release-impact.service';
const view={release:{platform:'android',version:'v2.0'},previousRelease:{version:'1.0'},windows:{before:{from:'2026-09-10',to:'2026-09-11'},after:{from:'2026-09-12',to:'2026-09-13'}},daily:[{offset:-2,date:'2026-09-10',crashes:999,rating:3},{offset:-1,date:'2026-09-11',crashes:999},{offset:0,date:'2026-09-12',crashes:999},{offset:1,date:'2026-09-13',crashes:999}],stability:{crashRate:{after:0.2}},crashReports:{after:999},anrReports:{after:999}} as unknown as ReleaseImpactWorkspaceView;
describe('Firebase release stability',()=>{
 it('replaces both versions and never retains Google values on absent days',()=>{
 const result=applyFirebaseStability(view,[{version:'1.0',date:'2026-09-10',crashes:10,anrs:20,crashUsers:8,anrUsers:12},{version:'2.0',date:'2026-09-12',crashes:3,anrs:4,crashUsers:2,anrUsers:3},{version:'wrong',date:'2026-09-13',crashes:900,anrs:900,crashUsers:900,anrUsers:900}]);
 expect(result.crashReports).toMatchObject({before:10,after:3,change:null,afterDays:1});
 expect(result.daily.map(d=>d.crashes)).toEqual([10,null,3,null]);
 expect(result.daily[0].rating).toBe(3);expect(result.stability).toBe(view.stability);
 });
 it('keeps measured zero distinct from no source records',()=>{
 expect(applyFirebaseStability(view,[]).crashReports.after).toBeNull();
 expect(applyFirebaseStability(view,[{version:'2.0',date:'2026-09-12',crashes:0,anrs:0,crashUsers:0,anrUsers:0}]).crashReports.after).toBe(0);
 });
 it('binds versions and separate operating windows and counts installations per day',()=>{
 const query=stabilityQuery({projectId:'project',dataset:'dataset',location:'asia-northeast3',tables:{android:'android',ios:'ios'},serviceAccountJsonEnv:'TEST'},view);
 expect(query.query).toContain("error_type='FATAL'");expect(query.query).toContain("error_type='ANR'");expect(query.query).toContain('installation_uuid');
 expect(query.query).toContain('@beforeEnd');expect(query.query).toContain('@afterEnd');
 expect(query.queryParameters.find(p=>p.name==='afterVersion')?.parameterValue.value).toBe('2.0');
 });
});
