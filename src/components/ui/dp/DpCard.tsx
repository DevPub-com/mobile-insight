"use client";

import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DpLayout } from "./DpLayout";

export function DpCard({
  as: Component = "section",
  variant = "default",
  children,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children: ReactNode;
  variant?: "default" | "custom";
}) {
  if (variant === "custom")
    return (
      <Component className={className} {...props}>
        {children}
      </Component>
    );
  return (
    <DpLayout
      as={Component}
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
