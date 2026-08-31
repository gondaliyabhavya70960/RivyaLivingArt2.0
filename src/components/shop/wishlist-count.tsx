"use client";

import { useTranslations } from "next-intl";

import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

/**
 * Saved-pieces count badge for the site header (mounted by the header
 * owner — this component carries no layout assumptions). Subscribes to the
 * localStorage wishlist store; renders nothing while the list is empty, so
 * the chrome stays quiet until the visitor saves a piece. Server-renders
 * empty (the device list is unknowable at SSR) and fills in on hydration.
 */
export function WishlistCount({ className }: { className?: string }) {
  const t = useTranslations("Wishlist");
  const count = useWishlist().length;
  if (count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded-sm bg-sapphire px-1 text-[10px] font-medium leading-4 text-mineral tabular-nums",
        className,
      )}
    >
      <span aria-hidden>{count}</span>
      <span className="sr-only">{t("countLabel", { count })}</span>
    </span>
  );
}
