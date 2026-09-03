"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="setup-state">
      <div className="brand-mark">MI</div>
      <p>MOBILE INSIGHT</p>
      <h1>화면을 불러오지 못했습니다</h1>
      <span>잠시 후 다시 시도하거나 동기화 상태를 확인하세요.</span>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
