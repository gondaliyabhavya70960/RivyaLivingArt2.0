"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SECTIONS } from "@/components/studio/sidebar";

/** Static labels for segments that aren't sidebar destinations. */
const EXTRA_LABELS: Record<string, string> = {
  review: "Review queue",
  sources: "Source registry",
  mapping: "Category mapping",
  card: "Commission card",
  new: "New",
};

const HREF_LABELS = new Map(
  SECTIONS.flatMap((section) =>
    section.items.map((item) => [item.href, item.label] as const),
  ),
);

const CRUMB =
  "inline-flex min-h-8 items-center rounded-input text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

/**
 * Breadcrumb trail — the left half of the Studio top bar (§12.2).
 *
 * Path-derived: known segments resolve through the sidebar's own label map
 * (one source of truth), detail ids render as "Detail". On `/studio` the trail
 * is the single current crumb rather than nothing — the bar's left slot must
 * never be empty, and "Overview" there is a statement of place, not a link to
 * the page you are already on.
 *
 * The separator is a mono slash, not a chevron: every other piece of Studio
 * metadata is mono, and a 1-character glyph reads quieter at 13px than an icon.
 */
export function StudioBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);

  const crumbs = segments.map((segment, index) => {
    const href = `/studio/${segments.slice(0, index + 1).join("/")}`;
    const label =
      HREF_LABELS.get(href) ??
      EXTRA_LABELS[segment] ??
      // cuid-ish detail segments read as "Detail", not raw ids.
      (segment.length > 12 ? "Detail" : segment);
    return { href, label, last: index === segments.length - 1 };
  });

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2">
        <li>
          {crumbs.length === 0 ? (
            <span
              aria-current="page"
              className="inline-flex min-h-8 items-center text-small font-medium text-foreground"
            >
              Overview
            </span>
          ) : (
            <Link href="/studio" className={CRUMB}>
              Overview
            </Link>
          )}
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-x-2">
            <span aria-hidden className="u-micro text-graphite/50">
              /
            </span>
            {crumb.last ? (
              <span
                aria-current="page"
                className="inline-flex min-h-8 items-center text-small font-medium capitalize text-foreground"
              >
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className={`${CRUMB} capitalize`}>
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
