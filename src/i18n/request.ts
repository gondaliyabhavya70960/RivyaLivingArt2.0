import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";
import { applyCopyOverrides, type MessageTree } from "@/lib/site-copy";
import { getSiteCopy } from "@/lib/site-copy-server";
import enMessages from "../../messages/en.json";

/**
 * Per-request i18n config consumed by next-intl's server APIs. Resolves the
 * active locale (falling back to the default for anything unrecognised) and
 * loads that locale's message catalog from /messages.
 */

/**
 * Walk a dotted message path against the English catalogue.
 *
 * English is imported statically rather than dynamically because this only
 * runs on the failure path and must not add an await to it — and because it is
 * the one catalogue guaranteed to be complete (`scripts/i18n-missing.mjs` is
 * the gate that keeps the other eight in step with it).
 */
function lookupEnglish(path: string): string | undefined {
  let node: string | MessageTree | undefined = enMessages as MessageTree;
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[segment];
  }
  return typeof node === "string" ? node : undefined;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../../messages/${locale}.json`))
    .default as MessageTree;

  // Owner overrides from /studio/site-copy, layered on top. The catalogue is
  // the source of defaults and stays in git; the database only ever holds
  // replacements, so an empty table renders the site exactly as the repo does
  // and a DB outage degrades to the shipped copy rather than to a blank page.
  //
  // `applyCopyOverrides` is copy-on-write: `await import()` hands back a
  // CACHED module namespace shared by every request in the process, so
  // mutating it would leak one visitor's overrides into everyone else's page.
  // With no overrides it returns the base catalogue by reference and costs
  // nothing.
  // Staff preview is resolved inside getSiteCopy, so every caller gets it
  // without having to remember to ask.
  const overrides = await getSiteCopy(locale);

  return {
    locale,
    messages: applyCopyOverrides(base, overrides),

    /**
     * next-intl's default for an unresolvable message is to render the KEY
     * PATH — so a single missing or malformed entry prints
     * `Home.hero.headline` across the homepage of a luxury brand rather than
     * failing loudly anywhere a human would see it first.
     *
     * Fall back to the English string instead. A visitor reading English copy
     * where their language was expected is a bad day; a visitor reading a
     * dotted identifier is a broken site. Only when English is missing too
     * does this return the path, because at that point the key genuinely does
     * not exist and hiding it would make the bug harder to find, not rarer.
     *
     * This becomes load-bearing when storefront copy is owner-editable: it is
     * the second net under save-time validation, not a replacement for it.
     */
    getMessageFallback({ namespace, key, error }) {
      const path = namespace ? `${namespace}.${key}` : key;
      console.error(`[i18n] ${locale}: ${path} — ${error.code}`);
      return lookupEnglish(path) ?? path;
    },

    /**
     * Never swallow. A missing key in eight locales is invisible in
     * production precisely because the fallback above makes the page look
     * fine — the log line is the only trace.
     */
    onError(error) {
      console.error("[i18n]", error);
    },
  };
});
