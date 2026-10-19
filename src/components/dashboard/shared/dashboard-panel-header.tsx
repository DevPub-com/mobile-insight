"use client";
import { DpLayout } from "@/components/ui/dp/DpLayout";
import { DpText } from "@/components/ui/dp/DpText";
import type { ReactNode } from "react";

export function DashboardPanelHeader({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <DpLayout
      direction="row"
      align="center"
      justify="between"
      className="mi-panel-head mi-dashboard-panel-head"
    >
      <DpText as="h3">{title}</DpText>
      {children}
    </DpLayout>
  );
}
