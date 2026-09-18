import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { SystemPage } from "@/components/storefront/system-page";
import { routing } from "@/i18n/routing";
import { localePath, systemPageFooter } from "@/lib/system-page-copy";

/**
 * 410 · a piece that has left the studio — §2.10.
 *
 * ## The signal is real, and it was already in the schema
 *
 * `ContentStatus.ARCHIVED` is documented in `prisma/schema.prisma` as "Retired
 * but kept. Never public, never orderable." That is the definition of 410: the
 * resource existed, we still know about it, and it is not coming back. A DRAFT
 * is a 404 — it was never published and may yet be. The PDP told those two
 * apart for the first time in this commit; before it, every non-published
 * status went through one `notFound()`.
 *
 * ## Why the product URL answers 308 → 410 and not a bare 410
 *
 * This is the ceiling of what the App Router allows, and it is worth stating
 * plainly rather than leaving a reader to wonder whether it was an oversight.
 * A page cannot set its own status: the framework exposes `notFound()` (404),
 * `forbidden()` (403) and `unauthorized()` (401), and nothing else. Middleware
 * CAN set one — `NextResponse.rewrite(url, { status })` — but middleware runs
 * at the edge with no database, so it cannot know that a given slug is
 * archived.
 *
 * So the status is applied where it can be: `src/proxy.ts` rewrites this route
 * to itself with `status: 410`, and the PDP sends an archived slug here with a
 * PERMANENT redirect. A crawler following the product URL sees 308 → 410 and
 * drops the URL, which is the outcome a bare 410 would have bought. Verify
 * with `curl -I` on both.
 *
 * ## `?in=` is a category slug, never a product
 *
 * §2.10: "one link to a live collection, never a soft 404." The PDP passes the
 * archived piece's own category so the primary action is the collection it
 * belonged to rather than a generic `/shop`. It is validated as a slug-shaped
 * string before it reaches an href — this is a query parameter, so it is
 * whatever the visitor typed.
 *
 * NOTHING about the retired piece is rendered: not its name, not its price,
 * not its photograph. A system page shows no product (see `SystemPage`), and
 * a piece that is "never public" least of all.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** A category slug and nothing else. A query param is visitor input. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function GonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ in?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { in: category } = await searchParams;

  const [t, footer] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    systemPageFooter(locale),
  ]);

  const collectionHref =
    category && SLUG.test(category)
      ? localePath(locale, `/shop/${category}`)
      : localePath(locale, "/shop");

  return (
    <SystemPage
      eyebrow={t("gone.eyebrow")}
      statement={t("gone.statement")}
      support={t("gone.support")}
      primary={{ label: t("gone.primary"), href: collectionHref }}
      secondaries={[
        {
          label: t("gone.secondary"),
          href: localePath(locale, "/custom-order"),
        },
      ]}
      footer={footer}
    />
  );
}
