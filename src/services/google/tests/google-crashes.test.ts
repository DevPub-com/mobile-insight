import { describe, expect, it, vi } from 'vitest';
import { fetchGoogleCrashCounts, normalizeGoogleCrashCounts } from '../google-crashes';

describe('Google crash report counts', () => {
  it('keeps crash reports separate from ANR and rejects missing/negative counts', () => {
    const row = (type: string, value?: string) => ({ startTime: { year: 2026, month: 9, day: 8 }, dimensions: [{ dimension: 'reportType', stringValue: type }], metrics: [{ metric: 'errorReportCount', decimalValue: value }] });
    expect(normalizeGoogleCrashCounts('app', [row('CRASH', '12'), row('APPLICATION_NOT_RESPONDING', '5'), row('CRASH'), row('CRASH', '-1')], 'now')).toMatchObject([{ metricKey: 'crash_report_count', value: 12, date: '2026-09-08' }]);
  });
  it('uses daily freshness and retrieves all pages', async () => {
    const request = vi.fn().mockResolvedValueOnce({data: {freshnessInfo:{freshnesses:[{aggregationPeriod:'DAILY',latestEndTime:{year:2026,month:9,day:9,hours:4,timeZone:{id:"America/Los_Angeles"}}}]}}})
      .mockResolvedValueOnce({data:{rows:[],nextPageToken:'next'}}).mockResolvedValueOnce({data:{rows:[]}});
    await fetchGoogleCrashCounts({id:'app',packageName:'com.example'}, request, new Date('2026-09-10T00:00:00Z'), 30);
    expect(request.mock.calls[1][0].data).toMatchObject({dimensions:['reportType'],metrics:['errorReportCount'],timelineSpec:{aggregationPeriod:'DAILY',endTime:{year:2026,month:9,day:9}}});
    expect(request.mock.calls[1][0].data.timelineSpec.endTime).not.toHaveProperty('hours');
    expect(request.mock.calls[2][0].data.pageToken).toBe('next');
  });
});
