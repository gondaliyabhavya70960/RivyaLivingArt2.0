import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { CollectionCard } from "@/components/storefront/collection-card";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { Pagination } from "@/components/storefront/pagination";
import { ShopExplorer } from "@/components/storefront/shop-explorer";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { groupForCategorySlug } from "@/lib/catalog-taxonomy";
import { db } from "@/lib/db";
import { getSiteImages } from "@/lib/site-images-server";
import {
  buildProductWhere,
  DEFAULT_SORT,
  fetchDefaultShopFirstPage,
  fetchProductsPage,
  fetchProductsPageAt,
  fetchShopCategoryOptions,
  isSortKey,
  parseShopPage,
  resolveAfterCursor,
  type ShopCategoryOption,
  CATALOG_GROUPS,
  isEcosystem,
  normalizeEcosystemParam,
  type ShopFilters,
  type ShopPage,
  type SortKey,
} from "@/lib/shop";

/** ISR: the shop reflects studio edits within 5 minutes. */
export const revalidate = 300;

/**
 * Page 2+ carries a self-referential canonical (`/shop?page=N`), the same
 * treatment `/blog` already has (SEO-503). Without it every numbered page
 * folded onto `/shop` as a duplicate, so the crawler was told pages 2..N of a
 * four-thousand-piece catalogue were all the same document.
 *
 * Only `page` changes the canonical. Filter-only views (`?category=`, `?q=`,
 * `?sort=`) still canonicalise to bare `/shop` — they are facets of one
 * collection, not separate documents.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Shop.meta" });
  const page = parseShopPage(first((await searchParams).page));

  if (page >= 2) {
    return {
      title: t("titlePaged", { page }),
      description: t("description"),
      alternates: localeAlternates(`/shop?page=${page}`, locale),
    };
  }

  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/shop", locale),
  };
}

type ShopSearchParams = {
  q?: string | string[];
  type?: string | string[];
  category?: string | string[];
  occasion?: string | string[];
  band?: string | string[];
  stock?: string | string[];
  sort?: string | string[];
  /** §7.7's numbered pager — 1-based. Absent and `1` are the same page. */
  page?: string | string[];
  /** Browse depth — last-seen product id; the grid resumes AFTER it. */
  after?: string | string[];
};

/** First non-empty string value of a search param. */
function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The href behind every numbered page link — the whole active view, plus
 * `?page=` when it is not page 1.
 *
 * Two rules make the pager behave:
 *
 * - **Every filter, sort and search term survives a page change**, because
 *   they are all written back here. The param order matches the explorer's
 *   own `apply()` so a URL reached by clicking `2` and one reached by
 *   changing a filter are the same string.
 * - **Page 1 is `/shop`, never `/shop?page=1`** — one canonical URL for the
 *   entry view, the same way `?sort=featured` is omitted for the default.
 *   `?after=` is deliberately dropped: browse depth belongs to `Load more`,
 *   and jumping to a numbered page is a fresh start.
 *
 * The `#pieces` fragment lands the visitor on the grid instead of scrolling
 * them back through the masthead and the collection strip on every page turn.
 */
function shopHref(filters: ShopFilters, sort: SortKey, page: number): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.band) params.set("band", filters.band);
  if (filters.stock) params.set("stock", filters.stock);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/shop?${qs}#pieces` : "/shop#pieces";
}

/**
 * §7.2 — `ALL · RESIN ART · GIFTS · SUPPLIES · 3D PRINTING`.
 *
 * Four of the five are ecosystem groups the catalogue already understands;
 * `GIFTS` is the owner's own `gift-collections` shelf, reached through the
 * same `?category=` param the drawer writes. Nothing new is invented — the
 * tabs are just five saved views of the existing filter vocabulary, rendered
 * as real links so they are crawlable and keyboard-native.
 */
const CATEGORY_TABS = [
  { key: "all", href: "/shop?type=all", type: "all", category: undefined },
  { key: "art", href: "/shop?type=art", type: "art", category: undefined },
  {
    key: "gifts",
    href: "/shop?category=gift-collections",
    type: undefined,
    category: "gift-collections",
  },
  {
    key: "supplies",
    href: "/shop?type=supplies",
    type: "supplies",
    category: undefined,
  },
  {
    key: "print",
    href: "/shop?type=print",
    type: "print",
    category: undefined,
  },
] as const;

/** How many collection tiles the §7.3 strip carries before it stops. */
const STRIP_LIMIT = 12;

/**
 * /shop — REDESIGN.md Part 7.
 *
 * A working page, deliberately: a `compact` masthead with no hero image, the
 * five text tabs, then the collection strip (art is browsed by look, not by
 * list — and §7.3 bans the piece counts here outright: "a `139 pieces` label
 * on a candle-holder category reads as dropship, not atelier"). The explorer
 * below owns the sticky toolbar, the filter drawer, the chip row and the
 * grid.
 *
 * Band rhythm (Part 3.1): mineral masthead → sand strip → mineral grid. No
 * commission band of its own — the footer already closes every page with
 * one, and two "BESPOKE COMMISSIONS" eyebrows stacked on top of each other
 * would be both a duplicated heading (Part 17) and two dark bands running
 * together (Part 3.1).
 */
export default async function ShopPage({
  params: localeParams,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<ShopSearchParams>;
}) {
  const { locale } = await localeParams;
  setRequestLocale(locale);

  const t = await getTranslations("Shop");
  const tNav = await getTranslations("Nav");
  const tCommon = await getTranslations("Common");
  const images = await getSiteImages();

  const params = await searchParams;
  const sortParam = first(params.sort);
  const sort: SortKey = isSortKey(sortParam) ? sortParam : DEFAULT_SORT;
  // `/shop` leads with the art ecosystem; supplies and 3D printing keep their
  // own tabs and category pages, and `?type=all` restores the mixed view.
  // `requestedType` stays the raw URL value because `hasFilters` below decides
  // whether this request can use the shared 300s cache — resolving the default
  // into it would make every bare /shop look filtered and lose that cache.
  const requestedType = first(params.type);
  const filters = {
    q: first(params.q),
    type: normalizeEcosystemParam(requestedType),
    category: first(params.category),
    occasion: first(params.occasion),
    band: first(params.band),
    stock: first(params.stock),
  };

  const requestedPage = parseShopPage(first(params.page));
  // `?after=` is browse depth mirrored by `Load more`; `?page=` is the
  // numbered pager. They are two ways of asking for the same sequence, so
  // exactly one of them drives a request — the explicit page wins, and a
  // stale `after` left in the URL is ignored rather than fighting it.
  const after = requestedPage > 1 ? undefined : first(params.after);
  const hasFilters = Boolean(
    filters.q ||
    requestedType ||
    filters.category ||
    filters.occasion ||
    filters.band ||
    filters.stock,
  );

  let page: ShopPage;
  let categoryOptions: ShopCategoryOption[];
  /** Numbered-pager position — null while `Load more` is driving the view. */
  let pager: { page: number; totalPages: number } | null = null;
  if (!hasFilters && !after && requestedPage === 1) {
    // The bare /shop entry is per-visitor-identical — serve the 300s
    // tag-invalidated bundle instead of paying 4 uncached queries per hit.
    const bundle = await fetchDefaultShopFirstPage(locale, sort);
    page = bundle.page;
    categoryOptions = bundle.categories;
    pager = { page: bundle.page.page, totalPages: bundle.page.totalPages };
  } else if (after) {
    // A shared or reloaded `Load more` URL: unchanged cursor behaviour, and
    // no numbered pager, because a resumed slice has no page number.
    const where = buildProductWhere(filters);
    [page, categoryOptions] = await Promise.all([
      resolveAfterCursor(after, where).then((cursor) =>
        fetchProductsPage({ where, sort, cursor, locale }),
      ),
      fetchShopCategoryOptions(locale),
    ]);
  } else {
    const where = buildProductWhere(filters);
    const [offsetPage, options] = await Promise.all([
      fetchProductsPageAt({ where, sort, page: requestedPage, locale }),
      fetchShopCategoryOptions(locale),
    ]);
    page = offsetPage;
    categoryOptions = options;
    pager = { page: offsetPage.page, totalPages: offsetPage.totalPages };
  }

  // Tile photography for the §7.3 strip — the owner's own category images.
  const categoryImages = new Map(
    (await db.category.findMany({ select: { slug: true, image: true } })).map(
      (row) => [row.slug, row.image],
    ),
  );

  const groupLabels = {
    art: t("tabArt"),
    supplies: t("tabSupplies"),
    print: t("tabPrint"),
  } as const;

  // The collection strip follows the active ecosystem. `categoryOptions` is
  // the whole catalogue in curated `order`, so an unfiltered slice always
  // showed the first twelve art categories — which read as the shop's
  // collections even while the grid below was showing molds and filament.
  // Hoisted to a const so the type guard still narrows inside the closure
  // below — narrowing on `filters.type` does not survive the callback.
  const ecosystem = isEcosystem(filters.type) ? filters.type : undefined;
  const stripCollections = (
    ecosystem
      ? categoryOptions.filter((option) =>
          (CATALOG_GROUPS[ecosystem].slugs as readonly string[]).includes(
            option.slug,
          ),
        )
      : categoryOptions
  ).slice(0, STRIP_LIMIT);

  const activeTab =
    CATEGORY_TABS.find(
      (tab) =>
        tab.type === filters.type &&
        (tab.category ?? undefined) === filters.category,
    )?.key ??
    // A drawer-chosen collection is still "browsing the shop" — light the tab
    // for the ecosystem it belongs to rather than leaving the row unmarked.
    // `filters.type` is always set now, so this resolves for every request.
    CATEGORY_TABS.find((tab) => tab.type === filters.type)?.key;

  return (
    <>
      {/* ═══ 7.1 · Shop masthead — compact, no hero image ═══ */}
      <section
        aria-labelledby="shop-heading"
        className="section-compact bg-mineral"
      >
        <div className="u-shell flex flex-col gap-6">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("shop") },
            ]}
          />
          <h1
            id="shop-heading"
            className="font-display text-h1 leading-[1.04] tracking-display text-ink"
          >
            {t("collectionTitle")}
          </h1>
          <p className="u-lede font-body text-body text-graphite">
            {t("collectionLead")}
          </p>
        </div>
      </section>

      {/* ═══ 7.2 · Category switcher — large text tabs, sapphire underline
          on the active one. Not a row of buttons. ═══ */}
      <nav aria-label={t("tabsAria")} className="bg-mineral">
        <div className="u-shell">
          <ul className="flex items-end gap-x-8 gap-y-2 overflow-x-auto border-b border-hairline pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_TABS.map((tab) => {
              const current = activeTab === tab.key;
              return (
                <li key={tab.key} className="shrink-0">
                  <Link
                    href={tab.href}
                    aria-current={current ? "page" : undefined}
                    className={cnTab(current)}
                  >
                    {t(`tab.${tab.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ═══ 7.3 · Collection strip — 3:4 tiles, names overlaid, NO counts ═══ */}
      {stripCollections.length > 0 ? (
        <section
          id="collections"
          aria-labelledby="collections-heading"
          className="section-standard scroll-mt-24 bg-sand"
        >
          <div className="u-shell flex flex-col gap-10">
            <SectionHeading
              id="collections-heading"
              eyebrow={t("strip.eyebrow")}
              title={t("strip.heading")}
              intro={t("strip.intro")}
            />
            <ul
              tabIndex={0}
              aria-label={t("strip.railLabel")}
              className="-mx-1 flex snap-x snap-mandatory gap-6 overflow-x-auto px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {stripCollections.map((collection) => (
                <li
                  key={collection.slug}
                  className="w-[66vw] max-w-[19rem] shrink-0 snap-start sm:w-[38vw] lg:w-[17rem]"
                >
                  <CollectionCard
                    href={`/shop/${collection.slug}`}
                    name={groupLabels[groupForCategorySlug(collection.slug)]}
                    promise={collection.name}
                    image={categoryImages.get(collection.slug)}
                    imageAlt=""
                    ratio="3/4"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══ 7.4 – 7.8 · Toolbar, drawer, chips, grid, paging ═══ */}
      {/* The page links carry `#pieces`, so a page turn lands on the toolbar
          rather than scrolling the masthead and the collection strip again.
          scroll-mt clears the 64px sticky header. */}
      <div id="pieces" className="scroll-mt-16 bg-mineral pb-20 md:pb-28">
        <ShopExplorer
          initialItems={page.items}
          initialCursor={page.nextCursor}
          total={page.total}
          categories={categoryOptions}
          activeFilters={filters}
          sort={sort}
          pagination={
            /* §7.7 — numbered, mono, prev/next. Server-rendered and passed
               in as a slot: `hrefFor` is a function, so it must never cross
               the client boundary, and real <a>s keep every page crawlable
               and bookmarkable. One page of results needs no pager. */
            pager && pager.totalPages > 1 ? (
              <Pagination
                currentPage={pager.page}
                totalPages={pager.totalPages}
                hrefFor={(target) => shopHref(filters, sort, target)}
                labels={{
                  label: tCommon("pagination.label"),
                  previous: tCommon("pagination.previous"),
                  next: tCommon("pagination.next"),
                  // Raw template — the component substitutes {number}.
                  page: String(tCommon.raw("pagination.page")),
                }}
              />
            ) : null
          }
          editorialBreak={
            /* §7.6 — one full-width break after row three so a
               4,000-piece catalogue stops reading as an endless grid. */
            <div className="grid items-center gap-8 border-y border-hairline py-10 md:grid-cols-12 md:gap-12">
              <MeniscusImage
                src={images["shop.editorialBreak"]}
                alt={t("editorialBreak.imageAlt")}
                width={1200}
                height={800}
                sizes="(min-width:768px) 40vw, 100vw"
                className="aspect-[3/2] md:col-span-5"
                imageClassName="object-cover"
              />
              <div className="flex flex-col gap-4 md:col-span-6 md:col-start-7">
                <Eyebrow>{t("editorialBreak.eyebrow")}</Eyebrow>
                <p className="max-w-[20ch] font-display text-h3 leading-[1.12] tracking-display text-ink">
                  {t("editorialBreak.heading")}
                </p>
                <p className="u-lede font-body text-small text-graphite">
                  {t("editorialBreak.body")}
                </p>
                <Button asChild variant="secondary" size="sm" className="w-fit">
                  <Link href="/process">{t("editorialBreak.cta")}</Link>
                </Button>
              </div>
            </div>
          }
        />
      </div>
    </>
  );
}

/**
 * §7.2's tab. Large text, a sapphire underline when current — the same active
 * mark the pagination uses, so "you are here" means one thing site-wide.
 * `min-h-14` keeps the 44px target while the type stays editorial.
 */
function cnTab(current: boolean): string {
  return [
    "-mb-px inline-flex min-h-14 items-center border-b-2 font-display text-h3 leading-none whitespace-nowrap",
    "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral",
    current
      ? "border-sapphire text-ink"
      : "border-transparent text-graphite hover:text-ink",
  ].join(" ");
}
