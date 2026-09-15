import { unstable_cache } from "next/cache";

import { AliasKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import {
  normalizeColour,
  normalizeMaterial,
  normalizeUnit,
} from "@/lib/scraper/normalize";

/**
 * Normalization resolved at READ time, from a table the owner can edit
 * (workstream B, phase 6c).
 *
 * The plan states the goal as **"a mapping fix needs no re-scrape"**, and it
 * only works because `ProductSnapshot.rawPayload` keeps the source's own
 * words. Correct "sheesham" → "Sheesham Wood" here and every snapshot ever
 * captured re-labels the next time anything reads it — instead of 35,000
 * pages being fetched again to bake a new spelling into storage.
 *
 * THE SHAPE IS THE STUDIO CMS'S, deliberately, because it is the one this
 * repo already trusts:
 *
 *     built-in maps in code  →  overrides in the database  →  a TOTAL resolver
 *
 * `normalize.ts` remains the fallback, so an EMPTY table behaves exactly as
 * the code did before this existed — no regression, nothing to seed before it
 * is useful. A row WINS over the built-in map, because that row is the owner
 * overruling the code.
 *
 * Write-time normalization in `job-runner.ts` is untouched: the staged row and
 * the review grid keep the vocabulary they have always had. This is the layer
 * that reads history, and history is what a re-scrape cannot fix.
 */

/** How long a resolved alias map is cached. Invalidated by tag on any write. */
const CACHE_TAG = "normalization-aliases";
const CACHE_SECONDS = 60 * 60;

export type AliasMap = Record<string, string>;

/** Lookup key: trimmed and lowercased, which is also how rows are stored. */
export function aliasKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Every alias for one kind, as a plain object so it can be cached.
 *
 * Cached for an hour behind `CACHE_TAG` rather than read per value: a page of
 * 100 products would otherwise issue hundreds of point lookups for a table
 * that changes when an owner edits it, which is approximately never.
 */
export const getAliasMap = unstable_cache(
  async (kind: AliasKind): Promise<AliasMap> => {
    const rows = await db.normalizationAlias.findMany({
      where: { kind },
      select: { rawValue: true, canonicalValue: true },
    });
    const map: AliasMap = {};
    for (const row of rows) map[row.rawValue] = row.canonicalValue;
    return map;
  },
  ["normalization-alias-map"],
  { revalidate: CACHE_SECONDS, tags: [CACHE_TAG] },
);

/** The tag studio actions revalidate after editing an alias. */
export const NORMALIZATION_ALIAS_TAG = CACHE_TAG;

/** The built-in map for a kind — what the code did before this table. */
function builtIn(kind: AliasKind, raw: string): string | null {
  switch (kind) {
    case AliasKind.MATERIAL:
      return normalizeMaterial(raw);
    case AliasKind.COLOUR:
      return normalizeColour(raw);
    case AliasKind.UNIT:
      return normalizeUnit(raw);
    // RESIN_STYLE, PRODUCT_TYPE and AVAILABILITY have no built-in map yet:
    // they arrive with B6's taxonomy. Until then an alias row is the ONLY
    // source for them, which is exactly why the resolver is total.
    default:
      return null;
  }
}

/**
 * Resolve one raw value against the owner's aliases, then the built-in map,
 * then itself.
 *
 * TOTAL by construction: it always returns a string. An unknown value comes
 * back unchanged rather than null, because a value we have no opinion about
 * is still the value — dropping it would lose the only thing the source told
 * us.
 */
export function resolveWithMap(
  aliases: AliasMap,
  kind: AliasKind,
  raw: string,
): string {
  const key = aliasKey(raw);
  if (!key) return raw;
  const override = aliases[key];
  if (override) return override;
  return builtIn(kind, raw) ?? raw;
}

/** `resolveWithMap` with the map fetched for you. Prefer the map form in a loop. */
export async function resolveAlias(
  kind: AliasKind,
  raw: string,
): Promise<string> {
  return resolveWithMap(await getAliasMap(kind), kind, raw);
}
