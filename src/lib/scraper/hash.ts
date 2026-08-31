import { createHash } from "node:crypto";
import type { RichProduct } from "@/lib/scraper/types";

/**
 * Change-tracking hash — deliberately ONLY over title + prices + status +
 * images (spec), so cosmetic description edits don't churn the sheet.
 */
export function contentHash(p: RichProduct): string {
  return createHash("sha1")
    .update(
      JSON.stringify([
        p.title,
        p.priceMin ?? null,
        p.priceMax ?? null,
        p.status ?? null,
        p.images,
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}
