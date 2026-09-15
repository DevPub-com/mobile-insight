import {describe, expect, it, vi} from 'vitest';
import {POST} from './route';
import {syncAllApps} from '@/services/sync/sync-app';
vi.mock('@/lib/env',()=>({getSyncSecret:()=> 'test-secret'}));
vi.mock('@/services/sync/sync-app',()=>({syncAllApps:vi.fn()}));
describe('scheduled sync result',()=>{
  it.each(['partial','failed','success'])('reports %s accurately',async status=>{
    vi.mocked(syncAllApps).mockResolvedValue([{app:'kis',platform:'ios',status,recordsCount:1}]);
    const response=await POST(new Request('https://example.test/api/sync?type=voc',{method:'POST',headers:{authorization:'Bearer test-secret'}}));
    expect(response.status).toBe(status==='success'?200:502);
    expect(syncAllApps).toHaveBeenCalledWith('voc');
  });
});
