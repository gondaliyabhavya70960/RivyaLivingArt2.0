import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import {
  NavMenusBoard,
  type NavMenuRows,
} from "@/components/studio/navigation/nav-menus-board";
import { Role } from "@/generated/prisma/enums";
import { defaultLocale, localeLabels, locales } from "@/i18n/config";
import {
  KNOWN_ROUTES,
  NAV_MENUS,
  NAV_MENU_DEFAULTS,
  NAV_MENU_LABELS,
  isNavMenuKey,
  resolveNavLabel,
} from "@/lib/nav-menus";
import { readNavForStudio } from "@/lib/nav-menus-server";

export const metadata: Metadata = { title: "Navigation" };

/**
 * Navigation — the header's links, the drawer's second group, the footer's
 * four columns.
 *
 * Their labels were already editable through Site Copy (they resolve from the
 * `Nav.*` catalogue). What was not was where they point, what order they come
 * in, and whether they exist at all: adding a "Workshops" link to the footer
 * meant a deploy.
 *
 * ADMIN-only. A wrong link is on every page of the site at once.
 *
 * Labels are shown resolved — the catalogue wording for a seeded link, the
 * stored override for one the owner added — so the screen reads as the visitor
 * sees it rather than as a table of keys.
 */
export default async function NavigationPage() {
  await requireStaffPage([Role.ADMIN]);

  const rows = await readNavForStudio();

  // One translator per locale, so the board can show every language's wording
  // without the client having to hold the catalogue.
  const translators = Object.fromEntries(
    await Promise.all(
      locales.map(async (locale) => [
        locale,
        await getTranslations({ locale, namespace: "Nav" }),
      ]),
    ),
  ) as Record<string, (key: string) => string>;

  const menus: NavMenuRows[] = NAV_MENUS.map((menuKey) => ({
    menuKey,
    title: NAV_MENU_LABELS[menuKey].title,
    where: NAV_MENU_LABELS[menuKey].where,
    items: rows
      .filter((row) => isNavMenuKey(row.menuKey) && row.menuKey === menuKey)
      .map((row) => ({
        id: row.id,
        key: row.key,
        href: row.href,
        visible: row.visible,
        bundled: NAV_MENU_DEFAULTS[menuKey].some((l) => l.key === row.key),
        labels: Object.fromEntries(
          locales.map((locale) => [
            locale,
            resolveNavLabel(row.label, locale) ??
              safeTranslate(translators[locale], row.key),
          ]),
        ),
        overridden: Object.fromEntries(
          locales.map((locale) => [
            locale,
            resolveNavLabel(row.label, locale) !== undefined,
          ]),
        ),
      })),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Navigation"
        description="Where the header and footer links go, what order they come in, and whether they show at all."
      />
      <NavMenusBoard
        menus={menus}
        locales={locales.map((code) => ({ code, label: localeLabels[code] }))}
        defaultLocale={defaultLocale}
        knownRoutes={[...KNOWN_ROUTES]}
        seeded={rows.length > 0}
      />
    </div>
  );
}

/**
 * A link the owner added has no `Nav.*` entry, and next-intl renders a missing
 * key as its own path. Fall back to the key itself, which at least reads as
 * something the owner typed.
 */
function safeTranslate(t: (key: string) => string, key: string): string {
  try {
    const value = t(key);
    return value.startsWith("Nav.") ? key : value;
  } catch {
    return key;
  }
}
