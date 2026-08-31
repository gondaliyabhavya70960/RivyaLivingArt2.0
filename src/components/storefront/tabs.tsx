"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

/**
 * v2.0 storefront Tabs (DESIGN.md B3 — PDP specs/care/reviews panes).
 * Wrapper over @radix-ui/react-tabs with v2.0 tokens: an underline tab bar
 * on a mist hairline; the active tab is royal blue — the one interactive
 * color (A2 rule 2) — marked by BOTH the 2px underline and a weight bump so
 * state is never color-only (A5). Triggers keep the 44px floor (min-h-11)
 * and the A2 rule 4 focus ring; a constant transparent border prevents
 * layout shift on activation. Panels show a ring only for keyboard focus
 * (focus-visible). Radix supplies roving tablist keyboard semantics.
 */
export function Tabs({
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="sf-tabs" {...props} />;
}

export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="sf-tabs-list"
      className={cn("flex gap-6 border-b border-hairline", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="sf-tabs-trigger"
      className={cn(
        "-mb-px inline-flex min-h-11 items-center border-b-2 border-transparent pb-3 font-body text-14 text-graphite outline-none",
        "transition-colors duration-(--dur-micro) ease-(--ease-out) hover:text-ink motion-reduce:transition-none",
        "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        "data-[state=active]:border-sapphire data-[state=active]:font-medium data-[state=active]:text-sapphire",
        "disabled:pointer-events-none disabled:opacity-50",
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
      data-slot="sf-tabs-content"
      className={cn(
        "pt-6 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}
