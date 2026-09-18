import { ChevronLeft, ChevronRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Pagination — REDESIGN.md §7.7: "Numbered, mono, with prev/next."
 *
 * Server component — pure links, the consumer supplies `hrefFor`, so every
 * page stays bookmarkable and crawlable (and `Load more` remains a separate
 * option; §7.7 rules out infinite scroll either way).
 *
 * Three things changed from v2.0's version:
 *
 * - **The filled royal pill is gone.** A solid pill is the loudest object in a
 *   quiet page's footer, and it reads as a button rather than as "you are
 *   here". The current page is ink with a 2px sapphire underline — the same
 *   active mark the shop's category switcher uses (§7.2), so "current" means
 *   one thing across the site.
 * - **Numerals are mono and tabular** (`u-num`), per Part 3.2's rule that
 *   every count on the site is JetBrains Mono. Tabular figures stop the row
 *   shifting as the window slides from 9 to 10.
 * - **Numbers are parted by hairlines, not boxes** (Part 3.5). The row reads
 *   as a fine ruler; prev/next sit outside it with whitespace.
 *
 * Targets stay at 44px (`size-11`, Part 17) even though the glyphs are 14px.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const shown = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) shown.add(p);
  }
  const sorted = [...shown].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  let prev = 0;
  for (const page of sorted) {
    if (prev !== 0 && page - prev === 2) {
      // A one-page hole reads better as the number itself than as "…".
      items.push(prev + 1);
    } else if (prev !== 0 && page - prev > 2) {
      items.push("gap");
    }
    items.push(page);
    prev = page;
  }
  return items;
}

/* Part 16: 2px sapphire ring at 3px offset, champagne inside a dark band. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-background in-data-[theme=navy]:focus-visible:ring-offset-obsidian";

const TARGET =
  "inline-flex size-11 shrink-0 items-center justify-center transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none";

const ARROW = cn(
  TARGET,
  "rounded-input text-ink hover:text-sapphire-ink in-data-[theme=navy]:text-mineral in-data-[theme=navy]:hover:text-champagne",
  FOCUS_RING,
);

export function Pagination({
  currentPage,
  totalPages,
  hrefFor,
  labels,
  pageOfLabel,
}: {
  currentPage: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** Pre-translated "Page X of Y" line, rendered beside the controls. */
  pageOfLabel?: string;
  /** Translated a11y labels — every field falls back to its English default. */
  labels?: {
    label?: string;
    previous?: string;
    next?: string;
    /** Raw template carrying a "{number}" placeholder, e.g. "Page {number}". */
    page?: string;
  };
}) {
  const current = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));
  const atStart = current <= 1;
  const atEnd = current >= totalPages;

  return (
    <nav
      aria-label={labels?.label ?? "Pagination"}
      data-slot="sf-pagination"
      /* flex-wrap: seven 44px targets plus arrows exceed a 360–400px viewport
         (Part 0 audit A-001) — the row breaks instead of overflowing. */
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <Link
        href={hrefFor(atStart ? current : current - 1)}
        aria-label={labels?.previous ?? "Previous page"}
        aria-disabled={atStart || undefined}
        tabIndex={atStart ? -1 : undefined}
        /* Part 16: disabled is 40% opacity. The slot is kept so the row does
           not reflow at the bounds. */
        className={cn(ARROW, atStart && "pointer-events-none opacity-40")}
      >
        <ChevronLeft
          aria-hidden
          strokeWidth={1.5}
          className="size-4 rtl:-scale-x-100"
        />
      </Link>

      <ol className="flex items-center">
        {pageWindow(current, Math.max(totalPages, 1)).map((item, i) => (
          <li
            key={item === "gap" ? `gap-${i}` : item}
            /* Part 3.5 · the hairline is the only separator on the site. */
            className={cn(
              "flex",
              i > 0 &&
                "border-s border-hairline in-data-[theme=navy]:border-hairline-dk",
            )}
          >
            {item === "gap" ? (
              <span
                aria-hidden
                className={cn(TARGET, "u-num text-small text-graphite")}
              >
                &hellip;
              </span>
            ) : (
              <Link
                href={hrefFor(item)}
                aria-label={
                  labels?.page?.replace("{number}", String(item)) ??
                  `Page ${item}`
                }
                aria-current={item === current ? "page" : undefined}
                className={cn(
                  TARGET,
                  "u-num relative text-small",
                  item === current
                    ? /* The active mark: a 2px sapphire underline, never a fill. */
                      "text-ink in-data-[theme=navy]:text-mineral after:absolute after:inset-x-3 after:bottom-2 after:h-0.5 after:bg-sapphire after:content-[''] in-data-[theme=navy]:after:bg-champagne"
                    : "text-graphite hover:text-ink in-data-[theme=navy]:hover:text-mineral",
                  FOCUS_RING,
                )}
              >
                {item}
              </Link>
            )}
          </li>
        ))}
      </ol>

      <Link
        href={hrefFor(atEnd ? current : current + 1)}
        aria-label={labels?.next ?? "Next page"}
        aria-disabled={atEnd || undefined}
        tabIndex={atEnd ? -1 : undefined}
        className={cn(ARROW, atEnd && "pointer-events-none opacity-40")}
      >
        <ChevronRight
          aria-hidden
          strokeWidth={1.5}
          className="size-4 rtl:-scale-x-100"
        />
      </Link>

      {pageOfLabel && (
        <span className="u-micro ms-2 whitespace-nowrap">{pageOfLabel}</span>
      )}
    </nav>
  );
}
