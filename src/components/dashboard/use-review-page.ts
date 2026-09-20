"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppReview } from "@/domain/types";

export type ReviewPageResponse = { data: AppReview[]; pagination: { total: number; nextCursor: string | null } };
type State = { key: string; items: AppReview[]; total: number; nextCursor: string | null; loading: boolean; error?: string };

async function fetchPage(appCode: string, query: string, cursor: string | null, signal: AbortSignal): Promise<ReviewPageResponse> {
  const params = new URLSearchParams(query);
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`/api/dashboard/${encodeURIComponent(appCode)}/reviews?${params}`, { signal });
  if (!response.ok) throw Error("리뷰를 불러오지 못했습니다.");
  return response.json();
}

export function useReviewPage(appCode: string, query: string, enabled: boolean) {
  const key = `${appCode}:${query}`;
  const [state, setState] = useState<State | null>(null);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const active = new AbortController();
    controller.current = active;
    busy.current = true;
    fetchPage(appCode, query, null, active.signal).then(body => {
      if (!active.signal.aborted) setState({ key, items: body.data, total: body.pagination.total, nextCursor: body.pagination.nextCursor, loading: false });
    }).catch(() => {
      if (!active.signal.aborted) setState({ key, items: [], total: 0, nextCursor: null, loading: false, error: "리뷰를 불러오지 못했습니다." });
    }).finally(() => { if (!active.signal.aborted) busy.current = false; });
    return () => active.abort();
  }, [enabled, appCode, query, key]);
  const current = state?.key === key ? state : null;
  const requestMore = useCallback(async (cursor: string | null, append: boolean) => {
    const signal = controller.current?.signal;
    if (!enabled || !signal || signal.aborted || busy.current) return;
    busy.current = true;
    setState(previous => ({ key, items: previous?.key === key ? previous.items : [], total: previous?.key === key ? previous.total : 0,
      nextCursor: cursor, loading: true }));
    try {
      const body = await fetchPage(appCode, query, cursor, signal);
      if (!signal.aborted) setState(previous => ({ key,
        items: append && previous?.key === key ? [...new Map([...previous.items, ...body.data].map(item => [item.id, item])).values()] : body.data,
        total: body.pagination.total, nextCursor: body.pagination.nextCursor, loading: false }));
    } catch {
      if (!signal.aborted) setState(previous => ({ key, items: previous?.key === key ? previous.items : [], total: previous?.key === key ? previous.total : 0,
        nextCursor: cursor, loading: false, error: "리뷰를 불러오지 못했습니다." }));
    } finally { if (!signal.aborted) busy.current = false; }
  }, [enabled, appCode, query, key]);
  const loadMore = useCallback(() => { if (current?.nextCursor) void requestMore(current.nextCursor, true); }, [current, requestMore]);
  return { items: current?.items ?? [], total: current?.total ?? 0, loading: enabled && (!current || current.loading),
    error: current?.error, hasMore: !!current?.nextCursor, loadMore,
    retry: () => { void requestMore(current?.nextCursor ?? null, !!current?.items.length); } };
}
