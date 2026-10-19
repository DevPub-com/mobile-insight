"use client";

import {
  forwardRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type DpLayoutProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  children?: ReactNode;
  display?: "flex" | "inline-flex" | "grid";
  direction?: "row" | "col";
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  gap?: number;
};

export const DpLayout = forwardRef<HTMLElement, DpLayoutProps>(
  function DpLayout(
    {
      as: Component = "div",
      display = "flex",
      direction = "col",
      align = display === "grid" ? undefined : "stretch",
      justify = display === "grid" ? undefined : "start",
      gap,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <Component
        ref={ref}
        className={cn(
          { flex: "flex", "inline-flex": "inline-flex", grid: "grid" }[display],
          display !== "grid" && (direction === "row" ? "flex-row" : "flex-col"),
          align &&
            {
              start: "items-start",
              center: "items-center",
              end: "items-end",
              stretch: "items-stretch",
            }[align],
          justify &&
            {
              start: "justify-start",
              center: "justify-center",
              end: "justify-end",
              between: "justify-between",
            }[justify],
          gap !== undefined && `gap-${gap}`,
          className,
        )}
        {...props}
      />
    );
  },
);
