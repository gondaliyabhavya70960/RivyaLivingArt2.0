"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/**
 * Studio tabs — the shadcn semantic layer's version, separate from
 * `storefront/tabs.tsx` on purpose: that one is the v3 storefront vocabulary
 * (`text-graphite`, `font-body`, an underline bar on a hairline), and the
 * Studio reads the `.studio-v2` scope. Sharing one component would mean one of
 * the two rendering in the other's palette.
 *
 * **Why a primitive at all, rather than the buttons this replaces.** The
 * hand-rolled language strip in `translations-section.tsx` declared
 * `role="tablist"` and `role="tab"` and then did not honour the pattern:
 *
 * - No `aria-controls`, and the panel had no `role="tabpanel"` — the
 *   relationship was announced and then not wired.
 * - No roving `tabindex`. All NINE locale buttons were separate tab stops, so
 *   reaching the fields past the strip meant nine presses of Tab, and the
 *   Left/Right arrows the pattern promises did nothing.
 *
 * Radix supplies exactly that: one tab stop for the strip, arrows to move
 * between languages, `Home`/`End`, and the id wiring. This file is the
 * tokens on top.
 *
 * `variant="pill"` is the language strip's look — a rounded chip that can
 * carry a "has content" dot; `variant="underline"` is the default bar for the
 * editor tabs Phase 11 adds. Both keep the 44px tap floor and the Part 16
 * focus ring.
 */
export function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  );
}

export function TabsList({
  className,
  variant = "underline",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  variant?: "underline" | "pill";
}) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        variant === "underline"
          ? "flex gap-6 border-b border-border"
          : "flex flex-wrap gap-2",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  variant = "underline",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  variant?: "underline" | "pill";
}) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-sm outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
        variant === "underline"
          ? // A constant transparent border keeps activation from shifting the
            // row, and the weight bump means state is never colour-only.
            "-mb-px border-b-2 border-transparent pb-3 text-muted-foreground data-[state=active]:border-primary data-[state=active]:font-medium data-[state=active]:text-foreground"
          : "rounded-full border border-foreground/10 px-3 py-1.5 text-muted-foreground hover:border-foreground/25 hover:text-foreground data-[state=active]:border-sapphire-ink/50 data-[state=active]:bg-sand data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-focus",
        className,
      )}
      {...props}
    />
  );
}
