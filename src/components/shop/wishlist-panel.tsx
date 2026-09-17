"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";

import { fetchWishlistItems } from "@/actions/shop";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { Button } from "@/components/storefront/button";
import { useWaNumber } from "@/components/providers/wa-number-provider";
import { SITE } from "@/lib/constants";
import type { ShopProductItem } from "@/lib/shop";
import { useWishlist } from "@/lib/wishlist";
import { buildWaLink } from "@/lib/whatsapp";

/** How many saved pieces the WhatsApp message lists before "+N more". */
const WA_LIST_CAP = 12;

/**
 * Client body of /shop/wishlist. Reads the saved slugs from the
 * localStorage store, fetches their card data through the zod-validated
 * server action (PUBLISHED only), and renders the catalogue grid plus the
 * page's one WhatsApp action — the share CTA (Part 0: green means the
 * final WhatsApp step, B2's one semantic exception). Unhearting a card
 * drops it from the grid instantly (the store is the source of truth);
 * pieces that have left the catalogue are simply absent from the fetch.
 */
export function WishlistPanel() {
  const t = useTranslations("Wishlist");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const waNumber = useWaNumber();

  const slugs = useWishlist();
  // null = not yet fetched (loading); [] = fetched, nothing published.
  const [fetched, setFetched] = useState<ShopProductItem[] | null>(null);

  // Join-key so the effect deps stay primitive; re-fetches when the saved
  // set changes (cheap read-only action, ≤48 rows).
  const slugsKey = slugs.join("|");

  useEffect(() => {
    const list = slugsKey ? slugsKey.split("|") : [];
    // Nothing saved — nothing to fetch; the derived view below renders the
    // empty state straight from the store (no setState in the effect body).
    if (list.length === 0) return;
    let cancelled = false;
    fetchWishlistItems({ slugs: list, locale })
      .then((items) => {
        if (!cancelled) setFetched(items);
      })
      .catch(() => {
        if (!cancelled) setFetched([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slugsKey, locale]);

  /* ————————— derived view ————————— */

  // Order by the store (newest saves first) and drop unhearted slugs
  // without waiting for a refetch round-trip.
  const bySlug = new Map((fetched ?? []).map((item) => [item.slug, item]));
  const items = slugs.flatMap((slug) => bySlug.get(slug) ?? []);

  const loading = slugs.length > 0 && fetched === null;
  const host = SITE.url.replace(/^https?:\/\//, "");

  const waLines = [
    t("waIntro"),
    "",
    ...items
      .slice(0, WA_LIST_CAP)
      .map((item) => `• ${item.title}\n${SITE.url}/product/${item.slug}`),
  ];
  if (items.length > WA_LIST_CAP) {
    waLines.push(t("waMore", { count: items.length - WA_LIST_CAP }));
  }
  waLines.push("", t("waSentFrom", { host }));
  const waHref = buildWaLink(waLines.join("\n"), waNumber);

  /* ————————— render ————————— */

  return (
    <div>
      {/* Always in the DOM so save/remove count changes announce (UIUX-P18). */}
      <p
        role="status"
        aria-live="polite"
        className="font-body text-14 text-graphite"
      >
        {loading ? t("loading") : t("count", { count: items.length })}
      </p>

      {items.length > 0 ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
            {items.map((item) => (
              <CatalogProductCard key={item.id} item={item} />
            ))}
          </div>

          {/* SHARE STRIP — the page's one WhatsApp action over a mist
              hairline (A2: gold rules live on navy only): hand the shortlist
              to the studio in one message. */}
          <div className="mt-14 flex flex-col gap-8 border-t border-hairline pt-10 md:flex-row md:items-end md:justify-between md:gap-16">
            <div className="max-w-2xl">
              <span aria-hidden className="block h-px w-16 bg-hairline" />
              <p className="mt-6 font-display text-25 leading-snug tracking-display text-ink md:text-31">
                {t("shareLead")}
              </p>
            </div>
            <Button variant="primary" size="lg" className="shrink-0" asChild>
              <a
                href={waHref}
                /* Without this the delegated tracker falls back to
                   "link" and the shortlist hand-off is invisible in
                   the funnel (whatsapp-tracker.tsx:50-53). */
                data-wa-source="wishlist"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4"
                />
                {t("shareCta")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
          </div>
        </>
      ) : loading ? null : (
        <div className="mt-10 rounded-card bg-sand p-10 text-center md:p-16">
          <p className="font-mono text-12 uppercase tracking-[0.18em] text-champagne-ink">
            {t("emptyEyebrow")}
          </p>
          <h2 className="mt-4 font-display text-25 tracking-display text-ink md:text-31">
            {slugs.length > 0 ? t("unavailableHeading") : t("emptyHeading")}
          </h2>
          <p className="mx-auto mt-3 max-w-md font-body text-16 leading-relaxed text-graphite">
            {slugs.length > 0 ? t("unavailableBody") : t("emptyBody")}
          </p>
          <div className="mt-8 flex justify-center">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/shop">
                {t("browseCta")}
                <ArrowRight aria-hidden strokeWidth={1.5} className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
