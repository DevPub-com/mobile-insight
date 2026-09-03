"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TextSize =
  | "extraSmall"
  | "small"
  | "medium"
  | "large"
  | "extraLarge";

const sizeClassNames: Record<TextSize, string> = {
  extraSmall: "text-xs",
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
  extraLarge: "text-xl",
};

export type DpTextProperties<Element extends ElementType = "p"> = {
  as?: Element;
  size?: TextSize;
  children?: ReactNode;
} & Omit<ComponentPropsWithoutRef<Element>, "as" | "size" | "children">;

export function DpText<Element extends ElementType = "p">({
  as,
  size,
  children,
  className,
  ...properties
}: DpTextProperties<Element>) {
  const Component = as || "p";

  return (
    <Component
      className={cn("m-0 break-keep", size ? sizeClassNames[size] : undefined, className)}
      {...properties}
    >
      {children}
    </Component>
  );
}
