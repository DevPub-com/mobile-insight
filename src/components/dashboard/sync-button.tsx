"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { DpButton } from "@/components/ui/dp/DpButton";

export function SyncButton({ appId }: { appId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const busy = syncing || refreshing;

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
      setMessage(failed ? "일부 데이터 수집에 실패했습니다. 앱 관리에서 동기화 상태를 확인해주세요." : "데이터 동기화가 완료되었습니다.");
      startTransition(() => router.refresh());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "동기화하지 못했습니다.");
    } finally {
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
