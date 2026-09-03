"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";

import { QuickView } from "@/components/shop/quick-view";
import { Button } from "@/components/storefront/button";
import type { ShopProductItem } from "@/lib/shop";

/**
 * The card's "Quick view" ghost trigger — owns its own open state (a card
 * grid renders dozens of these; one shared dialog per card keeps each
 * independent rather than lifting state to the grid). Lives BELOW the card's
 * stretched click target and OUTSIDE it, `relative z-10` like the wishlist
 * heart, so it is reachable over the invisible full-card link rather than
 * silently triggering navigation instead of opening.
 */
export function QuickViewTrigger({ item }: { item: ShopProductItem }) {
  const t = useTranslations("Shop");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        // Flush, no horizontal padding — a 2-up mobile grid card is only
        // ~145px wide, narrower than this ghost line's own default padding
        // left room for (M-A3-1: caused real horizontal page overflow).
        // `--btn-pad` moves WITH `px-0` so the hover underline still starts
        // and ends exactly at the visible text, not in the padding it no
        // longer has.
        className="px-0 [--btn-pad:0rem]"
        aria-label={t("quickViewAria", { title: item.title })}
        onClick={() => setOpen(true)}
      >
        <Eye aria-hidden strokeWidth={1.5} className="size-4" />
        {t("quickViewLabel")}
      </Button>
      <QuickView item={item} open={open} onOpenChange={setOpen} />
    </>
  );
}
