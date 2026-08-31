"use server";

import { z } from "zod";

import { defaultLocale } from "@/i18n/config";
import {
  EMPTY_RESULTS,
  MAX_QUERY,
  MIN_QUERY,
  searchCategories,
  searchPortfolios,
  searchPosts,
  searchProducts,
  toCollectionHit,
  toJournalHit,
  toPortfolioHit,
  toProductHit,
  type SearchResults,
} from "@/lib/search-query";

// Public (unauthenticated) read action behind the search overlay (§5.6).
// Read-only against the PUBLISHED/non-DEMO catalogue, so no rate limit —
// but the input is zod-validated and the row counts are capped server-side,
// exactly like the shop's load-more action.

const searchSchema = z.object({
  query: z.string().trim().max(MAX_QUERY),
  locale: z.string().max(10).optional(),
});

export type SearchStudioInput = z.input<typeof searchSchema>;

/**
 * Error CODES, not copy — the overlay serves nine locales and maps the code
 * onto its own message key (the convention src/actions/public.ts set).
 */
export type SearchStudioResult =
  | { ok: true; results: SearchResults }
  | { ok: false; error: "generic" };

/**
 * Hard caps. The overlay is a preview, not the results page: five pieces and
 * three of everything else fill one screen without scrolling past the "See
 * all results" line, and a visitor who wants the full set is one Enter away
 * from /search?q=. Clients cannot ask for more.
 */
const TAKE = {
  products: 5,
  collections: 3,
  portfolio: 3,
  journal: 3,
} as const;

/**
 * Instant results for the search overlay (REDESIGN.md §5.6) — the same
 * queries the /search page runs, capped to a preview and mapped to a
 * serialisable shape. Fires per debounced keystroke from the second
 * character, so it deliberately skips every `count(*)`: the "See all
 * results" link carries no figure precisely so this stays four indexed
 * reads (M-P2/M-P3).
 */
export async function searchStudio(
  input: SearchStudioInput,
): Promise<SearchStudioResult> {
  try {
    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "generic" };

    const { query, locale = defaultLocale } = parsed.data;
    // Below the threshold the overlay shows Recent + suggestions instead —
    // answer without touching the database.
    if (query.length < MIN_QUERY) {
      return { ok: true, results: { ...EMPTY_RESULTS, query } };
    }

    const [products, collections, portfolio, journal] = await Promise.all([
      searchProducts(query, TAKE.products, { withTotal: false }),
      searchCategories(query, TAKE.collections),
      searchPortfolios(query, TAKE.portfolio, { withTotal: false }),
      searchPosts(query, TAKE.journal, { withTotal: false }),
    ]);

    const results: SearchResults = {
      query,
      products: products.rows.map((row) => toProductHit(row, locale)),
      collections: collections.rows.map((row) => toCollectionHit(row, locale)),
      portfolio: portfolio.rows.map((row) => toPortfolioHit(row, locale)),
      journal: journal.rows.map((row) => toJournalHit(row, locale)),
      count: 0,
    };
    results.count =
      results.products.length +
      results.collections.length +
      results.portfolio.length +
      results.journal.length;

    return { ok: true, results };
  } catch (error) {
    // A DB hiccup must reach the overlay as an error state with a retry, not
    // as "Nothing found" — a wrong "we don't make that" is the one answer
    // this brand cannot afford (Part 16).
    console.error("searchStudio failed:", error);
    return { ok: false, error: "generic" };
  }
}
