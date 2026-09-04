import { db } from "@/lib/db";
import { CONFIRMED_SHEET_TAB, CONFIRMED_COLUMNS } from "@/lib/scraper/confirm";
import { readSheetSettings } from "@/lib/scraper/sheet-settings";
import { deleteRowsFromTab, isSheetSyncConfigured, upsertRowsToTab } from "@/lib/scraper/sheets";
import {
  WEBSITE_COLUMNS,
  WEBSITE_SHEET_TAB,
  websiteProductToRow,
} from "@/lib/scraper/website-sheet";

/**
 * Keeping the sheet's product tabs in step with the website.
 *
 * Two operations, both keyed on Product ID:
 *
 *   push   — every product on the site lands in "Added product in website"
 *   remove — a product deleted in the studio leaves that tab AND the
 *            confirmed list, because it no longer exists to be confirmed
 *
 * The tier tabs are deliberately untouched by the removal. Those are the raw
 * scrape decks — a record of what a supplier's site said, keyed by
 * `sourceKey|externalId`. Deleting a product from THIS website does not
 * un-happen the scrape, and erasing it there would break the immutable-raw
 * rule the whole pipeline rests on. The existing `DeletedImport` tombstone
 * already stops the next import resurrecting the product itself.
 */

/** Push the website mirror. Returns null when sync is not configured. */
export async function pushWebsiteProducts(): Promise<{
  updated: number;
  appended: number;
  total: number;
} | null> {
  // The owner's sheet from Settings, env fallback — the same document the
  // manual pushes write to (see `readSheetSettings`).
  const settings = await readSheetSettings();
  if (!isSheetSyncConfigured(settings)) return null;

  const products = await db.product.findMany({
    // Demo fixtures never reach the owner's sheet, whatever the site shows.
    where: { isDemo: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      priceMin: true,
      priceMax: true,
      showPrice: true,
      inStock: true,
      featured: true,
      confirmedAt: true,
      importSource: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      images: { orderBy: { order: "asc" }, select: { url: true } },
    },
  });

  const rows = products.map(websiteProductToRow);
  const { updated, appended } = await upsertRowsToTab({
    tab: WEBSITE_SHEET_TAB,
    header: WEBSITE_COLUMNS,
    rows,
    keyOf: (row) => row[0] ?? "",
    settings,
  });
  return { updated, appended, total: rows.length };
}

/**
 * Remove deleted products from the sheet's product tabs.
 *
 * Called with the ids AFTER they are gone from the database, so it cannot read
 * them back — the caller passes what it deleted. Never throws: a product the
 * owner deleted must stay deleted even if Google is unreachable, and a
 * subsequent push reconciles the tab anyway.
 */
export async function removeProductsFromSheet(
  ids: readonly string[],
): Promise<{ website: number; confirmed: number } | null> {
  if (ids.length === 0) return null;

  const byProductId = (row: string[]) => row[0] ?? "";
  try {
    const settings = await readSheetSettings();
    if (!isSheetSyncConfigured(settings)) return null;
    const website = await deleteRowsFromTab({
      tab: WEBSITE_SHEET_TAB,
      keys: ids,
      keyOf: byProductId,
      columns: WEBSITE_COLUMNS.length,
      settings,
    });
    const confirmed = await deleteRowsFromTab({
      tab: CONFIRMED_SHEET_TAB,
      keys: ids,
      keyOf: byProductId,
      columns: CONFIRMED_COLUMNS.length,
      settings,
    });
    return { website: website.deleted, confirmed: confirmed.deleted };
  } catch {
    // Swallowed on purpose. The deletion already happened; failing here would
    // report a successful delete as an error and tempt a retry that deletes
    // nothing. The next push reconciles.
    return null;
  }
}
