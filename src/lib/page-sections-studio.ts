import "server-only";

import type { SectionRow } from "@/components/studio/sections/sections-board";
import {
  PAGE_SECTION_LABELS,
  SECTION_PAGES,
  type SectionPageKey,
} from "@/lib/page-sections";
import { readSectionsForStudio } from "@/lib/page-sections-server";

/**
 * The rows the Page Sections board renders — built once for every screen that
 * shows them. Lifted out of `/studio/sections/page.tsx` so the per-page
 * composer on `/studio/site-copy` renders the same rows for its surface
 * without a second copy of the mapping drifting from the first.
 */
export async function buildSectionRows(
  pageKey: SectionPageKey,
): Promise<SectionRow[]> {
  const sections = await readSectionsForStudio(pageKey);
  return sections.map((section) => ({
    key: section.key,
    label: section.label,
    description: section.description,
    dark: Boolean(section.dark),
    hideable: section.hideable,
    movable: section.movable,
    conditional: Boolean(section.conditional),
    ownsH1: Boolean(section.ownsH1),
    defaultVisible: section.defaultVisible ?? true,
    visible: section.visible,
    unpublished: section.unpublished,
    notes: section.notes ?? "",
    copyCount: section.copyPrefixes.length,
    imageCount: section.imageKeys.length,
  }));
}

/**
 * Which sections page, if any, a storefront path belongs to.
 *
 * The copy and image registries name surfaces ("Homepage", "Large format");
 * the section manifest keys pages ("home", "large-format"). Neither vocabulary
 * knows the other, and a hand-written map between them is exactly the table
 * that stops being true the first time either side gains an entry. Both DO
 * carry the page's public path, so the join is derived from that: a surface
 * whose preview path matches a section page's path is that page.
 *
 * Returns `null` for the surfaces the manifest deliberately does not cover —
 * Shop, Journal, Portfolio, FAQ and Legal are a hero plus a listing, and
 * hiding the listing makes the page pointless (see `page-sections.ts`).
 */
export function pageKeyForPath(path: string): SectionPageKey | null {
  for (const key of SECTION_PAGES) {
    if (PAGE_SECTION_LABELS[key].path === path) return key;
  }
  return null;
}
