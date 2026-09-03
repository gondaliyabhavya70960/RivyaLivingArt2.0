import "server-only";

import { demoClause, type DemoClause } from "@/lib/demo-clause";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * Should demo fixtures be shown to whoever is looking?
 *
 * Demo rows (`isDemo: true`) exist so that previews, CI and a fresh
 * environment can render every page with content — they are never real
 * catalogue, words or work, and the no-invented-content rule means the
 * production site must not show them unless the owner has said so.
 *
 * Off production (`VERCEL_ENV` is "preview", "development" or unset) the
 * fixtures are always shown. In production they show only while the owner's
 * `SiteSettings.demoContentPublic` switch is on — a deliberate act on the
 * Content Lab screen, never a default. Even then every demo row is marked on
 * the page, kept out of the sitemap and the structured data, and never
 * reaches the Google Sheet or the image mirror (those readers hard-code
 * `isDemo: false` rather than calling this).
 *
 * Reads through the cached `getSiteSettings()`, so the cost is one cached
 * lookup per request and a settings publish invalidates it.
 */
export async function showDemoContent(): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production") return true;
  const settings = await getSiteSettings();
  return settings.demoContentPublic;
}

/** The demo-content WHERE fragment for the current environment. */
export async function demoWhere(): Promise<DemoClause> {
  return demoClause(await showDemoContent());
}
