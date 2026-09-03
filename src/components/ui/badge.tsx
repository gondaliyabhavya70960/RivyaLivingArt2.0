import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-sapphire text-primary-foreground",
        secondary: "border-transparent bg-muted text-foreground",
        gold: "border-champagne/50 bg-champagne/10 text-champagne-ink",
        outline: "border-border text-foreground",
        // Status tones. Eight call sites hand-rolled these as
        // `variant="outline"` plus `border-<tone>/40 text-<tone>` — and drifted:
        // the same "this is fine" green was /40 in the scraper and /50 on the
        // commission board, so two screens an owner moves between all day drew
        // the same state at two different weights. One name, one weight.
        success: "border-success/40 bg-success/8 text-success",
        warning: "border-warning/40 bg-warning/8 text-warning",
        alert: "border-alert/40 bg-alert/8 text-alert",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
