import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncButton } from './sync-button';
const state = vi.hoisted(() => ({refresh: vi.fn(), effect: undefined as undefined | (() => () => void)}));
vi.mock('next/navigation', () => ({useRouter: () => ({refresh: state.refresh})}));
vi.mock('react', async importOriginal => ({...await importOriginal<typeof import('react')>(),
  useRef: (value: unknown) => ({current: value}),
  useState: (value: unknown) => [value, vi.fn()],
  useTransition: () => [false, (callback: () => void) => callback()],
  useEffect: (effect: () => () => void) => { state.effect = effect; },
}));
beforeEach(() => { state.refresh.mockClear(); vi.useFakeTimers(); vi.stubGlobal('document', {visibilityState:'visible'}); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('sync refresh', () => {
  it('reloads persisted data even when the POST times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status:504})));
    const button = SyncButton({appId:'app',revision:null});
    await button.props.children[0].props.onClick();
    expect(state.refresh).toHaveBeenCalledOnce();
  });
  it('refreshes only on completion changes and stops polling on unmount', async () => {
    const fetcher=vi.fn()
      .mockResolvedValueOnce(Response.json({revision:'old'}))
      .mockResolvedValueOnce(Response.json({revision:'new'}))
      .mockResolvedValueOnce(Response.json({revision:'new'}));
    vi.stubGlobal('fetch', fetcher);
    SyncButton({appId:'app',revision:'old'});
    const cleanup=state.effect!();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);
    expect(state.refresh).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(15000);
    expect(state.refresh).toHaveBeenCalledOnce();
    cleanup();
    await vi.advanceTimersByTimeAsync(30000);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
