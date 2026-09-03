"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * v2.0 storefront Modal/Dialog (DESIGN.md B3 · A5). Thin wrapper over
 * @radix-ui/react-dialog, restyled with v2.0 tokens: navy scrim with blur,
 * card surface at the A5 modal radius (20px), fade+zoom entrance on the B4
 * micro timing (duration-(--dur-fast) · ease-(--ease-luxury)), static under
 * reduced motion. The built-in close X keeps the A5 44px floor (size-11)
 * with the A2 rule 4 focus ring and an sr-only label. "use client" because
 * radix dialogs are stateful by nature.
 */
export function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sf-dialog" {...props} />;
}

export function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sf-dialog-trigger" {...props} />;
}

export function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="sf-dialog-close" {...props} />;
}

/**
 * Obsidian scrim, no blur — Part 3.5 allows blur in exactly one place (the
 * sticky header), and this overlay sits under every lightbox on the site.
 * The scrim is a shade darker than it was with the blur so the page behind
 * still recedes; tw-animate fade in/out on --dur-fast.
 */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sf-dialog-overlay"
      className={cn(
        "fixed inset-0 z-(--z-dialog) bg-obsidian/70",
        "duration-(--dur-fast) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** Accessible label for the built-in close button. */
  closeLabel?: string;
}) {
  return (
    <DialogPrimitive.Portal data-slot="sf-dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="sf-dialog-content"
        /* The portal lands on document.body — under the root html.dark scope,
           where --focus resolves GOLD (A2 r4 violation on this white surface).
           Default the portaled surface back to the light token scope; callers
           override by passing their own data-theme (props spread last). */
        data-theme="light"
        className={cn(
          "fixed top-1/2 left-1/2 z-(--z-dialog) grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rounded-modal bg-sand p-6 text-ink outline-none",
          "duration-(--dur-fast) ease-(--ease-luxury) data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 motion-reduce:animate-none",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="sf-dialog-close"
            className="absolute top-1.5 end-1.5 flex size-11 items-center justify-center rounded-full text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-ink focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:pointer-events-none motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0"
          >
            <X aria-hidden strokeWidth={1.5} className="size-4" />
            <span className="sr-only">{closeLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sf-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-start", className)}
      {...props}
    />
  );
}

/** Dialog titles are editorial — Fraunces at text-20 (A3), display tracking. */
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sf-dialog-title"
      className={cn(
        "font-display text-20 font-medium tracking-display text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sf-dialog-description"
      className={cn("font-body text-14 text-graphite", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sf-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
