import { Link } from "@/i18n/navigation";

import { cn } from "@/lib/utils";

/**
 * Breadcrumb — REDESIGN.md §7.1 (and every `compact` page rail).
 *
 * A mono micro trail, not a widget: `u-micro` carries the face, 11px, the
 * .14em tracking, the uppercase and the correct secondary ink for its scope,
 * and the crumbs are parted by a hairline `/` in graphite. The chunky lucide
 * chevron is gone — at 11px a 14px chevron outweighs the words it separates,
 * and Part 7 reserves icons for places where they support text rather than
 * punctuate it.
 *
 * The tap target is the one thing that must not shrink with the type. Part 17
 * puts the floor at 44×44px, but a 44px-tall breadcrumb rail would read as a
 * toolbar, so each link stretches an invisible 44px band above and below its
 * own text via `::after`. The trail stays 11px; the finger gets its 44px.
 *
 * Server component — a static trail, no state. Copy arrives pre-translated
 * from the caller, as every storefront primitive does.
 */

/* Part 16: 2px sapphire ring at 3px offset, champagne inside a dark band. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral in-data-[theme=navy]:focus-visible:ring-offset-obsidian";

/* The invisible 44px hit band. `inset-x-0` holds it inside the crumb's own
   width, so side-by-side targets never overlap and the 8px separation Part 17
   asks for is the `gap-2` between them. A trail long enough to wrap is the one
   case where two bands can overlap vertically; the later crumb paints on top,
   which puts the ambiguous strip on the crumb nearer the current page. */
const HIT_AREA =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";

export function Breadcrumb({
  items,
  className,
  /** Translated landmark name (Common.breadcrumb) — English fallback only
   *  for boundary contexts (re-audit R-011). */
  ariaLabel = "Breadcrumb",
}: {
  items: { label: string; href?: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <nav
      data-slot="sf-breadcrumb"
      aria-label={ariaLabel}
      className={cn("u-micro", className)}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const current = isLast ? ("page" as const) : undefined;

          return (
            <li
              key={`${i}-${item.label}`}
              className="flex items-center gap-2"
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className="select-none text-graphite/50 in-data-[theme=navy]:text-mist/50"
                >
                  /
                </span>
              )}
              {item.href ? (
                <Link
                  href={item.href}
                  aria-current={current}
                  className={cn(
                    HIT_AREA,
                    "inline-flex items-center rounded-input transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                    isLast
                      ? "text-ink in-data-[theme=navy]:text-mineral"
                      : "hover:text-sapphire in-data-[theme=navy]:hover:text-champagne",
                    FOCUS_RING,
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={current}
                  className={cn(
                    "inline-flex items-center",
                    isLast && "text-ink in-data-[theme=navy]:text-mineral",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
