"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DpBadge({ children, className, ...props }: HTMLAttributes<HTMLSpanElement> & { children: ReactNode }) {
  return <span className={cn("inline-flex h-5 items-center rounded-full bg-[#edf3ff] px-2 text-[10px] font-extrabold text-[#356df3]", className)} {...props}>{children}</span>;
}
