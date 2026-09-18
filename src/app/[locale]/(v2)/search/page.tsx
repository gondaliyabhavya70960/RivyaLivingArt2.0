import { demoWhere } from "@/lib/demo-content";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Search as SearchIcon } from "lucide-react";

import { getPathname, Link } from "@/i18n/navigation";
import { localeCanonical } from "@/i18n/seo";
import { Reveal } from "@/components/motion/reveal";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { EmptyState } from "@/components/storefront/empty-state";
import { Eyebrow } from "@/components/storefront/section-heading";
import { Button } from "@/components/storefront/button";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { CollectionCard } from "@/components/storefront/collection-card";
import { db } from "@/lib/db";
import { SITE } from "@/lib/constants";
import { localize, localizeName } from "@/lib/localize";
import { editorialName } from "@/lib/product-name";
import { ALL_ECOSYSTEMS } from "@/lib/shop-filters";

/** Shelves are a short answer, never a second catalogue — six is a rail. */
const COLLECTION_LIMIT = 6;
import {
  MAX_QUERY,
  MIN_QUERY,
  searchPortfolios,
  searchPosts,
  searchProducts,
} from "@/lib/search-query";
import type { ShopProductItem } from "@/lib/shop";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

/** Search is entirely query-driven — always render fresh (revalidate 0). */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Search.meta" });
  return {
    title: t("title"),
    description: t("description"),
    // Query-only page: keep every ?q= variant out of the index but let crawlers
    // follow through to the real product/blog/portfolio pages (SEO-001).
    // Canonical-only — hreflang on a noindex route is ignored and just adds
    // Search Console noise (SEO-511).
    robots: { index: false, follow: true },
    alternates: localeCanonical("/search", locale),
  };
}


type SearchPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

/* ————————————————— index-section head ————————————————— */

function IndexHead({
  eyebrow,
  heading,
  count,
  countLabel,
}: {
  eyebrow: string;
  heading: string;
  count: number;
  /** Translated "# results" phrase — the SR-visible twin of the bare figure. */
  countLabel: string;
}) {
  return (
    <div className="flex items-end justify-between gap-6 border-b border-hairline pb-4">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-3 font-display text-h3 tracking-display text-ink">
          {heading}
          {/* The visible bare number stays aria-hidden decoration; a screen
              reader gets the count inside the heading instead. */}
          <span className="sr-only"> — {countLabel}</span>
        </h2>
      </div>
      <span aria-hidden className="u-num pb-1 text-14 text-graphite">
        {count}
      </span>
    </div>
  );
}

/* ————————————————— row for journal / portfolio results ————————————————— */

function ResultRow({
  href,
  title,
  snippet,
}: {
  href: string;
  title: string;
  snippet: string;
}) {
  return (
    /* A hairline-divided row, not a card. §3.5: separation is whitespace and
       a rule, never a box — a list of quiet tiles is the ecommerce grammar
       this redesign is getting away from. */
    <li className="border-b border-hairline">
      <Link
        href={href}
        className="group flex items-center justify-between gap-6 py-6 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
      >
        <div className="min-w-0">
          <h3 className="font-body text-16 leading-snug font-medium text-ink transition-colors duration-(--dur-fast) ease-(--ease-luxury) group-hover:text-sapphire-ink motion-reduce:transition-none">
            {title}
          </h3>
          {snippet && (
            /* `aria-hidden` for the same reason `TitleText` hides the clamped
               product name (Part 17): the snippet sits INSIDE the link, so it
               joins the link's accessible name — and it is a `line-clamp-2`
               preview, so the name a screen reader announced was the whole
               untruncated excerpt, ellipsis and all. The row's name is its
               title; the preview is one click from the thing it previews. */
            <p
              aria-hidden
              className="mt-1.5 line-clamp-2 font-body text-14 leading-relaxed text-graphite"
            >
              {snippet}
            </p>
          )}
        </div>
        <ArrowRight
          aria-hidden
          strokeWidth={1.5}
          className="size-4 shrink-0 text-sapphire-ink rtl:-scale-x-100"
        />
      </Link>
    </li>
  );
}

/* ————————————————— page —————————————————
 *
 * Site search on Midnight Gild (utility register, DESIGN.md B2): canvas
 * masthead — breadcrumb, bronze mono eyebrow, Fraunces head, the GET query
 * form — then the results index on the same canvas run with journal/portfolio
 * hits as quiet white cards; the zero/too-short states are white panels with
 * a WhatsApp assist. One hero motion moment (the split heading); results
 * paint instantly. Band rhythm per A2 rule 6: one canvas band into the navy
 * footer — the white surfaces here are panels, not bands.
 */
export default async function SearchPage({
  params: localeParams,
  searchParams,
}: SearchPageProps) {
  const { locale } = await localeParams;
  setRequestLocale(locale);

  const t = await getTranslations("Search");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");
  const tWa = await getTranslations("WhatsApp");

  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  // Cap the query length before it reaches the ILIKE scans, matching the shop
  // action's own 120-char bound — an unbounded q hammers Neon (ENG-807).
  const query = (raw?.trim() ?? "").slice(0, MAX_QUERY);
  const searched = query.length >= MIN_QUERY;

  // The same demo gate the search overlay's action applies: fixtures show
  // here only when SiteSettings.demoContentPublic or a non-production
  // VERCEL_ENV says so (B0). Left at the NO_DEMO default, this page hid rows
  // the overlay offered — caught by the E2E smoke's /search check (F2).
  const demo = searched ? await demoWhere() : undefined;
  const [products, posts, portfolios, collectionRows] = searched
    ? await Promise.all([
        searchProducts(query, undefined, { demo }),
        searchPosts(query, undefined, { demo }),
        searchPortfolios(query, undefined, { demo }),
        // COLLECTIONS — plan §2.9's third group, and the one a visitor
        // searching "varmala" or "coasters" is usually after: a shelf, not a
        // single piece. Matched on the category's own name and slug rather
        // than through the product index, and filtered to shelves that hold
        // something — a search result that opens an empty shelf is the same
        // broken promise as a tab that does (§3.3).
        //
        // No `demo` clause: a Category is not demo content. Its COUNT carries
        // one, so a category that exists only for the Content Lab's fixtures
        // is invisible here with the demo switch off.
        db.category.findMany({
          where: {
            visible: true,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { slug: { contains: query, mode: "insensitive" } },
            ],
            products: { some: { status: "PUBLISHED", ...demo } },
          },
          orderBy: { order: "asc" },
          take: COLLECTION_LIMIT,
          select: {
            id: true,
            slug: true,
            name: true,
            image: true,
            translations: true,
          },
        }),
      ])
    : [
        { rows: [], total: 0 },
        { rows: [], total: 0 },
        { rows: [], total: 0 },
        [],
      ];

  // Bridge the search rows to the v2.0 catalog card's ShopProductItem shape.
  // The select stays the search page's own (no customFields fetch — the query
  // helpers are unchanged), so variant chips stay empty and the card simply
  // skips that line. `materials`, `dimensions` and `timeline` are null here
  // for the same reason: search ranks and lists, and widening its select to
  // fill three optional card lines would cost every query for a line each
  // variant already knows how to omit.
  const productItems: ShopProductItem[] = products.rows.map((p) => {
    const lp = localize(p, locale, ["title", "displayName", "shortTagline"]);
    return {
      id: p.id,
      slug: p.slug,
      title: lp.title,
      displayTitle: editorialName(lp.displayName, lp.title),
      shortTagline: lp.shortTagline,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      showPrice: p.showPrice,
      tier: p.tier,
      inStock: p.inStock,
      featured: p.featured,
      categoryName: localize(p.category, locale, ["name"]).name,
      image: p.images[0]
        ? {
            url: p.images[0].url,
            alt: p.images[0].alt || lp.title,
            role: p.images[0].role ?? null,
          }
        : null,
      hoverImage: p.images[1]
        ? {
            url: p.images[1].url,
            alt: p.images[1].alt || lp.title,
            role: p.images[1].role ?? null,
          }
        : null,
      variantChips: [],
      // D21 added these to ShopProductItem for the catalog card's mono meta
      // line, hover video and demo mark. `search-query.ts`'s own select is
      // B0-owned and unchanged by this batch, so the search results simply
      // carry the same "nothing to show" defaults they always rendered —
      // no card here loses anything it had before this type grew. The same
      // goes for `sizeTier` (E step 7): search renders the full card until
      // step 8's facet gives the search select a reason to fetch it.
      materials: null,
      dimensions: null,
      timeline: null,
      videoUrl: null,
      sizeTier: null,
      isDemo: p.isDemo,
    };
  });

  const total =
    products.total + posts.total + portfolios.total + collectionRows.length;

  const { whatsappNumber } = await getSiteSettings();
  // Localized prefill (S-01) — precedent: WhatsApp.greeting already reaches
  // the studio in the visitor's language.
  const waMessage = t("zeroWhatsappMessage", {
    query,
    site: SITE.url.replace(/^https?:\/\//, ""),
  });

  return (
    <div data-theme="light" className="bg-background text-ink">
      {/* §1 MASTHEAD on canvas — trail, bronze eyebrow (A2 rule 3), Fraunces
          head with the page's one split-reveal moment, then the GET form
          riding directly beneath. */}
      <section className={"u-shell section-compact"}>
        {/* Standard trail — /search had none (audit L-S5). */}
        <Breadcrumb
          ariaLabel={tCommon("breadcrumb")}
          items={[
            {
              label: tCommon("home"),
              href: "/",
            },
            { label: tNav("search") },
          ]}
        />

        <header className="mt-8 max-w-2xl">
          <Eyebrow>{t("heroEyebrow")}</Eyebrow>
          <h1 className="mt-4 font-display text-h1 leading-h1 tracking-display text-ink">
            {t("heroHeadline")}
          </h1>

          <form
            action={getPathname({ href: "/search", locale })}
            method="get"
            role="search"
            className="mt-6 flex max-w-xl items-center gap-3 md:mt-8"
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                aria-hidden
                strokeWidth={1.5}
                className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-graphite"
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={t("inputPlaceholder")}
                aria-label={t("inputAria")}
                className="h-12 w-full rounded-input border border-hairline bg-transparent pe-3 ps-11 font-body text-16 text-ink outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) placeholder:text-graphite focus-visible:border-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
              />
            </div>
            <Button type="submit" className="shrink-0">
              {t("submit")}
            </Button>
          </form>

          <p className="u-micro mt-5">
            {searched ? t("resultsCount", { total, query }) : t("tooShortHint")}
          </p>
        </header>
      </section>

      {/* §2 RESULTS INDEX — pieces in the catalog card grid, journal and
          portfolio hits as quiet white cards on the canvas run. */}
      {searched && total > 0 && (
        <section
          aria-label={t("heroHeadline")}
          className={"u-shell pb-standard"}
        >
          <div className="flex flex-col gap-20">
            {productItems.length > 0 && (
              <Reveal>
                <IndexHead
                  eyebrow={t("productsEyebrow")}
                  heading={t("productsHeading")}
                  count={products.total}
                  countLabel={t("sectionCount", { count: products.total })}
                />
                <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3">
                  {productItems.map((item) => (
                    <CatalogProductCard key={item.id} item={item} />
                  ))}
                </div>
                {products.total > productItems.length && (
                  // The full filterable set lives on the shop — hand the
                  // query over instead of paginating the utility page.
                  //
                  // `type=all` is load-bearing, not decoration. This page
                  // searches the WHOLE catalogue, but `/shop` opens on the art
                  // ecosystem (Phase 2a), so a bare handoff promised a number
                  // it could not deliver: "show all 619" for `pigment` landed
                  // on a shelf holding exactly one product, and `filament`
                  // landed on none at all. The sentinel restores the
                  // destination's superset property, and because tier maps 1:1
                  // to ecosystem and the default sort is `featured, tier`, the
                  // mixed shelf still opens on the studio's own work.
                  <div className="mt-8">
                    <Link
                      href={`/shop?q=${encodeURIComponent(query)}&type=${ALL_ECOSYSTEMS}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-input font-body text-14 font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      {t("productsShowMore", { total: products.total })}
                      <ArrowRight
                        aria-hidden
                        strokeWidth={1.5}
                        className="size-4"
                      />
                    </Link>
                  </div>
                )}
              </Reveal>
            )}

            {collectionRows.length > 0 && (
              <Reveal>
                <IndexHead
                  eyebrow={t("collectionsEyebrow")}
                  heading={t("collectionsHeading")}
                  count={collectionRows.length}
                  countLabel={t("sectionCount", {
                    count: collectionRows.length,
                  })}
                />
                <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3">
                  {collectionRows.map((collection) => (
                    <li key={collection.id}>
                      <CollectionCard
                        href={`/shop/${collection.slug}`}
                        name={t("collectionsEyebrow")}
                        promise={localizeName(collection, locale)}
                        image={collection.image}
                        imageAlt=""
                        ratio="4/5"
                      />
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            {posts.rows.length > 0 && (
              <Reveal>
                <IndexHead
                  eyebrow={t("postsEyebrow")}
                  heading={t("postsHeading")}
                  count={posts.total}
                  countLabel={t("sectionCount", { count: posts.total })}
                />
                <ul className="mt-4 border-t border-hairline">
                  {posts.rows.map((post) => {
                    const lp = localize(post, locale, ["title", "excerpt"]);
                    return (
                      <ResultRow
                        key={post.id}
                        href={`/blog/${post.slug}`}
                        title={lp.title}
                        snippet={lp.excerpt}
                      />
                    );
                  })}
                </ul>
              </Reveal>
            )}

            {portfolios.rows.length > 0 && (
              <Reveal>
                <IndexHead
                  eyebrow={t("portfolioEyebrow")}
                  heading={t("portfolioHeading")}
                  count={portfolios.total}
                  countLabel={t("sectionCount", { count: portfolios.total })}
                />
                <ul className="mt-4 border-t border-hairline">
                  {portfolios.rows.map((item) => {
                    const lp = localize(item, locale, ["title", "story"]);
                    return (
                      <ResultRow
                        key={item.id}
                        href={`/portfolio/${item.slug}`}
                        title={lp.title}
                        snippet={lp.story.slice(0, 200)}
                      />
                    );
                  })}
                </ul>
              </Reveal>
            )}
          </div>
        </section>
      )}

      {/* §3 ZERO RESULTS — white panel with the commission pitch: every piece
          is made to order, so the miss becomes a WhatsApp assist (Part 0:
          ordering funnels through WhatsApp; the wa.me link IS the action). */}
      {searched && total === 0 && (
        <section className={"u-shell pb-standard"}>
          {/* §5.6's no-results copy: a statement, one line of direction, one
              action — and because every piece here is made to order, the miss
              becomes a commission rather than a dead end. */}
          <EmptyState
            eyebrow={t("zeroEyebrow")}
            statement={t("zeroHeading")}
            direction={t("zeroBody")}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/custom-order">{t("zeroWhatsappCta")}</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="secondary" size="lg">
                <a
                  href={buildWaLink(waMessage, whatsappNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="search_zero"
                >
                  {tCommon("startOnWhatsApp")}
                  <span className="sr-only"> {tCommon("openInNewTab")}</span>
                </a>
              </Button>
            }
          />
        </section>
      )}

      {/* §4 EMPTY / TOO-SHORT QUERY — gentle starting point on the same white
          panel, with the shop as the lead and a quiet WhatsApp assist. */}
      {!searched && (
        <section className={"u-shell pb-standard"}>
          <EmptyState
            eyebrow={t("emptyEyebrow")}
            statement={t("emptyHeading")}
            direction={t("emptyBody")}
            action={
              <Button asChild variant="primary" size="lg">
                <Link href="/shop">{t("browseShop")}</Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="secondary" size="lg">
                <a
                  href={buildWaLink(
                    defaultWaGreeting(tWa("greeting")),
                    whatsappNumber,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="search_empty"
                >
                  {tCommon("startOnWhatsApp")}
                  <span className="sr-only"> {tCommon("openInNewTab")}</span>
                </a>
              </Button>
            }
          />
        </section>
      )}
    </div>
  );
}
