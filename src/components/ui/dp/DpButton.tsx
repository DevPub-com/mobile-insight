"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DpButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button className={cn("inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#356df3] disabled:pointer-events-none disabled:opacity-40", className)} {...props}>{children}</button>;
}
