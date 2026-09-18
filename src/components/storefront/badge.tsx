import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The storefront badge — REDESIGN.md §4.6.
 *
 * **One badge per card, and only three exist**: `Atelier pick` (a hard cap of
 * twelve across the whole site — a curation badge applied to everything
 * signals nothing), `Made to order`, and `Ships in 7–10 days`. Anything else a
 * card needs to say is metadata and belongs on the mono meta line, not in a
 * badge.
 *
 * The badge is mono micro on a near-opaque mineral chip, so it reads over a
 * photograph without a fill fighting the image. Champagne is never the ground:
 * §3.1 forbids a champagne fill outright, and a gold chip on every third card
 * is precisely the "gold-plated template" the palette rules exist to prevent.
 * Non-interactive, so no focus styles.
 */
const badgeVariants = cva(
  "u-micro inline-flex w-fit items-center gap-1.5 px-2.5 py-1 [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* Curation. The one badge that is a judgement rather than a fact. */
        atelierPick:
          "bg-obsidian/92 text-ink in-data-[theme=navy]:bg-obsidian/80 in-data-[theme=navy]:text-mineral",
        /* Facts about how the piece is made and when it arrives. */
        madeToOrder:
          "border border-hairline bg-transparent text-graphite in-data-[theme=navy]:border-hairline-dk in-data-[theme=navy]:text-mist",
        shipsIn:
          "border border-hairline bg-transparent text-graphite in-data-[theme=navy]:border-hairline-dk in-data-[theme=navy]:text-mist",
      },
    },
    defaultVariants: {
      variant: "madeToOrder",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="sf-badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { badgeVariants };
