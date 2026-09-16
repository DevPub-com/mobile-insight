import {describe,it,expect,vi} from 'vitest';
import {fetchNonfatalDetails,nonfatalFilter} from '../google-nonfatal';
describe('version nonfatal details',()=>{
 it('validates version and OS filters',()=>{
  expect(nonfatalFilter(['123','456'],'35')).toBe('versionCode = 123 OR versionCode = 456 AND errorIssueType = NON_FATAL AND apiLevel = 35');
  expect(()=>nonfatalFilter(['123 OR 1=1'])).toThrow();
 });
 it('keeps only selected version nonfatal rows and requests ranked issues',async()=>{
  const row=(type:string,version:string)=>({startTime:{year:2026,month:9,day:12},dimensions:[{dimension:'reportType',stringValue:type},{dimension:'versionCode',stringValue:version},{dimension:'apiLevel',stringValue:'35'}],metrics:[{metric:'errorReportCount',decimalValue:{value:'4'}}]});
  const request=vi.fn().mockResolvedValueOnce({data:{errorIssues:[{name:'apps/test/issues/1',type:'NON_FATAL',cause:'Example',errorReportCount:'4',distinctUsers:'3'}]}})
   .mockResolvedValueOnce({data:{freshnessInfo:{freshnesses:[{aggregationPeriod:'DAILY',latestEndTime:{year:2026,month:9,day:14}}]}}})
   .mockResolvedValueOnce({data:{rows:[row('NON_FATAL','123'),row('CRASH','123'),row('NON_FATAL','999')]}});
  const result=await fetchNonfatalDetails('test',['123'],'2026-09-12T00:00:00Z',request,undefined,undefined,new Date('2026-09-15'));
  expect(result).toMatchObject({daily:[{date:'2026-09-12',os:'35',count:4}],issues:[{cause:'Example',count:4,users:3}]});
  const query=new URL(request.mock.calls[0][0].url).searchParams;
  expect(query.get('filter')).toBe('versionCode = 123 AND errorIssueType = NON_FATAL');
  expect(query.get('orderBy')).toBe('errorReportCount desc');
 });
 it('fetches a representative trace using the same version, OS and issue filters',async()=>{
  const request=vi.fn().mockResolvedValue({data:{errorReports:[{type:'NON_FATAL',reportText:'frame\nat Example.run()'}]}});
  const result=await fetchNonfatalDetails('test',['123'],'2026-09-12',request,'35','abc',new Date('2026-09-15'));
  expect(result).toEqual({trace:'frame\nat Example.run()'});
  expect(new URL(request.mock.calls[0][0].url).searchParams.get('filter')).toContain('apiLevel = 35 AND errorIssueId = abc');
 });
});
