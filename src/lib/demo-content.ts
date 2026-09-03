import "server-only";

import { demoClause, type DemoClause } from "@/lib/demo-clause";

/**
 * Should demo fixtures be shown to whoever is looking?
 *
 * Demo rows (`isDemo: true`) exist so that previews, CI and a fresh
 * environment can render every page with content — they are never real
 * catalogue, words or work, and the no-invented-content rule means the
 * production site must not show them unless the owner has said so.
 *
 * Off production (`VERCEL_ENV` is "preview", "development" or unset) the
 * fixtures are always shown.
 *
 * TODO(B0-commit-3): the owner's `SiteSettings.demoContentPublic` flag joins
 * here — `process.env.VERCEL_ENV !== "production" || settings.demoContentPublic
 * === true` — once the column exists. The migration that adds it and the
 * settings read land together; this module already carries the shape.
 */
export async function showDemoContent(): Promise<boolean> {
  return process.env.VERCEL_ENV !== "production";
}

/** The demo-content WHERE fragment for the current environment. */
export async function demoWhere(): Promise<DemoClause> {
  return demoClause(await showDemoContent());
}
