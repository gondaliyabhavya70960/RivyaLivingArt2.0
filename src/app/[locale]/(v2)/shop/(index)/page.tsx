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
import { SnapRail } from "@/components/storefront/snap-rail";
import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { groupForCategorySlug } from "@/lib/catalog-taxonomy";
import { db } from "@/lib/db";
import { getSiteImageRefs } from "@/lib/site-images-server";
import { showDemoContent } from "@/lib/demo-content";
import { demoClause } from "@/lib/demo-clause";
import {
  buildProductWhere,
  DEFAULT_ECOSYSTEM,
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
  sizeTier?: string | string[];
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
  // `type` is omitted when it is the default, for the same reason `sort` is
  // below: one canonical URL for the entry view. `filters.type` is ALWAYS set
  // (the page resolves it through `normalizeEcosystemParam` before we get
  // here), so writing it unconditionally turned every page-1 link into
  // `/shop?type=art` — a URL that renders identically to `/shop`, disagrees
  // with the canonical `generateMetadata` emits, and misses the 300s
  // first-page bundle that `fetchDefaultShopFirstPage` only serves for the
  // bare entry view. Strictly fewer distinct URLs, same pages behind them.
  if (filters.type && filters.type !== DEFAULT_ECOSYSTEM) {
    params.set("type", filters.type);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.band) params.set("band", filters.band);
  if (filters.stock) params.set("stock", filters.stock);
  if (filters.sizeTier) params.set("sizeTier", filters.sizeTier);
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
  { key: "all", type: "all", category: undefined },
  { key: "art", type: "art", category: undefined },
  {
    key: "gifts",
    type: undefined,
    category: "gift-collections",
  },
  {
    key: "supplies",
    type: "supplies",
    category: undefined,
  },
  {
    key: "print",
    type: "print",
    category: undefined,
  },
] as const;

/**
 * A tab's link, carrying the search term across the pivot.
 *
 * These used to be constant strings, so switching ecosystem silently dropped
 * `?q=`. That made the row a one-way door in both directions: a visitor who
 * arrived from `/search` with a term could not narrow to RESIN ART without
 * retyping it, and one browsing supplies could not widen without losing it.
 *
 * `q` and `sort` travel; `category`, `occasion`, `band`, `stock` and
 * `sizeTier` do NOT.
 * Those are ecosystem-bound, and carrying one across would compose an
 * unsatisfiable AND — `?type=supplies&category=gift-collections` is a shelf
 * that cannot contain anything, which reads to the visitor as a broken tab
 * rather than an empty filter. The GIFTS tab sets its own category for the
 * same reason: it is a saved view, not a modifier.
 */
function tabHref(
  tab: (typeof CATEGORY_TABS)[number],
  q: string | undefined,
  sort: SortKey,
): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tab.type) params.set("type", tab.type);
  if (tab.category) params.set("category", tab.category);
  if (sort !== DEFAULT_SORT) params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

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
  // `SnapRail`'s prev/next/of live in the Lightbox namespace — one set of
  // carousel words for every rail on the site (see /shop/[category]).
  const tLightbox = await getTranslations("Lightbox");
  // Refs rather than bare URLs: the editorial break is the one slot this
  // page renders, and the ref carries the 20px LQIP the URL map drops. Same
  // cached read either way — `getSiteImages` is a narrowing of this one.
  const imageRefs = await getSiteImageRefs();

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
    sizeTier: first(params.sizeTier),
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
    filters.stock ||
    filters.sizeTier,
  );

  let page: ShopPage;
  let categoryOptions: ShopCategoryOption[];
  /** Numbered-pager position — null while `Load more` is driving the view. */
  let pager: { page: number; totalPages: number } | null = null;
  const showDemo = await showDemoContent();
  const demo = demoClause(showDemo);
  if (!hasFilters && !after && requestedPage === 1) {
    // The bare /shop entry is per-visitor-identical — serve the 300s
    // tag-invalidated bundle instead of paying 4 uncached queries per hit.
    const bundle = await fetchDefaultShopFirstPage(locale, sort, showDemo);
    page = bundle.page;
    categoryOptions = bundle.categories;
    pager = { page: bundle.page.page, totalPages: bundle.page.totalPages };
  } else if (after) {
    // A shared or reloaded `Load more` URL: unchanged cursor behaviour, and
    // no numbered pager, because a resumed slice has no page number.
    const where = buildProductWhere(filters, demo);
    [page, categoryOptions] = await Promise.all([
      resolveAfterCursor(after, where).then((cursor) =>
        fetchProductsPage({ where, sort, cursor, locale }),
      ),
      fetchShopCategoryOptions(locale),
    ]);
  } else {
    const where = buildProductWhere(filters, demo);
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
    (
      await db.category.findMany({
        where: { visible: true },
        select: { slug: true, image: true },
      })
    ).map((row) => [row.slug, row.image]),
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

  // A tab that leads to an empty shop is a promise the catalogue cannot keep
  // (audit §3.3). `categoryOptions` already carries the whole-catalogue count
  // per shelf — `fetchShopCategoryOptions` counts against `buildProductWhere({})`
  // and drops the empty ones — so "stocked" is just "some surviving shelf is
  // inside this tab".
  //
  // The membership test is `CATALOG_GROUPS[type].slugs`, deliberately NOT
  // `groupForCategorySlug` — the two disagree and the QUERY is the one that
  // matters. `buildProductWhere` filters an ecosystem with
  // `category.slug in CATALOG_GROUPS[type].slugs`, while `groupForCategorySlug`
  // answers `art` for anything unlisted. Judging the tab by the catch-all
  // would keep an `art` tab alive on a category the `art` tab cannot show,
  // which is the exact failure this hides.
  const stockedSlugs = new Set(categoryOptions.map((option) => option.slug));
  const visibleTabs = CATEGORY_TABS.filter((tab) => {
    // `all` is the way back from every other tab, and the tab the visitor is
    // standing on stays even when empty — hiding it would leave the row
    // unmarked and strand a URL that still resolves.
    if (tab.key === "all" || tab.key === activeTab) return true;
    if (tab.category) return stockedSlugs.has(tab.category);
    if (!tab.type || !isEcosystem(tab.type)) return true;
    return CATALOG_GROUPS[tab.type].slugs.some((slug) =>
      stockedSlugs.has(slug),
    );
  });

  return (
    <>
      {/* ═══ 7.1 · Shop masthead — compact, no hero image ═══ */}
      <section
        aria-labelledby="shop-heading"
        className="section-compact bg-background"
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
            className="font-display text-h1 leading-h1 tracking-display text-ink"
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
      <nav aria-label={t("tabsAria")} className="bg-background">
        <div className="u-shell">
          <ul className="flex items-end gap-x-8 gap-y-2 overflow-x-auto border-b border-hairline pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleTabs.map((tab) => {
              const current = activeTab === tab.key;
              return (
                <li key={tab.key} className="shrink-0">
                  <Link
                    href={tabHref(tab, filters.q, sort)}
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
            {/* The strip used to be hand-rolled snap markup that predated
                `SnapRail` — same native track, but with no way to tell there
                was more to the right. `SnapRail` is the same component the
                collection page's related rail already uses, and it adds the
                two affordances the spec asks for: a mono `N / M` counter and
                CarouselNav's prev/next, over a track that still swipes,
                scrolls and takes Tab exactly as before. */}
            <SnapRail
              ariaLabel={t("strip.railLabel")}
              labels={{
                prev: tLightbox("prev"),
                next: tLightbox("next"),
                of: tLightbox("of"),
              }}
              itemClassName="w-[66vw] max-w-[19rem] sm:w-[38vw] lg:w-[17rem]"
              items={stripCollections.map((collection) => (
                <CollectionCard
                  key={collection.slug}
                  href={`/shop/${collection.slug}`}
                  name={groupLabels[groupForCategorySlug(collection.slug)]}
                  promise={collection.name}
                  image={categoryImages.get(collection.slug)}
                  imageAlt=""
                  ratio="3/4"
                />
              ))}
            />
          </div>
        </section>
      ) : null}

      {/* ═══ 7.4 – 7.8 · Toolbar, drawer, chips, grid, paging ═══ */}
      {/* The page links carry `#pieces`, so a page turn lands on the toolbar
          rather than scrolling the masthead and the collection strip again.
          scroll-mt clears the 64px sticky header. */}
      <div id="pieces" className="scroll-mt-16 bg-background pb-20 md:pb-28">
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
                src={imageRefs["shop.editorialBreak"].url}
                blurDataURL={imageRefs["shop.editorialBreak"].blurDataUrl}
                alt={t("editorialBreak.imageAlt")}
                width={1200}
                height={800}
                sizes="(min-width:768px) 40vw, 100vw"
                className="aspect-[3/2] md:col-span-5"
                imageClassName="object-cover"
              />
              <div className="flex flex-col gap-4 md:col-span-6 md:col-start-7">
                <Eyebrow>{t("editorialBreak.eyebrow")}</Eyebrow>
                <p className="max-w-[20ch] font-display text-h3 leading-h3 tracking-display text-ink">
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
 * `min-h-14` clears the 44px HEIGHT floor, but the row carries no horizontal
 * padding (the underline sits flush under the letters, by design) — at the
 * `text-h3` clamp's mobile floor (24px) a three-letter tab like "ALL" measures
 * under 44px WIDE, which is what the audit flagged (A1's CHANGELOG note).
 * `pointer-coarse:` only fires on a touch pointer, so the fine-pointer desktop
 * row (already correctly sized) is untouched by either addition.
 */
function cnTab(current: boolean): string {
  return [
    "-mb-px inline-flex min-h-14 items-center border-b-2 font-display text-h3 leading-none whitespace-nowrap",
    "pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:justify-center",
    "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-background",
    current
      ? "border-sapphire text-ink"
      : "border-transparent text-graphite hover:text-ink",
  ].join(" ");
}
