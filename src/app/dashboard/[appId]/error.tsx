"use client";

import { DpText } from "@/components/ui/dp/DpText";
import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="setup-state">
      <div className="brand-mark">MI</div>
      <DpText as="p" wrap="inherit">MOBILE INSIGHT</DpText>
      <DpText as="h1" wrap="inherit">화면을 불러오지 못했습니다</DpText>
      <DpText as="span" wrap="inherit">잠시 후 다시 시도하거나 동기화 상태를 확인하세요.</DpText>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
