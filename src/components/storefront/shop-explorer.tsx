"use client";

import {
  useCallback,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { loadMoreProducts } from "@/actions/shop";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Button } from "@/components/storefront/button";
import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { EmptyState } from "@/components/storefront/empty-state";
import { ActiveFilters } from "@/components/storefront/filter-chip";
import { ProductCardSkeleton } from "@/components/storefront/skeletons";
import { cardVariantFor, shelfVariant } from "@/lib/card-meta";
import type { ShopProductItem } from "@/lib/shop";
import {
  CATALOG_GROUPS,
  DEFAULT_ECOSYSTEM,
  DEFAULT_SORT,
  isEcosystem,
  OCCASIONS,
  PRICE_BANDS,
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_SLUG,
  SORTS,
  type ShopFilters,
  type SortKey,
} from "@/lib/shop-filters";
import { cn } from "@/lib/utils";

/**
 * ShopExplorer — REDESIGN.md §7.4 – §7.8.
 *
 * The filter/sort/grid island for /shop and /shop/[category]. Everything the
 * v2.0 explorer did functionally it still does: the URL is the single source
 * of truth, every control writes search params through `router.replace`, and
 * the RSC page re-renders with a fresh first page. What changed is the shape
 * of the thing:
 *
 * - **The always-open sidebar is gone.** §7.4: "the current always-open
 *   sidebar with 21 collections and counts up to 1,841 is the main source of
 *   visual overwhelm." Filters now live behind one labelled `Filter` button —
 *   a 420–480px right drawer on desktop, an 85dvh bottom sheet on mobile.
 * - **A real sticky toolbar** at 64px under the header: search-within-shop on
 *   the inline-start, a labelled `Sort` menu and `Filter` on the end. Never a
 *   bare `<select>`.
 * - **The chip row is back and load-bearing** (§7.5: "the single most
 *   important missing control on the current shop page — you cannot presently
 *   see or undo what you have applied").
 * - **No infinite scroll** (§7.7). The IntersectionObserver that auto-fired
 *   two batches per view is deleted; paging is a deliberate, labelled act.
 * - **One editorial break after row three** (§7.6) so a 4,000-piece catalogue
 *   stops reading as an endless grid. The block itself is composed by the
 *   server page and passed in as a slot — a client island has no business
 *   owning editorial photography.
 *
 * The ecosystem tabs moved OUT of this component and onto the page as plain
 * links (§7.2 wants large text tabs, and a crawlable `<a>` is strictly better
 * than a button that rewrites the URL).
 */

/** Cards appended per batch — matches the server action's hard cap. */
const LOADING_PLACEHOLDERS = 3;
/* §7.8 — "nine flat skeleton cards, filters stay interactive" while a
   filter transition is in flight. Dimming the stale grid instead showed
   the PREVIOUS result set at 50% while the new one loaded, which reads as
   a disabled page rather than a loading one. */
const PENDING_SKELETONS = 9;

/** §7.6: the editorial break sits after the third row of the 3-up grid. */
const EDITORIAL_BREAK_AFTER = 9;

/* Part 16: 2px sapphire ring at 3px offset, champagne inside a dark band. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral";

export type ShopCategoryOption = {
  slug: string;
  name: string;
  count: number;
};

export interface ShopExplorerProps {
  initialItems: ShopProductItem[];
  initialCursor: string | null;
  /** Full result count for the active filters — the "N pieces" figure. */
  total: number;
  categories: ShopCategoryOption[];
  /** Filters currently applied (mirrors the URL search params). */
  activeFilters: ShopFilters;
  sort: SortKey;
  /**
   * Category pages pin the category server-side: hides the collection filter
   * group and keeps the slug out of the URL (it lives in the path).
   */
  lockedCategory?: string;
  /**
   * Product ids already shown outside the grid. The server excludes them from
   * the grid's FIRST page; deeper pages are fetched over the unmodified where
   * (so the cursor sequence never skips or repeats a row) and these ids are
   * dropped from the appended batch at render time.
   */
  excludeIds?: string[];
  /**
   * §7.6's full-width editorial break, composed server-side and injected
   * after row three. Omitted on the collection pages, which are editorial
   * end to end already.
   */
  editorialBreak?: ReactNode;
  /**
   * §7.7's numbered pager, rendered on the server and injected beneath the
   * grid. A slot rather than props because the pager is built from `hrefFor`,
   * a function — it belongs to the route that owns the URL vocabulary, and a
   * function cannot cross the client boundary. Null while `Load more` is
   * driving the view (a resumed `?after=` slice has no page number) or when
   * everything fits on one page.
   */
  pagination?: ReactNode;
}

export function ShopExplorer({
  initialItems,
  initialCursor,
  total,
  categories,
  activeFilters,
  sort,
  lockedCategory,
  excludeIds,
  editorialBreak,
  pagination,
}: ShopExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Shop");
  const tCommon = useTranslations("Common");
  // The three tiers' customer names (docs/plan/07): this drawer is where
  // that block first reaches the storefront.
  const tTier = useTranslations("ProductTier");
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  /** Index where the latest batch starts — those cards get the stagger. */
  const [enterFrom, setEnterFrom] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState(activeFilters.q ?? "");

  // Reset when the server streams a fresh first page (filters changed).
  // Render-phase adjustment — never a sync setState inside an effect.
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);
  if (prevInitialItems !== initialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
    setCursor(initialCursor);
    setEnterFrom(null);
    setLoadError(false);
    setQuery(activeFilters.q ?? "");
  }

  /* ————————— URL writing (unchanged semantics) ————————— */

  function apply(next: Partial<ShopFilters & { sort: SortKey }>) {
    const merged = {
      q: activeFilters.q,
      type: activeFilters.type,
      category: activeFilters.category,
      occasion: activeFilters.occasion,
      band: activeFilters.band,
      stock: activeFilters.stock,
      sizeTier: activeFilters.sizeTier,
      sort,
      ...next,
    };
    // A category outside the chosen ecosystem cannot match — drop it so
    // switching tabs never strands the view on an empty intersection.
    if (
      merged.category &&
      isEcosystem(merged.type) &&
      !(CATALOG_GROUPS[merged.type].slugs as readonly string[]).includes(
        merged.category,
      )
    ) {
      merged.category = undefined;
    }
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (!lockedCategory && merged.type) params.set("type", merged.type);
    if (!lockedCategory && merged.category)
      params.set("category", merged.category);
    if (merged.occasion) params.set("occasion", merged.occasion);
    if (merged.band) params.set("band", merged.band);
    if (merged.stock) params.set("stock", merged.stock);
    if (merged.sizeTier) params.set("sizeTier", merged.sizeTier);
    if (merged.sort !== DEFAULT_SORT) params.set("sort", merged.sort);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function clearFilters() {
    setQuery("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  /* ————————— paging (§7.7: never infinite scroll) ————————— */

  const fetchingRef = useRef(false);
  const { q, category, occasion, band, type, stock, sizeTier } = activeFilters;

  const loadMore = useCallback(async () => {
    if (!cursor || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadError(false);
    setLoadingMore(true);
    try {
      const page = await loadMoreProducts({
        filters: {
          q,
          category: lockedCategory ?? category,
          occasion,
          band,
          type,
          stock,
          sizeTier,
        },
        sort,
        cursor,
        locale,
      });
      const appended = excludeIds?.length
        ? page.items.filter((item) => !excludeIds.includes(item.id))
        : page.items;
      if (page.items.length === 0 && page.nextCursor === null) {
        // The action swallows its own failures and returns an empty page —
        // indistinguishable from "nothing left" only when a cursor existed.
        setLoadError(true);
        return;
      }
      setItems((prev) => {
        // Idempotent nested set (same value on a StrictMode double-invoke):
        // the batch boundary must be the REAL pre-append length.
        setEnterFrom(prev.length);
        return [...prev, ...appended];
      });
      setCursor(page.nextCursor);
      // Mirror browse depth into the URL without navigating: `after` is the
      // id the appended batch was fetched after, so a shared or reloaded URL
      // resumes at this batch. A numbered view already says where it is, and
      // the server ignores `after` when `page` is set — writing it anyway
      // would leave a URL claiming a depth it will not restore.
      const url = new URL(window.location.href);
      if (!url.searchParams.has("page")) {
        url.searchParams.set("after", cursor);
        window.history.replaceState(null, "", url);
      }
    } catch {
      setLoadError(true);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [
    cursor,
    q,
    category,
    occasion,
    band,
    type,
    stock,
    sizeTier,
    lockedCategory,
    sort,
    locale,
    excludeIds,
  ]);

  /* ————————— derived view state ————————— */

  const activeType = isEcosystem(type) ? type : undefined;
  const stockIn = stock === "in";
  // An unknown URL value shows no chip and no selected row, as `band` does.
  const activeSizeTier = PRODUCT_SIZE_TIERS.find(
    (tier) => SIZE_TIER_SLUG[tier] === sizeTier,
  );

  /* An ecosystem equal to the DEFAULT is not something the visitor applied.
     The server resolves `?type=` through `normalizeEcosystemParam` before it
     reaches here, so `type` is always set — which made this true on a bare
     `/shop`, rendering "Clear all" over nothing to clear and making the
     `emptyCatalogHeading` branch below unreachable, since an empty shelf was
     always attributed to a filter. */
  const hasActiveFilters = Boolean(
    q ||
    occasion ||
    band ||
    stock ||
    sizeTier ||
    (!lockedCategory && (category || (type && type !== DEFAULT_ECOSYSTEM))),
  );

  const sortLabels: Record<SortKey, string> = {
    featured: t("sortFeatured"),
    newest: t("sortNewest"),
    "price-asc": t("sortPriceAsc"),
    "price-desc": t("sortPriceDesc"),
    name: t("sortName"),
  };

  /**
   * A collection outside the active ecosystem genuinely resolves to zero
   * rows, so §4.6's "zero-count options disable rather than disappear" has
   * something real to bite on: the option stays listed, greyed, at `0`.
   */
  const collectionOptions = categories.map((option) => ({
    ...option,
    effectiveCount:
      activeType &&
      !(CATALOG_GROUPS[activeType].slugs as readonly string[]).includes(
        option.slug,
      )
        ? 0
        : option.count,
  }));

  /* §7.5 — one chip per applied filter, each removable. */
  const chips: { id: string; label: string; onRemove: () => void }[] = [];
  if (q)
    chips.push({
      id: "q",
      label: q,
      onRemove: () => apply({ q: undefined }),
    });
  if (!lockedCategory && category)
    chips.push({
      id: "category",
      label:
        categories.find((option) => option.slug === category)?.name ?? category,
      onRemove: () => apply({ category: undefined }),
    });
  if (occasion)
    chips.push({
      id: "occasion",
      label: occasion,
      onRemove: () => apply({ occasion: undefined }),
    });
  if (band)
    chips.push({
      id: "band",
      label: PRICE_BANDS.find((b) => b.key === band)?.label ?? band,
      onRemove: () => apply({ band: undefined }),
    });
  if (stockIn)
    chips.push({
      id: "stock",
      label: t("inStockOnly"),
      onRemove: () => apply({ stock: undefined }),
    });
  if (activeSizeTier)
    chips.push({
      id: "sizeTier",
      // The one-word name: chips are dense. The drawer rows carry the full one.
      label: tTier(`${activeSizeTier}.shortName`),
      onRemove: () => apply({ sizeTier: undefined }),
    });

  /* One RATIO per grid, one VARIANT per product — and the split between
     those two words is the whole rule (§4.6 + docs/plan/07).

     The shelf decides the ratio once: a supplies view of pigments and parts
     goes compact and denser, anything with real pieces in it stays editorial.
     Deciding THAT per card would interleave 1:1 tiles with 4:5 ones and leave
     every row ragged.

     The tier then decides the CONTENT inside that ratio — `collectible`,
     `memory`, `gift`, or `full` for the untiered backlog. Mixing those in one
     grid is safe precisely because none of them is `compact`: all four render
     the 4:5 stage, so the ragged-row problem the shelf exists to prevent
     cannot arise from this branch.

     A compact shelf keeps compact and asks no tier question. That grid is
     parts rather than pieces, its rows are untiered anyway, and a 1:1 supplies
     tile is not somewhere a tier variant has anything to say. */
  const gridVariant = shelfVariant(items);
  const variantFor = (item: ShopProductItem) =>
    gridVariant === "compact" ? "compact" : cardVariantFor(item);

  const cards = items.map((item, index) => {
    const entering = enterFrom !== null && index >= enterFrom;
    return (
      <div
        key={item.id}
        className={entering ? "sf-card-enter" : undefined}
        style={
          entering
            ? { animationDelay: `${Math.min(index - enterFrom, 7) * 55}ms` }
            : undefined
        }
      >
        {/* The first row carries the LCP: eager, never revealed (Part 14). */}
        <CatalogProductCard
          item={item}
          variant={variantFor(item)}
          morph
          priority={index < 3}
        />
      </div>
    );
  });

  if (editorialBreak && cards.length > EDITORIAL_BREAK_AFTER) {
    cards.splice(
      EDITORIAL_BREAK_AFTER,
      0,
      <div key="editorial-break" className="col-span-full my-4 md:my-8">
        {editorialBreak}
      </div>,
    );
  }

  /* ————————— render ————————— */

  return (
    <div>
      {/* ═══ TOOLBAR — §7.4, 64px, sticky beneath the 64px scrolled header.
          No blur: Part 3.5 reserves it for the header alone. ═══ */}
      <div className="sticky top-16 z-(--z-bar) border-y border-hairline bg-mineral">
        <div className="u-shell flex h-16 items-center gap-2 md:gap-6">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              apply({ q: query.trim() || undefined });
            }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <label
              htmlFor="shop-search"
              className="u-micro hidden shrink-0 md:block"
            >
              {t("toolbar.searchLabel")}
            </label>
            <div className="relative flex min-w-0 flex-1 items-center">
              <Search
                aria-hidden
                strokeWidth={1.5}
                className="pointer-events-none absolute start-0 size-4 text-graphite md:hidden"
              />
              <input
                id="shop-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                /* Reuses the catalogue's existing placeholder — short enough to
                   survive a 375px toolbar without clipping. */
                placeholder={t("searchPlaceholder")}
                aria-label={t("toolbar.searchLabel")}
                className={cn(
                  "h-11 w-full min-w-0 rounded-input border-0 bg-transparent ps-6 pe-9 font-body text-16 text-ink",
                  "placeholder:text-graphite [&::-webkit-search-cancel-button]:hidden md:ps-0",
                  FOCUS_RING,
                )}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    if (q) apply({ q: undefined });
                  }}
                  aria-label={t("toolbar.clearSearch")}
                  className={cn(
                    "absolute end-0 inline-flex size-11 items-center justify-center rounded-full text-graphite",
                    "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-ink motion-reduce:transition-none",
                    FOCUS_RING,
                  )}
                >
                  <X aria-hidden strokeWidth={1.5} className="size-4" />
                </button>
              ) : null}
            </div>
            <button type="submit" className="sr-only">
              {t("toolbar.searchSubmit")}
            </button>
          </form>

          {/* SORT — a labelled control opening a real menu (§7.4). */}
          <MenuPrimitive.Root>
            <MenuPrimitive.Trigger
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2 font-body text-small text-ink md:gap-2 md:px-3",
                "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire motion-reduce:transition-none",
                FOCUS_RING,
              )}
            >
              {/* Desktop reads "SORT · Featured"; a 375px toolbar has no
                  room for both, so the phone keeps the verb and drops the
                  value — the menu shows the current choice with a check. */}
              <span className="u-micro hidden md:inline">
                {t("toolbar.sortLabel")}
              </span>
              <span className="hidden max-w-32 truncate md:inline">
                {sortLabels[sort]}
              </span>
              <span className="md:hidden">{t("toolbar.sortLabel")}</span>
              <ChevronDown aria-hidden strokeWidth={1.5} className="size-4" />
            </MenuPrimitive.Trigger>
            <MenuPrimitive.Portal>
              <MenuPrimitive.Content
                data-theme="light"
                align="end"
                sideOffset={8}
                aria-label={t("toolbar.sortMenuLabel")}
                className="z-(--z-dialog) min-w-56 rounded-card border border-hairline bg-mineral p-1 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
              >
                {SORTS.map((key) => (
                  <MenuPrimitive.Item
                    key={key}
                    onSelect={() => apply({ sort: key })}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-input px-3 font-body text-small text-ink outline-none select-none",
                      "data-highlighted:bg-sand data-highlighted:text-sapphire",
                      key === sort && "font-medium",
                    )}
                  >
                    {sortLabels[key]}
                    {key === sort ? (
                      <Check
                        aria-hidden
                        strokeWidth={1.5}
                        className="size-4 text-sapphire"
                      />
                    ) : null}
                  </MenuPrimitive.Item>
                ))}
              </MenuPrimitive.Content>
            </MenuPrimitive.Portal>
          </MenuPrimitive.Root>

          {/* FILTER — the one entry point to every facet (§7.4). */}
          <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogPrimitive.Trigger
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-hairline px-3.5 font-body text-small text-ink md:px-4",
                "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-ink/40 motion-reduce:transition-none",
                FOCUS_RING,
              )}
            >
              <SlidersHorizontal
                aria-hidden
                strokeWidth={1.5}
                className="size-4"
              />
              {t("toolbar.filterLabel")}
              {chips.length > 0 ? (
                <span className="u-num text-12 text-sapphire">
                  {chips.length}
                </span>
              ) : null}
            </DialogPrimitive.Trigger>

            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-dialog) bg-obsidian/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
              <DialogPrimitive.Content
                data-theme="light"
                aria-describedby={undefined}
                className={cn(
                  "fixed z-(--z-dialog) flex flex-col bg-mineral text-ink outline-none",
                  // Mobile: a bottom sheet at 85dvh, sliding up (§4.6).
                  "inset-x-0 bottom-0 h-[85dvh] rounded-t-card",
                  "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
                  // Desktop: a 448px end-edge drawer, full height (the
                  // logical start-auto/end-0 above already puts it on the
                  // left in RTL, so its entrance/exit direction has to
                  // follow — a physical "from-right" twin would slide the
                  // wrong way past a panel already sitting on the left).
                  "sm:inset-y-0 sm:h-dvh sm:w-[28rem] sm:rounded-none sm:start-auto sm:end-0",
                  "sm:data-[state=open]:slide-in-from-right sm:data-[state=closed]:slide-out-to-right",
                  "sm:rtl:data-[state=open]:slide-in-from-left sm:rtl:data-[state=closed]:slide-out-to-left",
                  "duration-(--dur-base) ease-(--ease-luxury) motion-reduce:animate-none",
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline ps-6 pe-3 py-3">
                  <DialogPrimitive.Title className="font-display text-h3 text-ink">
                    {t("drawer.title")}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close
                    aria-label={tCommon("close")}
                    className={cn(
                      "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-graphite",
                      "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-ink motion-reduce:transition-none",
                      FOCUS_RING,
                    )}
                  >
                    <X aria-hidden strokeWidth={1.5} className="size-5" />
                  </DialogPrimitive.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
                  <Accordion
                    type="multiple"
                    defaultValue={["collection", "price"]}
                  >
                    {!lockedCategory && collectionOptions.length > 0 ? (
                      <AccordionItem value="collection">
                        <AccordionTrigger>
                          {t("drawer.sectionCollection")}
                        </AccordionTrigger>
                        <AccordionContent>
                          <FilterRows>
                            <FilterRow
                              label={t("allCollections")}
                              selected={!category}
                              onSelect={() => apply({ category: undefined })}
                            />
                            {collectionOptions.map((option) => (
                              <FilterRow
                                key={option.slug}
                                label={option.name}
                                count={option.effectiveCount}
                                disabled={option.effectiveCount === 0}
                                disabledReason={t("drawer.unavailable")}
                                selected={category === option.slug}
                                onSelect={() =>
                                  apply({
                                    category:
                                      category === option.slug
                                        ? undefined
                                        : option.slug,
                                  })
                                }
                              />
                            ))}
                          </FilterRows>
                        </AccordionContent>
                      </AccordionItem>
                    ) : null}

                    <AccordionItem value="occasion">
                      <AccordionTrigger>
                        {t("drawer.sectionOccasion")}
                      </AccordionTrigger>
                      <AccordionContent>
                        <FilterRows>
                          <FilterRow
                            label={t("allOccasions")}
                            selected={!occasion}
                            onSelect={() => apply({ occasion: undefined })}
                          />
                          {OCCASIONS.map((name) => (
                            <FilterRow
                              key={name}
                              label={name}
                              selected={occasion === name}
                              onSelect={() =>
                                apply({
                                  occasion:
                                    occasion === name ? undefined : name,
                                })
                              }
                            />
                          ))}
                        </FilterRows>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="price">
                      <AccordionTrigger>
                        {t("drawer.sectionPrice")}
                      </AccordionTrigger>
                      <AccordionContent>
                        <FilterRows>
                          <FilterRow
                            label={t("allPrices")}
                            selected={!band}
                            onSelect={() => apply({ band: undefined })}
                          />
                          {PRICE_BANDS.map((priceBand) => (
                            <FilterRow
                              key={priceBand.key}
                              label={priceBand.label}
                              selected={band === priceBand.key}
                              onSelect={() =>
                                apply({
                                  band:
                                    band === priceBand.key
                                      ? undefined
                                      : priceBand.key,
                                })
                              }
                            />
                          ))}
                        </FilterRows>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="availability">
                      <AccordionTrigger>
                        {t("drawer.sectionAvailability")}
                      </AccordionTrigger>
                      <AccordionContent>
                        <FilterRows>
                          <FilterRow
                            label={t("drawer.anyAvailability")}
                            selected={!stockIn}
                            onSelect={() => apply({ stock: undefined })}
                          />
                          <FilterRow
                            label={t("inStockOnly")}
                            selected={stockIn}
                            onSelect={() =>
                              apply({ stock: stockIn ? undefined : "in" })
                            }
                          />
                        </FilterRows>
                      </AccordionContent>
                    </AccordionItem>

                    {/* The three-tier architecture (docs/plan/07 step 8) —
                        the customer's intent axis, not a sub-filter, and it
                        will lead this drawer once the catalogue is tiered.
                        Until step 3's backlog is worked it sits last and
                        closed: a facet that empties the shelf for almost
                        every visitor is not a headline. Rows mirror
                        occasion/availability — no counts, no disabled rows. */}
                    <AccordionItem value="sizeTier">
                      <AccordionTrigger>
                        {t("drawer.sectionSizeTier")}
                      </AccordionTrigger>
                      <AccordionContent>
                        <FilterRows>
                          <FilterRow
                            label={t("allSizeTiers")}
                            selected={!activeSizeTier}
                            onSelect={() => apply({ sizeTier: undefined })}
                          />
                          {PRODUCT_SIZE_TIERS.map((tier) => (
                            <FilterRow
                              key={tier}
                              label={tTier(`${tier}.name`)}
                              selected={activeSizeTier === tier}
                              onSelect={() =>
                                apply({
                                  sizeTier:
                                    activeSizeTier === tier
                                      ? undefined
                                      : SIZE_TIER_SLUG[tier],
                                })
                              }
                            />
                          ))}
                        </FilterRows>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                {/* Sticky footer — §4.6: Clear all (ghost) + Apply (primary). */}
                {/* Sticky footer — §4.6: `Clear all` ghost + `Apply (N)`
                    primary. `Clear all` is conditionally rendered rather than
                    disabled: with nothing applied there is nothing to see or
                    undo, and a dead control plus its mono reason line would
                    push the sticky footer past its own edge. */}
                <div className="flex shrink-0 items-center justify-end gap-4 border-t border-hairline px-6 py-4">
                  {hasActiveFilters ? (
                    <Button
                      variant="ghost"
                      size="md"
                      className="me-auto"
                      onClick={clearFilters}
                    >
                      {t("drawer.clearAll")}
                    </Button>
                  ) : null}
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setDrawerOpen(false)}
                  >
                    {t("drawer.apply", { count: total })}
                  </Button>
                </div>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
        </div>
      </div>

      <div className="u-shell pt-6 md:pt-8">
        {/* ═══ ACTIVE FILTERS — §7.5 ═══ */}
        <ActiveFilters
          filters={chips}
          count={total}
          countLabel={t("pieceNoun", { count: total })}
          onClearAll={clearFilters}
          clearAllLabel={t("drawer.clearAll")}
          /* A raw template — `ActiveFilters` does the {filter} substitution
             itself, so ICU must not try to format it here. */
          removeLabel={String(t.raw("activeFilters.remove"))}
          className="mb-8"
        />

        {/* sr-only section heading keeps h1 → h2 → h3 in order for AT. */}
        <h2 className="sr-only">{t("allPieces")}</h2>

        {/* Always in the DOM so count changes — including to zero — announce. */}
        <p role="status" aria-live="polite" className="sr-only">
          {t("resultsShowing", { shown: items.length, total })}
        </p>

        {items.length > 0 || loadingMore || isPending ? (
          <>
            <div
              className={cn(
                "grid gap-x-5 gap-y-12 md:gap-x-8",
                gridVariant === "compact"
                  ? // §4.6: the compact shelf runs 4–6 up.
                    "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
                  : "grid-cols-2 md:grid-cols-3",
              )}
            >
              {isPending
                ? Array.from({ length: PENDING_SKELETONS }, (_, i) => (
                    <ProductCardSkeleton key={`pending-${i}`} />
                  ))
                : cards}
              {!isPending &&
                loadingMore &&
                Array.from({ length: LOADING_PLACEHOLDERS }, (_, i) => (
                  <ProductCardSkeleton key={`placeholder-${i}`} />
                ))}
            </div>

            {/* The shelf's editorial end (plan §2.2 · spec "thin-catalog
                reframe"): a catalogue this size is not a shortage, it is the
                point — anything absent is a commission. Gated on there being
                nothing left to append, so it only ever appears where the grid
                actually ends; mid-scroll it would read as the end of results
                and stop a visitor who still has pages to go. */}
            {!isPending && !loadingMore && !cursor ? (
              <aside className="mt-16 border-t border-hairline pt-10">
                <div className="flex flex-col items-start gap-4 border border-hairline bg-sand p-8 md:flex-row md:items-center md:justify-between md:gap-8 md:p-10">
                  <div className="flex flex-col gap-3">
                    <p className="u-micro text-graphite">
                      {t("commissionEnd.eyebrow")}
                    </p>
                    <p className="max-w-[34ch] font-display text-h3 leading-h3 tracking-display text-ink">
                      {t("commissionEnd.statement")}
                    </p>
                  </div>
                  <Button variant="primary" size="lg" asChild>
                    <Link href="/custom-order">{t("commissionEnd.cta")}</Link>
                  </Button>
                </div>
              </aside>
            ) : null}

            {/* §7.7 — mono counts, a deliberate Load more, never a sentinel. */}
            <div className="mt-16 flex flex-col items-center gap-5 border-t border-hairline pt-10">
              <p className="u-micro">
                {t("resultsMono", { shown: items.length, total })}
              </p>
              {loadError ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="font-body text-small text-ink">
                    {t("loadError")}
                  </p>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => void loadMore()}
                  >
                    {t("retry")}
                  </Button>
                </div>
              ) : cursor ? (
                <Button
                  variant="secondary"
                  size="lg"
                  loading={loadingMore}
                  loadingLabel={tCommon("loading")}
                  onClick={() => void loadMore()}
                >
                  {t("loadMore")}
                </Button>
              ) : null}
              {/* §7.7 — the numbered pager sits last, under `Load more`:
                  "Keep `Load more` as an option, but 24-at-a-time behind a
                  single button on 4,386 items is 183 taps." Both routes to
                  the next 24 are offered; neither is a scroll sentinel. */}
              {pagination ? <div className="pt-2">{pagination}</div> : null}
            </div>
          </>
        ) : (
          /* §7.8 — empty, conditionally rendered, never beside content. */
          <EmptyState
            headingLevel="h3"
            statement={
              hasActiveFilters ? t("emptyStatement") : t("emptyCatalogHeading")
            }
            direction={
              hasActiveFilters ? t("emptyDirection") : t("emptyCatalogBody")
            }
            action={
              hasActiveFilters ? (
                <Button variant="primary" size="lg" onClick={clearFilters}>
                  {t("drawer.clearAll")}
                </Button>
              ) : undefined
            }
            secondaryAction={
              <Button variant="secondary" size="lg" asChild>
                <Link href="/custom-order">{t("commissionCta")}</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ————————————————— drawer rows ————————————————— */

function FilterRows({ children }: { children: ReactNode }) {
  return <div className="-mt-1 flex flex-col pb-2">{children}</div>;
}

/**
 * One facet option. Selection is carried by a mark AND weight, never colour
 * alone (Part 17); the count is mono and tabular; a zero-count option is
 * disabled at 40% with a stated reason rather than removed from the list
 * (§4.6), so the shape of the catalogue stays legible.
 */
function FilterRow({
  label,
  count,
  selected,
  disabled,
  disabledReason,
  onSelect,
}: {
  label: string;
  count?: number;
  selected: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      /* aria-disabled, not `disabled`: a natively-disabled row drops out of
         the tab order, so the visitor never hears why it is unavailable.
         Part 16 wants 40% opacity AND a stated reason — the reason is the
         mono `0` beside it, spelled out for AT in the sr-only line. */
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-4 rounded-input px-2 text-start font-body text-small",
        "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        disabled ? "cursor-default opacity-40" : "hover:bg-sand",
        selected ? "font-medium text-sapphire" : "text-ink",
        FOCUS_RING,
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center border",
            selected
              ? "border-sapphire bg-sapphire text-mineral"
              : "border-hairline",
          )}
        >
          {selected ? <Check strokeWidth={2} className="size-3" /> : null}
        </span>
        <span className="truncate">{label}</span>
        {disabled && disabledReason ? (
          <span className="sr-only">{disabledReason}</span>
        ) : null}
      </span>
      {count != null ? (
        <span className="u-num shrink-0 text-12 text-graphite">{count}</span>
      ) : null}
    </button>
  );
}
