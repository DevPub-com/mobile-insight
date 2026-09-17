import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {crashImpactObservations,storedCrashImpact} from './stored-crash-impact';
import {emptyImpact} from './crash-impact';
const range={startDate:'2026-09-14',endDate:'2026-09-16'};
it('keeps precision, zero and calendar-day comparison through persistence',()=>{
 const rows=crashImpactObservations('a',{android:{...emptyImpact('available'),trend:[{date:'2026-09-13',value:0.123456},{date:'2026-09-14',value:0}]},ios:emptyImpact('no_data')},'2026-09-17T00:00:00Z');
 expect(rows).toHaveLength(2);
 expect(storedCrashImpact('a',rows,range).android).toMatchObject({value:0,change:-0.123456,date:'2026-09-14'});
 expect(storedCrashImpact('other',rows,range).android.status).toBe('no_data');
});
it('does not write failures or missing days over stored good values',()=>{
 expect(crashImpactObservations('a',{android:emptyImpact('error'),ios:{...emptyImpact('available'),trend:[{date:'2026-09-14',value:null}]}},'now')).toEqual([]);
});
it('uses updated daily values without comparing over a gap',()=>{
 const data={android:{...emptyImpact('available'),trend:[{date:'2026-09-14',value:1},{date:'2026-09-16',value:2}]},ios:emptyImpact('no_data')};
 const old=crashImpactObservations('a',data,'2026-09-16T00:00:00Z');
 const updated=crashImpactObservations('a',{...data,android:{...data.android,trend:[{date:'2026-09-16',value:3}]}},'2026-09-17T00:00:00Z');
 expect(storedCrashImpact('a',[...updated,...old],range).android).toMatchObject({value:3,change:null});
});
it('dashboard and read route do not request external crash data',()=>{
 const component=readFileSync('src/components/dashboard/firebase-crash-impact-metrics.tsx','utf8');
 const route=readFileSync('src/app/api/dashboard/[appId]/crash-impact/route.ts','utf8');
 expect(component).not.toContain('fetch(');
 expect(component).not.toContain('setTimeout');
 expect(route).not.toContain('loadCrashImpact');
});
