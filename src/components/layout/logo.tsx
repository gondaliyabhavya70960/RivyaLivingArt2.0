import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Rivya Living Art wordmark, typeset in the brand display face.
 *
 * This replaces the previous hand-drawn vector, whose letterforms spelled the
 * old brand name in path data — renaming only its `aria-label` would have left
 * the accessible name describing artwork that said something else.
 *
 * `<text>` rather than outlines so it stays one line to edit and inherits
 * `--font-display` (Instrument Serif). The viewBox was measured against the
 * rendered glyphs rather than guessed (ink is 626.5 units wide at this size),
 * so it hugs cap-height to descender with no dead space, and
 * `preserveAspectRatio` keeps the glyphs whole at any height — the
 * `h-full w-auto` contract every call site relies on still holds.
 *
 * If a bespoke drawn wordmark is commissioned later, swap the <text> for its
 * paths and keep the viewBox — nothing else needs to change.
 */
export function LogoWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 15 627 110"
      role="img"
      aria-label="Rivya Living Art"
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-auto", className)}
    >
      <text
        x="0"
        y="97"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="112"
        letterSpacing="1.5"
        fill="currentColor"
      >
        Rivya Living Art
      </text>
    </svg>
  );
}

/**
 * Home link wrapping the wordmark. Color flows in by inheritance from the
 * link's text color, so:
 *   • header  → pass `text-header-ink` (porcelain on the all-dark public site);
 *   • footer / studio (dark surfaces) → pass `text-mineral` for white.
 * Default height is h-8; pass an h-* class to resize.
 */
export function Logo({
  className,
  /** The wordmark's own height class (default `h-8`). Explicit rather than
   *  `h-full` because the link's box grows to the 44px coarse-pointer floor
   *  and a `w-auto` SVG following that height would grow 37% wider with it
   *  — measured as a 9px horizontal overflow at 390px under touch. */
  wordmarkClassName,
  href = "/",
  /** Translated home label; the English default serves the staff studio. */
  ariaLabel = "Rivya Living Art — home",
  /** Storefront callers pass next-intl's Link so href stays locale-prefixed
   *  (re-audit R-012); the locale-less studio keeps plain next/link. */
  LinkComponent = Link,
}: {
  className?: string;
  wordmarkClassName?: string;
  href?: string;
  ariaLabel?: string;
  LinkComponent?: React.ElementType;
}) {
  return (
    <LinkComponent
      href={href}
      aria-label={ariaLabel}
      className={cn(
        // 44px hit area on coarse pointers (Part 17 tap floor); the visual
        // height stays whatever the caller sets.
        "inline-flex h-8 items-center text-current pointer-coarse:min-h-11",
        className,
      )}
    >
      <LogoWordmark className={cn("h-8", wordmarkClassName)} />
    </LinkComponent>
  );
}

/** R monogram mark (currentColor) for compact placements. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label="Rivya Living Art monogram"
      className={cn("h-8 w-8", className)}
      fill="none"
    >
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontFamily="var(--font-display), Georgia, serif"
        fontSize="19"
        letterSpacing="-1"
        fill="currentColor"
      >
        R
      </text>
    </svg>
  );
}
