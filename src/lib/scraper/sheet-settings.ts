import "server-only";

import { db } from "@/lib/db";
import type { SheetIdSettings } from "@/lib/scraper/sheets";

/** `SiteSettings.sheetId` + `sheetTabIds` in the shape every sheet writer takes. */
export type SheetSettings = SheetIdSettings & { sheetTabIds?: unknown };

/**
 * The owner's chosen sheet (`/studio/settings` → Sheets), read ONCE per
 * operation so every push inside it resolves the same document.
 *
 * Every sheet writer must be handed this — the manual pushes, the retry
 * drain, the confirmed and tier pushes (`actions/scraper-sheets.ts`), the
 * ON_COMPLETE auto-push after a scrape (`actions/scraper-jobs.ts`) and the
 * website mirror (`product-sheet-sync.ts`). Until the 2026-09-04 plan audit
 * the last two called the helpers with no settings, so on those paths the
 * owner's Settings value was ignored and only the deploy environment's
 * SCRAPE_SHEET_ID applied — a push landing in a sheet nobody was looking at.
 * `readSheetId` still falls back to the environment when the row is unset.
 */
export async function readSheetSettings(): Promise<SheetSettings | undefined> {
  const settings = await db.siteSettings.findUnique({
    where: { id: "main" },
    select: { sheetId: true, sheetTabIds: true },
  });
  return settings ?? undefined;
}
