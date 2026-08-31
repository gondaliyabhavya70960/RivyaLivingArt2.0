import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import {
  FORM_OPTION_FALLBACK,
  FORM_OPTION_LISTS,
  isFormOptionList,
  resolveOptionLabel,
  type FormOptionSet,
} from "@/lib/form-options";

/**
 * The commission form's dropdown choices, resolved for one locale.
 *
 * Always total — every list resolves to something, and an empty table gives
 * back the bundled arrays the form used to hold inline. So the form renders
 * its shipped choices before anyone has opened the studio, and a database
 * hiccup degrades to those same choices rather than to four empty dropdowns
 * on the page that takes the orders.
 *
 * 24h TTL, like every other content read: route ISR is `min(segment, every
 * cached read)`, and `/custom-order` declares 300s. A short TTL here would not
 * hurt that page, but this resolver is one `import` away from being reused on
 * a route that declares 86400 — the rule is uniform for a reason
 * (`catalog-nav.ts:97` records what happened last time it was not).
 */

export const FORM_OPTIONS_TAG = "form-options";

const readOptionRows = unstable_cache(
  async () =>
    db.formOption.findMany({
      where: { enabled: true },
      orderBy: [{ list: "asc" }, { order: "asc" }],
      select: { list: true, value: true, label: true },
    }),
  ["form-options"],
  { revalidate: 86400, tags: [FORM_OPTIONS_TAG] },
);

export const getFormOptions = cache(
  async (locale: string): Promise<FormOptionSet> => {
    const rows = await readOptionRows().catch((error: unknown) => {
      console.error(
        "Commission form options unavailable — falling back to the bundled lists:",
        error,
      );
      return [];
    });

    if (rows.length === 0) return FORM_OPTION_FALLBACK;

    const resolved: FormOptionSet = {
      MATERIAL: [],
      OCCASION: [],
      BUDGET: [],
      TIMELINE: [],
    };

    for (const row of rows) {
      if (!isFormOptionList(row.list)) continue;
      resolved[row.list].push({
        value: row.value,
        label: resolveOptionLabel(row.label, locale, row.value),
      });
    }

    // A list the owner emptied would render a dropdown with nothing in it on
    // the page that takes commissions. Fall back per list, not just globally.
    for (const list of FORM_OPTION_LISTS) {
      if (resolved[list].length === 0)
        resolved[list] = FORM_OPTION_FALLBACK[list];
    }
    return resolved;
  },
);

/** Every row including disabled ones, for the studio screen. */
export async function readFormOptionsForStudio() {
  return db.formOption.findMany({
    orderBy: [{ list: "asc" }, { order: "asc" }],
  });
}
