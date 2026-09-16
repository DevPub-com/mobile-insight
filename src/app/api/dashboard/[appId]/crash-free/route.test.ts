import { beforeEach, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({where:vi.fn(),load:vi.fn()}));
vi.mock('@/db',()=>({getDb:()=>({select:()=>({from:()=>({where:mocks.where})})})}));
vi.mock('@/services/firebase/crash-free',()=>({loadFirebaseCrashFree:mocks.load}));
import { GET } from './route';
const params=Promise.resolve({appId:'app-id'});
beforeEach(()=>{vi.clearAllMocks();mocks.where.mockResolvedValue([{code:'kis'}]);});
it('rejects invalid dates and excessive query ranges before reading BigQuery',async()=>{
 for(const range of ['from=2026-02-30&to=2026-03-01','from=2024-01-01&to=2026-09-16','from=2026-09-16&to=2026-09-01']){
  expect((await GET(new Request(`http://localhost/api?${range}`),{params})).status).toBe(400);
 }
 expect(mocks.load).not.toHaveBeenCalled();
});
it('returns per-platform pending states without substituting Google Play values',async()=>{
 const data={android:{status:'sessions_missing',value:null},ios:{status:'sessions_missing',value:null}};
 mocks.load.mockResolvedValue(data);
 const response=await GET(new Request('http://localhost/api?from=2026-08-18&to=2026-09-16'),{params});
 expect(await response.json()).toEqual({data});
 expect(mocks.load).toHaveBeenCalledWith('kis',{startDate:'2026-08-18',endDate:'2026-09-16'});
 expect(response.headers.get('Cache-Control')).toBe('no-store');
});
it('reports upstream failures without exposing credential details',async()=>{
 mocks.load.mockRejectedValue(new Error('sensitive upstream details'));
 const response=await GET(new Request('http://localhost/api?from=2026-09-01&to=2026-09-16'),{params});
 expect(response.status).toBe(502);
 expect(await response.text()).not.toContain('sensitive');
});
