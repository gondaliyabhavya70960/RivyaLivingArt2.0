"use client";

import { useTranslations } from "next-intl";
import { Heart } from "lucide-react";

import { toggleWishlist, useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

/**
 * Wishlist heart for product cards — sits top-right over the image, outside
 * the card link. Hidden until hover/focus (always shown on touch and while
 * the piece is saved). Same dark-glass chip register as the QuickView
 * trigger; the saved state fills the heart in the azure ink — never gold
 * (gold stays a hairline accent, design.md).
 */
export function WishlistButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const t = useTranslations("Shop");
  const saved = useWishlist().includes(slug);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={
        saved
          ? t("card.wishlistRemove", { title })
          : t("card.wishlistSave", { title })
      }
      onClick={() => toggleWishlist(slug)}
      className={cn(
        // 36px visual chip; ::after extends the hit area to 44px without
        // shifting layout over the card link (UIUX-P11).
        // No backdrop blur: Part 3.5 keeps blur to the header, and this chip
        // sits on every catalogue card. A denser obsidian ground carries the
        // contrast the blur used to.
        "relative flex size-9 cursor-pointer items-center justify-center rounded-sm border border-mineral/20 bg-obsidian/80 text-mineral transition-[opacity,border-color,background-color] duration-(--dur-fast) ease-(--ease-luxury) after:absolute after:-inset-1 hover:border-mineral/45 hover:bg-obsidian/90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none",
        // Hidden hearts get pointer-events-none so they never intercept a
        // corner tap over the card link; touch devices always show them
        // (UIUX-006), and a saved heart stays visible everywhere.
        saved
          ? "opacity-100"
          : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn("size-4", saved && "fill-current text-sapphire-ink")}
      />
    </button>
  );
}
