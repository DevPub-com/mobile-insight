"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function DpSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 rounded-lg border border-[var(--mi-border)] bg-white px-3 text-[12px] font-bold text-[var(--mi-ink)] outline-none focus:border-[#356df3]", className)} {...props} />;
}
