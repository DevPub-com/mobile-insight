/** Retry transient failures for read requests only; never replay report creation. */
export async function appleRequestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const attempts = !init.method || init.method === "GET" ? 3 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let retryDelay = 1000 * 2 ** attempt;
    try {
      const timeout = AbortSignal.timeout(30_000);
      const response = await fetch(url, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
      });
      if (response.ok) return await response.json() as T;
      const retryable = response.status === 429 || response.status >= 500;
      const retryAfter = response.headers.get("retry-after");
      if (retryAfter) {
        const seconds = Number(retryAfter);
        const milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(milliseconds)) retryDelay = Math.min(60_000, Math.max(retryDelay, milliseconds));
      }
      await response.body?.cancel();
      if (!retryable || attempt === attempts - 1) throw new AppleHttpError(response.status);
    } catch (error) {
      if (error instanceof AppleHttpError || init.signal?.aborted || attempt === attempts - 1) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  throw new Error("Apple request exhausted");
}
class AppleHttpError extends Error {
  constructor(status: number) { super(`App Store request failed: HTTP ${status}`); }
}
