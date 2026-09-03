import Link from "next/link";

import type { CopyGroup } from "@/lib/site-copy";
import { cn } from "@/lib/utils";

/**
 * The strip of surfaces — Homepage, About, Process… — that picks which page
 * the screen is editing.
 *
 * Extracted from `SiteCopyBoard` when that screen became the per-page
 * composer. The surface applies to all three tabs (words, pictures, order),
 * so the switcher has to sit ABOVE the tabs rather than inside the words
 * board where it used to live; and the board still needs it when rendered on
 * its own. One component, two mount points, one set of styles.
 *
 * `hrefFor` is supplied by the caller because only the page knows which query
 * parameters must survive a surface change — the locale, and now the tab.
 * Switching from Homepage to About should not also switch you from Pictures
 * back to Words.
 */
export function SurfaceSwitcher({
  groups,
  group,
  hrefFor,
}: {
  groups: readonly CopyGroup[];
  group: CopyGroup;
  hrefFor: (group: CopyGroup) => string;
}) {
  return (
    <nav aria-label="Surface" className="flex flex-wrap gap-1.5">
      {groups.map((g) => (
        <Link
          key={g}
          href={hrefFor(g)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-small transition-colors",
            g === group
              ? "border-foreground bg-foreground text-background"
              : "border-border text-graphite hover:border-foreground hover:text-foreground",
          )}
          aria-current={g === group ? "page" : undefined}
        >
          {g}
        </Link>
      ))}
    </nav>
  );
}
