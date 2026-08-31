import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * v2.0 rating stars (DESIGN.md B3 · A2 rule 5): star ratings are true gold
 * #D4AF37 — one of gold's two sanctioned jobs on any surface. Server
 * component; purely presentational with an accessible text alternative.
 * Icons per A4: lucide, 1.5px stroke.
 */
export function RatingStars({
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

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-champagne", className)}
      role="img"
      aria-label={`Rated ${rating} out of ${outOf} stars`}
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
