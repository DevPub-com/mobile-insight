"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { DpButton } from "@/components/ui/dp/DpButton";

export function SyncButton({ appId, revision }: { appId: string; revision: string | null }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const busy = syncing || refreshing;

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let knownRevision = revision;
    const controller = new AbortController();
    async function check() {
      try {
        if (document.visibilityState === "visible" && !inFlight.current) {
          const response = await fetch(`/api/dashboard/${encodeURIComponent(appId)}/sync`, { cache: "no-store", signal: controller.signal });
          if (response.ok) {
            const result = await response.json() as { revision: string | null; running?: boolean };
            if (!stopped && !inFlight.current && !result.running && result.revision !== knownRevision) {
              knownRevision = result.revision;
              startTransition(() => router.refresh());
            }
          }
        }
      } catch {
        // Retry on the next poll without interrupting the user's current view.
      } finally {
        if (!stopped) timer = setTimeout(check, 15000);
      }
    }
    void check();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [appId, revision, router]);

  async function sync() {
    if (inFlight.current || busy) return;
    inFlight.current = true;
    setSyncing(true);
    setMessage("데이터 동기화 중…");
    try {
      const response = await fetch(`/api/dashboard/${encodeURIComponent(appId)}/sync`, { method: "POST" });
      if (!response.ok) {
        throw new Error(response.status === 401 ? "인증이 필요합니다. 새로고침 후 다시 시도해주세요." : "동기화하지 못했습니다. 잠시 후 다시 시도해주세요.");
      }
      const result = await response.json() as { data: { status: string }[] };
      const failed = result.data.filter((item) => item.status !== "success").length;
      startTransition(() => router.refresh());
      setMessage(failed ? "일부 데이터 수집에 실패했습니다. 앱 관리에서 동기화 상태를 확인해주세요." : "데이터 동기화가 완료되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동기화하지 못했습니다.");
    } finally {
      // On failure keep the current view; completion polling refreshes persisted data later.
      inFlight.current = false;
      setSyncing(false);
    }
  }

  return (
    <div className="mi-sync-control">
      <DpButton
        type="button"
        className="mi-sync-button"
        title={busy ? "데이터 동기화 중" : "데이터 동기화"}
        aria-label={busy ? "데이터 동기화 중" : "데이터 동기화"}
        aria-busy={busy}
        disabled={busy}
        onClick={sync}
      >
        <RefreshCw size={18} aria-hidden="true" className={busy ? "animate-spin motion-reduce:animate-none" : undefined} />
      </DpButton>
      <span className="mi-sync-status" role="status">{message}</span>
    </div>
  );
}
