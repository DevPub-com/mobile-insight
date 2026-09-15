import {afterEach, describe, expect, it, vi} from 'vitest';
import {appleRequestJson} from '../apple-request';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Apple transient failures', () => {
  it('retries a transient read and returns the recovered response', async () => {
    vi.useFakeTimers();
    const fetcher=vi.fn().mockResolvedValueOnce(new Response('', {status:503})).mockResolvedValueOnce(Response.json({data:[1]}));
    vi.stubGlobal('fetch',fetcher);
    const result=appleRequestJson('https://example.test');
    await vi.runAllTimersAsync();
    expect(await result).toEqual({data:[1]});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry unauthorized calls or replay report creation', async () => {
    const fetcher=vi.fn().mockResolvedValueOnce(new Response('',{status:401})).mockResolvedValueOnce(new Response('',{status:503}));
    vi.stubGlobal('fetch',fetcher);
    await expect(appleRequestJson('https://example.test')).rejects.toThrow('401');
    await expect(appleRequestJson('https://example.test',{method:'POST'})).rejects.toThrow('503');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
