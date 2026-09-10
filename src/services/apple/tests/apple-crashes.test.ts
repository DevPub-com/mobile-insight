import { describe, expect, it } from 'vitest';
import { parseAppleCrashRows } from '../apple-crashes';

describe('Apple crash report counts', () => {
  it('sums crash events across versions/devices, not unique devices, with no fabricated zeros', () => {
    const row = (id:string, crashes:string, date='2026-09-08') => ({'App Apple Identifier':id, Date:date, Crashes:crashes, 'Unique Devices':'1'});
    expect(parseAppleCrashRows('app','123',[row('123','4'),row('123','7'),row('456','100'),row('123',''),row('123','-1'),row('123','0','2026-09-09')],'now')).toMatchObject([
      {date:'2026-09-08',value:11,metricKey:'crash_report_count',platform:'ios',quality:'estimated'},
      {date:'2026-09-09',value:0},
    ]);
  });
});
