"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DpLayout } from "./DpLayout";

export function DpCard({
  as = "section",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: ElementType; children: ReactNode }) {
  return (
    <DpLayout
      as={as}
      className={cn(
        "rounded-2xl border border-[var(--mi-border)] bg-white shadow-[0_8px_24px_rgba(15,23,42,.055)]",
        className,
      )}
      {...props}
    >
      {children}
    </DpLayout>
  );
}
