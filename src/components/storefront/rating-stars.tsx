import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/**
 * Rating stars — REDESIGN.md Part 3.1: champagne is the accent for "a tiny
 * highlight", and a filled star is exactly that. Server component, purely
 * presentational.
 *
 * The accessible name is a translated string, not a template literal. It used
 * to read "Rated 5 out of 5 stars" in all nine locales — the class of bug the
 * i18n gate exists to catch and cannot see, because a hardcoded string is
 * never a missing key. `getTranslations` (rather than a `label` prop) keeps
 * all four call sites unchanged; each already resolves a request locale,
 * `/design-lab` included, which seeds one explicitly.
 *
 * Icons per Part 3.6: lucide, 1.5px stroke.
 */
export async function RatingStars({
  rating,
  outOf = 5,
  className,
}: {
  /** Rating value; fractions floor to whole stars filled. */
  rating: number;
  outOf?: number;
  className?: string;
}) {
  const filled = Math.floor(Math.max(0, Math.min(rating, outOf)));
  const t = await getTranslations("Common");

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-champagne", className)}
      role="img"
      aria-label={t("ratedOutOf", { rating, outOf })}
    >
      {Array.from({ length: outOf }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          strokeWidth={1.5}
          className={cn("size-4", i < filled && "fill-champagne")}
        />
      ))}
    </span>
  );
}
