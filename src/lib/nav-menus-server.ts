import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  NAV_MENUS,
  NAV_MENU_DEFAULTS,
  isNavMenuKey,
  resolveNavLabel,
  type NavMenuKey,
  type NavMenuSet,
} from "@/lib/nav-menus";

/**
 * The site's navigation, resolved for one locale.
 *
 * Always total — every menu resolves to something, and an empty table gives
 * back the bundled arrays. So the chrome renders before anyone has opened the
 * studio, and a database hiccup degrades to the shipped menus rather than to a
 * site with no way to get anywhere.
 *
 * 24h TTL. This renders in the layout on EVERY route, so it is the read most
 * able to cap route ISR: a short TTL here would drop `/product/[slug]` from
 * its declared 86400 across the whole catalogue (`catalog-nav.ts:97` records
 * what happened last time). Freshness comes from the tag.
 */

export const NAV_MENUS_TAG = "nav-menus";

const readNavRows = unstable_cache(
  async () =>
    db.navItem.findMany({
      where: { visible: true },
      orderBy: [{ menuKey: "asc" }, { order: "asc" }],
      select: {
        menuKey: true,
        key: true,
        label: true,
        href: true,
        newTab: true,
      },
    }),
  ["nav-menus"],
  { revalidate: 86400, tags: [NAV_MENUS_TAG] },
);

/**
 * @param translate resolves a `Nav.*` key to the visitor's language. Labels
 *   stay in the message catalogue by default — the copy layer already owns
 *   them in nine languages — so this only falls back to a stored override for
 *   links the owner added, which have no catalogue key of their own.
 */
export const getNavMenus = cache(
  async (
    locale: string,
    translate: (key: string) => string,
  ): Promise<NavMenuSet> => {
    const rows = await readNavRows().catch((error: unknown) => {
      console.error(
        "Navigation unavailable — falling back to the bundled menus:",
        error,
      );
      return [];
    });

    const resolved: NavMenuSet = {
      header: [],
      "header-secondary": [],
      "footer-explore": [],
      "footer-studio": [],
      "footer-journal": [],
      "footer-legal": [],
    };

    for (const row of rows) {
      if (!isNavMenuKey(row.menuKey)) continue;
      resolved[row.menuKey].push({
        key: row.key,
        label: resolveNavLabel(row.label, locale) ?? translate(row.key),
        href: row.href,
        newTab: row.newTab,
      });
    }

    // Per menu, not just globally: a header the owner emptied would leave the
    // site with no navigation at all, which is never what they meant.
    for (const menu of NAV_MENUS) {
      if (resolved[menu].length === 0) {
        resolved[menu] = NAV_MENU_DEFAULTS[menu].map((link) => ({
          key: link.key,
          label: translate(link.key),
          href: link.href,
          newTab: false,
        }));
      }
    }
    return resolved;
  },
);

/** Every row including hidden ones, for the studio screen. */
export async function readNavForStudio() {
  return db.navItem.findMany({
    orderBy: [{ menuKey: "asc" }, { order: "asc" }],
  });
}

/** Menus that have at least one row — tells the studio whether the seed ran. */
export async function navIsSeeded(): Promise<boolean> {
  return (await db.navItem.count()) > 0;
}

export type { NavMenuKey };
