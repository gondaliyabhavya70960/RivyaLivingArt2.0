"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSurfaceTab, type SurfaceTab } from "@/lib/surface-tabs";


/**
 * Words · Pictures · Order — the three things a page is made of, on one
 * screen.
 *
 * Until now they were three screens: Site Copy, Site Images and Page Sections,
 * each scoped to a surface by its own switcher. Editing one page's hero meant
 * changing the headline in one place, the photograph in a second and its
 * position in a third, with a surface picker on each that could be set to a
 * different page than the other two. This puts them side by side under ONE
 * surface picker, composing the three existing boards unchanged — the
 * roadmap's "UI composition, no data change".
 *
 * The active tab lives in the URL (`?tab=`), for the same reason the surface
 * and locale already do: a particular screen can be linked, reloaded, and
 * shared with a note saying "this one". `router.replace` rather than `push`,
 * so tabbing around does not fill the Back button with panel changes; and
 * `scroll: false`, so switching tabs does not jump to the top.
 *
 * Every panel is `forceMount`ed. The copy board keeps a row's half-typed edit
 * in local state while the row is open; Radix's default of unmounting an
 * inactive panel would discard it on a tab change. Mounted-but-hidden keeps
 * the DOM and the accessibility tree honest (see `TabsContent`).
 *
 * `order` can be absent: five surfaces have no section manifest by design.
 * The tab is then not rendered at all rather than shown disabled, and a URL
 * carrying `?tab=order` for such a surface lands on Words.
 */
export function SurfaceTabs({
  tab,
  words,
  pictures,
  order,
  counts,
}: {
  /** The tab the server resolved from the URL, already validated. */
  tab: SurfaceTab;
  words: ReactNode;
  pictures: ReactNode;
  /** Null when this surface has no section manifest. */
  order: ReactNode | null;
  /** Unpublished change counts, shown beside each label. */
  counts: { words: number; pictures: number; order: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const select = (next: string) => {
    if (!isSurfaceTab(next) || next === tab) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "words") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <Tabs value={tab} onValueChange={select}>
      <TabsList aria-label="What to edit on this page">
        <TabsTrigger value="words">
          Words
          <PendingBadge count={counts.words} />
        </TabsTrigger>
        <TabsTrigger value="pictures">
          Pictures
          <PendingBadge count={counts.pictures} />
        </TabsTrigger>
        {order !== null && (
          <TabsTrigger value="order">
            Order
            <PendingBadge count={counts.order} />
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent forceMount value="words">
        {words}
      </TabsContent>
      <TabsContent forceMount value="pictures">
        {pictures}
      </TabsContent>
      {order !== null && (
        <TabsContent forceMount value="order">
          {order}
        </TabsContent>
      )}
    </Tabs>
  );
}

/**
 * How many changes on that tab are staged and not yet live. A number, not a
 * dot: "3" tells the owner whether they are about to publish one thing or a
 * rewrite, and it is the same figure the publish bar will show them.
 */
function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="u-num ms-1.5 rounded-full border border-warning/40 bg-warning/8 px-1.5 text-12 text-warning">
      {count}
      <span className="sr-only"> unpublished</span>
    </span>
  );
}
