import { unstable_cache } from "next/cache";

import type { ProductImageRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { localize } from "@/lib/localize";
import { editorialName } from "@/lib/product-name";
import type { ProductSizeTier } from "@/lib/product-size-tier";
import { demoClause, NO_DEMO, type DemoClause } from "@/lib/demo-clause";
import {
  CATALOG_GROUPS,
  DEFAULT_ECOSYSTEM,
  isEcosystem,
  PRICE_BANDS,
  type ShopFilters,
  type SortKey,
  sizeTierFromSlug,
} from "@/lib/shop-filters";

// Server-side shop catalog lib (imports db — server code only). Client
// components import the filter vocabulary from "@/lib/shop-filters" and may
// take TYPE-ONLY imports from here (erased at compile time).
export {
  ALL_ECOSYSTEMS,
  CATALOG_GROUPS,
  DEFAULT_ECOSYSTEM,
  DEFAULT_SORT,
  ECOSYSTEMS,
  isEcosystem,
  isSortKey,
  normalizeEcosystemParam,
  OCCASIONS,
  PRICE_BANDS,
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_SLUG,
  sizeTierFromSlug,
  SORTS,
  type PriceBand,
  type ShopFilters,
  type SizeTierSlug,
  type SortKey,
} from "@/lib/shop-filters";

/* ————————————————— where builder ————————————————— */

/**
 * Public catalog where-clause: always PUBLISHED and never DEMO seeds, plus
 * the optional search / ecosystem / category / occasion / price-band /
 * availability / product-tier filters.
 */
export function buildProductWhere(
  filters: ShopFilters,
  /**
   * The demo-content gate. Defaults to hiding every fixture; a public caller
   * that wants the owner's switch honoured passes `await demoWhere()`.
   */
  demo: DemoClause = NO_DEMO,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];

  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { shortTagline: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  // Ecosystem group (?type=art|supplies|print) — categoryId IN the group's
  // slugs. Composes with a specific category filter (AND) so a category
  // outside the group simply yields zero rows rather than lying.
  if (isEcosystem(filters.type)) {
    and.push({
      category: { slug: { in: [...CATALOG_GROUPS[filters.type].slugs] } },
    });
  }

  if (filters.category) {
    and.push({ category: { slug: filters.category } });
  }

  if (filters.occasion) {
    // occasions is a Json string array — Postgres jsonb containment.
    and.push({ occasions: { array_contains: [filters.occasion] } });
  }

  // Availability (?stock=in). No "out only" filter — the honest counterpart
  // is simply the unfiltered view.
  if (filters.stock === "in") {
    and.push({ inStock: true });
  }

  // The three-tier architecture (docs/plan/07 step 8). `Product.sizeTier`,
  // NOT `Product.tier` — that one is the import ladder ORDER_BY sorts on.
  // An unknown slug adds no clause, the same rule `band` follows below.
  const sizeTier = sizeTierFromSlug(filters.sizeTier);
  if (sizeTier) {
    and.push({ sizeTier });
  }

  const band = filters.band
    ? PRICE_BANDS.find((b) => b.key === filters.band)
    : undefined;
  if (band) {
    // Band overlap: priceMin <= band.max AND (priceMax ?? priceMin) >= band.min.
    // Products without any price are excluded from band filters entirely.
    and.push({ priceMin: { not: null } });
    if (band.max != null) {
      and.push({ priceMin: { lte: band.max } });
    }
    if (band.min != null) {
      and.push({
        OR: [
          { priceMax: { gte: band.min } },
          { priceMax: null, priceMin: { gte: band.min } },
        ],
      });
    }
  }

  return {
    status: "PUBLISHED",
    ...demo,
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

/* ————————————————— paged fetch ————————————————— */

/** A card image with the role the owner gave it (D21) — `IN_ROOM` lets a
 *  consumer prefer the room shot; `null` is an unlabelled gallery picture. */
export type ShopProductImage = {
  url: string;
  alt: string;
  role: ProductImageRole | null;
};

/** Serialized, client-safe product card data. */
export type ShopProductItem = {
  id: string;
  slug: string;
  title: string;
  /** Editorial short name for the card face (displayName ?? derived). */
  displayTitle: string;
  shortTagline: string | null;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  categoryName: string;
  image: ShopProductImage | null;
  /** Second gallery image — cards crossfade to it on hover. */
  hoverImage: ShopProductImage | null;
  variantChips: string[];
  /** Owner-sheet tier (1 = studio original). Null for hand-made studio rows. */
  tier: number | null;
  /**
   * The owner's three-tier architecture — what the piece IS
   * (docs/plan/07); `tier` above is where it CAME FROM. Null for the
   * untiered backlog. Read by `cardVariantFor` in card-meta.ts, never by
   * a query here.
   */
  sizeTier: ProductSizeTier | null;
  inStock: boolean;
  featured: boolean;
  /**
   * Published products sharing this exact title (M-S4 display collapse) —
   * set only when the title belongs to a duplicate group (count > 1), so
   * the card can advertise the group ("N options") without any data merge.
   * The card layer translates the chip label; this is just the number.
   */
  duplicateCount?: number;
  /**
   * Owner-typed free text, rendered as written — the D21 card meta line
   * (`src/lib/card-meta.ts`). Deliberately NOT in `TRANSLATABLE_FIELDS.product`
   * (mirroring `src/lib/large-format.ts`'s note): they render beside a
   * translated label rather than inside a translated sentence, and are never
   * parsed, sorted or compared, so the same nine-locale value is correct in
   * every one of them.
   */
  materials: string | null;
  dimensions: string | null;
  /**
   * The lead time as the owner typed it ("3 weeks", "10–14 days"). Read by
   * the MEMORY card variant, where "how long until I have it" is the
   * question a commemorative piece raises. Same non-translation rationale as
   * the two above.
   */
  timeline: string | null;
  /** Card-hover clip, owner-supplied. Never autoplays on the first (priority) row. */
  videoUrl: string | null;
  /** Synthetic Content Lab row — the card renders `<DemoMark/>` when true. */
  isDemo: boolean;
};

export type ShopPage = {
  items: ShopProductItem[];
  nextCursor: string | null;
  /**
   * Full result count for the where-clause — the UI's "N pieces".
   * `-1` when the caller opted out via `withTotal: false` (the load-more
   * action skips the count on cursor pages — see M-P2). Kept a required
   * number (not optional) because the SSR pages always request the count
   * and feed it straight into a `number` prop.
   */
  total: number;
};

// Every sort ends in a unique id tiebreak so cursor pagination is stable.
// "featured" is the merchandising default: curated picks first, then the
// owner-sheet tier ladder (tier 1 leads; hand-made NULL-tier rows last
// within their band), freshest first.
const ORDER_BY: Record<SortKey, Prisma.ProductOrderByWithRelationInput[]> = {
  featured: [
    { featured: "desc" },
    { tier: { sort: "asc", nulls: "last" } },
    { createdAt: "desc" },
    { id: "desc" },
  ],
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  "price-asc": [{ priceMin: { sort: "asc", nulls: "last" } }, { id: "desc" }],
  "price-desc": [{ priceMin: { sort: "desc", nulls: "last" } }, { id: "desc" }],
  // §7.4's fifth option. Plain ascending on the raw `title` column, and
  // deliberately NOT case-insensitive: Prisma's `orderBy` has no
  // `mode: "insensitive"` (that flag exists only on filters) and cannot emit a
  // `COLLATE` clause, so the comparison is whatever collation the column
  // carries — which here is `C`, i.e. byte order. Measured against the live
  // catalogue: the handful of lowercase-titled rows ("sqaure mould") sort
  // after every capitalised one and land on the last page. Making that
  // case-insensitive would take either raw SQL ordering on `lower(title)`
  // (losing the typed select and the relation joins) or a normalized column
  // plus its own index — a schema change, which this pass is not allowed to
  // make. Sorted on the base title, not the localized one, so the sequence is
  // stable across all nine locales — the same reason the collapse keys off
  // the base title.
  name: [{ title: "asc" }, { id: "desc" }],
};

function optionStrings(options: unknown): string[] {
  if (!Array.isArray(options)) return [];
  return options.filter(
    (option): option is string =>
      typeof option === "string" && option.trim().length > 0,
  );
}

/**
 * Variant teaser chips from SELECT/SWATCH/SIZE customization fields:
 * SWATCH → "Colours +N", SIZE → "Sizes S/M/L" (first 3 option initials),
 * SELECT → "<label> +N".
 */
function buildVariantChips(
  fields: { label: string; type: string; options: unknown }[],
): string[] {
  const chips: string[] = [];
  for (const field of fields) {
    const options = optionStrings(field.options);
    if (options.length === 0) continue;
    if (field.type === "SWATCH") {
      chips.push(`Colours +${options.length}`);
    } else if (field.type === "SIZE") {
      const initials = options
        .slice(0, 3)
        .map((option) => option.trim().charAt(0).toUpperCase())
        .join("/");
      chips.push(`Sizes ${initials}`);
    } else if (field.type === "SELECT") {
      chips.push(`${field.label} +${options.length}`);
    }
  }
  return chips;
}

function toImage(
  image: { url: string; alt: string; role?: ProductImageRole | null } | undefined,
): ShopProductImage | null {
  return image
    ? { url: image.url, alt: image.alt, role: image.role ?? null }
    : null;
}

/**
 * Row select shared by the paged fetch, the wishlist slug fetch and — since
 * workstream E step 7 — `large-format.ts`. A consumer may bring its own
 * where/orderBy/take; a select of its own is the duplicate this export
 * removed.
 */
export const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  displayName: true,
  shortTagline: true,
  translations: true,
  priceMin: true,
  priceMax: true,
  showPrice: true,
  // `tier` is the owner-sheet IMPORT tier (where a row came from);
  // `sizeTier` is the three-tier architecture (what the piece is).
  tier: true,
  sizeTier: true,
  inStock: true,
  featured: true,
  // D21: owner-typed free text for the mono card meta line, the card-hover
  // clip and the demo mark — none of these were on the card row before.
  materials: true,
  dimensions: true,
  // The lead time, for the MEMORY card variant (step 8). An owner-typed
  // string, same class as materials/dimensions and localized the same way:
  // not at all. It renders beside a translated label, never inside a
  // translated sentence.
  timeline: true,
  videoUrl: true,
  isDemo: true,
  category: { select: { name: true, translations: true } },
  images: {
    select: { url: true, alt: true, role: true },
    orderBy: { order: "asc" },
    take: 2,
  },
  customFields: {
    where: { type: { in: ["SELECT", "SWATCH", "SIZE"] } },
    orderBy: { order: "asc" },
    select: { label: true, type: true, options: true },
  },
} satisfies Prisma.ProductSelect;

export type CardRow = Prisma.ProductGetPayload<{ select: typeof CARD_SELECT }>;

export function toShopProductItem(
  row: CardRow,
  locale: string,
  duplicateCount?: number,
): ShopProductItem {
  // Localize only the card-visible prose; a missing translation falls back to
  // the English base (see `localize`). No-op when locale is the default.
  const product = localize(row, locale, [
    "title",
    "displayName",
    "shortTagline",
  ]);
  const category = localize(row.category, locale, ["name"]);
  return {
    id: row.id,
    slug: row.slug,
    title: product.title,
    displayTitle: editorialName(product.displayName, product.title),
    shortTagline: product.shortTagline,
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    showPrice: row.showPrice,
    categoryName: category.name,
    image: toImage(row.images[0]),
    hoverImage: toImage(row.images[1]),
    variantChips: buildVariantChips(row.customFields),
    tier: row.tier,
    sizeTier: row.sizeTier,
    inStock: row.inStock,
    featured: row.featured,
    // Only carried when the title genuinely belongs to a duplicate group —
    // absent on unique titles so the card chip never renders there (M-S4).
    ...(duplicateCount != null && duplicateCount > 1 ? { duplicateCount } : {}),
    materials: row.materials?.trim() || null,
    dimensions: row.dimensions?.trim() || null,
    timeline: row.timeline?.trim() || null,
    videoUrl: row.videoUrl?.trim() || null,
    isDemo: row.isDemo,
  };
}

/**
 * Resolve a visitor-supplied `?after=` search param to a safe cursor id
 * for {@link fetchProductsPage}: the id must exist AND match `where` —
 * an unknown cursor row makes Prisma return an empty page (older versions
 * throw), and a row outside the filter set would misplace the page.
 * Anything else — unknown, stale, deleted, unpublished, filter-mismatched,
 * or over-long — degrades to `undefined`, i.e. page 1.
 */
export async function resolveAfterCursor(
  after: string | undefined,
  where: Prisma.ProductWhereInput,
): Promise<string | undefined> {
  const id = after?.trim();
  if (!id || id.length > 64) return undefined;
  const row = await db.product.findFirst({
    where: { AND: [where, { id }] },
    select: { id: true },
  });
  return row?.id;
}

/**
 * Same-title display collapse (M-S4): pages over-fetch this many extra rows
 * so that dropping in-page title repeats still fills the requested size.
 * Sized against the real data — 34 duplicate groups across 4,373 published
 * rows, so more than a few collisions inside one page is rare.
 */
const COLLAPSE_OVERFETCH = 8;

/**
 * The M-S4 display collapse, shared verbatim by the cursor path and the
 * offset path: within ONE response, keep only the first row per exact title
 * (case-sensitive, raw DB title — localization happens after). The first row
 * is always kept, so a non-empty fetch can never collapse to an empty page.
 * Extracted so the two paging paths cannot drift on the one rule that decides
 * which rows a response drops.
 */
function collapseByTitle(rows: CardRow[]): CardRow[] {
  const seenTitles = new Set<string>();
  const kept: CardRow[] = [];
  for (const row of rows) {
    if (seenTitles.has(row.title)) continue;
    seenTitles.add(row.title);
    kept.push(row);
  }
  return kept;
}

/**
 * Cursor-paginated (id cursor) catalog page, plus the full result count for
 * the same where-clause so the UI can show "N pieces".
 *
 * Same-title collapse (M-S4, display level only — no rows are merged or
 * destroyed): within ONE response, a row whose exact title already appeared
 * earlier in that response is dropped, and every returned row belonging to a
 * duplicate group carries `duplicateCount` so the card can advertise the
 * group ("N options"). To keep pages full the fetch over-reads by
 * {@link COLLAPSE_OVERFETCH} (+1 to learn whether more rows exist) and trims
 * back to `take` after collapsing. `nextCursor` is always the id of the last
 * row actually RETURNED — a row that exists and matches `where`, exactly what
 * {@link resolveAfterCursor} requires — so a resume re-fetches everything
 * after it and no row is ever skipped by the trim; collapse then re-applies
 * per response (a group spanning a page boundary may render once per page,
 * which is the accepted cost of keeping cursor semantics untouched).
 */
export async function fetchProductsPage({
  where,
  sort,
  cursor,
  take = 24,
  locale,
  withTotal = true,
}: {
  where: Prisma.ProductWhereInput;
  sort: SortKey;
  /**
   * Id of the last already-seen row — the page starts strictly AFTER it
   * (Prisma `cursor` + `skip: 1`). Callers must pass an id that exists and
   * matches `where`: an unknown id yields an empty page (or a throw,
   * depending on Prisma version) instead of page 1, so server pages guard
   * `?after=` through {@link resolveAfterCursor} before passing it here.
   */
  cursor?: string;
  take?: number;
  /** Active locale — card title/tagline + category name resolve to it. */
  locale: string;
  /**
   * Pass `false` to skip the `count(*)` query and get `total: -1` — for
   * callers that only consume items + nextCursor (the infinite-scroll
   * load-more action). With a text filter the count is a full trigram/ILIKE
   * scan, so re-running it per 12-item batch was pure waste (M-P2). SSR
   * entry pages (including `?after=` resumes) keep the default `true`.
   */
  withTotal?: boolean;
}): Promise<ShopPage> {
  const fetchTake = take + COLLAPSE_OVERFETCH + 1;
  const [rows, total, duplicateTitleCounts] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: ORDER_BY[sort],
      take: fetchTake,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: CARD_SELECT,
    }),
    withTotal ? db.product.count({ where }) : Promise.resolve(-1),
    // The demo gate travels inside `where`; an absent `isDemo: false` means
    // the caller is showing fixtures, and the duplicate map must match.
    fetchDuplicateTitleCounts(where.isDemo !== false),
  ]);

  // A full fetch window means the DB may hold rows beyond it.
  const fetchedMore = rows.length === fetchTake;

  const keptRows = collapseByTitle(rows);

  const pageRows = keptRows.slice(0, take);
  // More content exists when the collapse kept more than fits this page, or
  // the fetch window itself was full (rows beyond it — even if every kept row
  // fit). Either way the next page resumes AFTER the last returned row, so
  // trimmed/unfetched rows are re-fetched, never skipped.
  const hasMore = keptRows.length > take || fetchedMore;
  const items = pageRows.map((row) =>
    toShopProductItem(row, locale, duplicateTitleCounts[row.title]),
  );

  return {
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1].id : null,
    total,
  };
}

/* ————————————————— offset paging (§7.7's numbered pager) ————————————————— */

/** Cards per shop page — the numbered pager and `Load more` share it. */
export const SHOP_PAGE_SIZE = 24;

/**
 * Ceiling on `?page=`. 4,373 published rows at 24 a page is 183 pages, so
 * this is far beyond any real view; it exists so a hand-edited URL cannot ask
 * Postgres for `OFFSET 1000000000`. Anything past the real last page is
 * clamped to it by {@link fetchProductsPageAt} anyway.
 */
const MAX_SHOP_PAGE = 1000;

/** A `?page=` value coerced to a usable 1-based page number. */
export function parseShopPage(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, MAX_SHOP_PAGE);
}

export type ShopOffsetPage = ShopPage & {
  /** 1-based page actually served — the request clamped into range. */
  page: number;
  /** `ceil(total / take)`, never below 1. */
  totalPages: number;
};

/**
 * Offset-paginated catalog page — REDESIGN.md §7.7 ("Numbered, mono, with
 * prev/next … Never infinite scroll"). The sibling of
 * {@link fetchProductsPage}, not a replacement: the cursor path and every one
 * of its callers are untouched, and both share `buildProductWhere`,
 * `ORDER_BY`, `CARD_SELECT`, {@link collapseByTitle} and
 * {@link fetchDuplicateTitleCounts}, so "the same where, the same orderBy,
 * the same results in the same order" is structural rather than a promise.
 *
 * The one deliberate difference is the shape of the window. The cursor path
 * over-reads by {@link COLLAPSE_OVERFETCH} and trims back to `take` so every
 * cursor response is exactly full; a numbered page cannot do that, because
 * pages that each swallow a few extra rows would overlap each other and
 * `ceil(total / take)` would stop being the number of pages. So page N is
 * exactly rows `[(N-1)·take, N·take)` of the shared ordering, with the same
 * in-page title collapse applied to that exact window. Every row therefore
 * belongs to exactly one page — nothing is skipped and nothing is repeated —
 * at the cost that a page holding two identically-titled pieces renders 23
 * cards instead of 24. That is the collapse doing its job, and it is the only
 * way the two paths can disagree.
 *
 * `nextCursor` is the id of the last RAW row in the window (which may be a
 * row the collapse dropped), so `Load more` from a numbered page resumes
 * exactly at the next page's first row.
 */
export async function fetchProductsPageAt({
  where,
  sort,
  page,
  take = SHOP_PAGE_SIZE,
  locale,
}: {
  where: Prisma.ProductWhereInput;
  sort: SortKey;
  /** 1-based page number; clamped to `[1, totalPages]`. */
  page: number;
  take?: number;
  /** Active locale — card title/tagline + category name resolve to it. */
  locale: string;
}): Promise<ShopOffsetPage> {
  const requested = Math.min(Math.max(Math.floor(page) || 1, 1), MAX_SHOP_PAGE);

  // The count is not optional here the way it is on a cursor page: the pager
  // needs `totalPages`, and a bookmarked `?page=999` has to land somewhere
  // real rather than on an empty grid.
  const [total, duplicateTitleCounts] = await Promise.all([
    db.product.count({ where }),
    // The demo gate travels inside `where`; an absent `isDemo: false` means
    // the caller is showing fixtures, and the duplicate map must match.
    fetchDuplicateTitleCounts(where.isDemo !== false),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / take));
  const current = Math.min(requested, totalPages);
  const skip = (current - 1) * take;

  const rows =
    total === 0
      ? []
      : await db.product.findMany({
          where,
          orderBy: ORDER_BY[sort],
          skip,
          // +1 only answers "is there a page after this one" — it is never
          // rendered, so it cannot leak into this page's collapse window.
          take: take + 1,
          select: CARD_SELECT,
        });

  const windowRows = rows.slice(0, take);
  const items = collapseByTitle(windowRows).map((row) =>
    toShopProductItem(row, locale, duplicateTitleCounts[row.title]),
  );
  const lastRow = windowRows.at(-1);

  return {
    items,
    nextCursor: rows.length > take && lastRow ? lastRow.id : null,
    total,
    page: current,
    totalPages,
  };
}

/* ————————————————— cached default /shop entry (M-P5) ————————————————— */

/**
 * Cache tag for the unfiltered /shop first-page bundle below. Revalidated by
 * both the category mutation actions (src/actions/categories.ts) and the
 * product mutation actions (src/actions/products.ts), which call
 * `revalidateTag(SHOP_FIRST_PAGE_TAG, "max")` on product create/update/delete
 * so catalog edits reach the cached entry page within a request instead of
 * the 300s TTL.
 */
export const SHOP_FIRST_PAGE_TAG = "shop-first-page";

/** One collection chip on the /shop index. */
export type ShopCategoryOption = {
  slug: string;
  name: string;
  count: number;
};

/**
 * Category chip data for the /shop index: every category holding at least
 * one published product, in curated order, with unfiltered published counts.
 * ONE grouped count joined in JS (no per-category `_count` N+1).
 */
export async function fetchShopCategoryOptions(
  locale: string,
): Promise<ShopCategoryOption[]> {
  const [categories, counts] = await Promise.all([
    db.category.findMany({
      where: { visible: true },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, name: true, translations: true },
    }),
    db.product.groupBy({
      by: ["categoryId"],
      where: buildProductWhere({}),
      _count: { _all: true },
    }),
  ]);
  const countByCategoryId = new Map(
    counts.map((row) => [row.categoryId, row._count._all]),
  );
  // Empty shelves stay out of the index — a chip that filters down to
  // nothing is noise, not luxury.
  return categories
    .map((category) => ({
      slug: category.slug,
      name: localize(category, locale, ["name"]).name,
      count: countByCategoryId.get(category.id) ?? 0,
    }))
    .filter((category) => category.count > 0);
}

export type DefaultShopFirstPage = {
  page: ShopOffsetPage;
  categories: ShopCategoryOption[];
};

/**
 * The per-visitor-identical /shop entry bundle — unfiltered first page
 * (cards + total) plus the collection chip index — cached for 300s per
 * (locale, sort) and tag-invalidated on category/product mutations (M-P5).
 * Only the DEFAULT entry (no q/type/category/occasion/band/stock/sizeTier/after) may
 * read this; any filtered, searched, or cursor-resumed request keeps hitting
 * the DB directly. Pure DB reads only — nothing here may touch per-request
 * APIs (cookies/headers), which `unstable_cache` cannot close over.
 *
 * Page 1 comes from {@link fetchProductsPageAt}, not the cursor path: /shop
 * and /shop?page=2 have to be page 1 and page 2 of ONE sequence, and only the
 * exact-window path guarantees that (see the note there on why a cursor
 * response's over-read would let page 1 and page 2 share rows). Same where,
 * same orderBy, same collapse — only the window shape differs.
 */
export const fetchDefaultShopFirstPage = unstable_cache(
  // `showDemo` is part of the cache key on purpose: the owner's demo switch
  // must not serve a bundle computed under the other setting.
  async (
    locale: string,
    sort: SortKey,
    showDemo: boolean,
  ): Promise<DefaultShopFirstPage> => {
    const [page, categories] = await Promise.all([
      fetchProductsPageAt({
        // The DEFAULT view, so it carries the default ecosystem. This is the
        // one query the page reaches without passing its resolved filters —
        // leaving it as `buildProductWhere({})` is what made `/shop` keep
        // serving the mixed catalogue after `?type=` gained a default.
        where: buildProductWhere(
          { type: DEFAULT_ECOSYSTEM },
          demoClause(showDemo),
        ),
        sort,
        page: 1,
        locale,
      }),
      fetchShopCategoryOptions(locale),
    ]);
    return { page, categories };
  },
  // Key bumped to -v2 with the move to the offset path: the cached VALUE
  // gained `page`/`totalPages`, and an entry written by the previous shape
  // would leave the pager without a page count for up to the 300s TTL.
  //
  // -v3: the value now holds the ART ecosystem rather than every product. A
  // -v2 entry would serve the mixed catalogue — molds, pigments and filament
  // on the shop's front door — for up to 300s after deploy.
  ["shop-default-first-page-v3"],
  { revalidate: 300, tags: [SHOP_FIRST_PAGE_TAG] },
);

/* ————————————————— duplicate-title map (M-S4) ————————————————— */

/**
 * Published titles appearing on MORE THAN ONE product, as
 * `title → published count` (~34 groups over 4,373 published rows — one
 * groupBy with HAVING count > 1). Raw DB titles (exact, case-sensitive),
 * matching the collapse in {@link fetchProductsPage}; keys must stay the
 * un-localized base title. Backs the display-level M-S4 fix: in-page
 * collapse + "N options" card chips + the PDP's same-title sibling rail —
 * no data is merged, destroyed, or re-slugged.
 *
 * A plain Record (not a Map): `unstable_cache` JSON-serializes the value.
 * 24h TTL; tagged with {@link SHOP_FIRST_PAGE_TAG} so the product/category
 * mutation actions that already revalidate the shop entry bundle refresh
 * this map in the same breath (title edits change groups).
 */
export const fetchDuplicateTitleCounts = unstable_cache(
  async (showDemo: boolean): Promise<Record<string, number>> => {
    const groups = await db.product.groupBy({
      by: ["title"],
      where: buildProductWhere({}, demoClause(showDemo)),
      _count: { _all: true },
      having: { title: { _count: { gt: 1 } } },
    });
    return Object.fromEntries(
      groups.map((group) => [group.title, group._count._all]),
    );
  },
  ["duplicate-title-counts"],
  { revalidate: 86400, tags: [SHOP_FIRST_PAGE_TAG] },
);

/**
 * Published card items for a wishlist's saved slugs, returned in the given
 * slug order (unpublished/unknown slugs are simply absent). Caller caps the
 * list — this trusts at most the first 48 entries.
 */
export async function fetchProductsBySlugs(
  slugs: string[],
  locale: string,
  demo: DemoClause = NO_DEMO,
): Promise<ShopProductItem[]> {
  const capped = [...new Set(slugs)].slice(0, 48);
  if (capped.length === 0) return [];

  const rows = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      ...demo,
      slug: { in: capped },
    },
    select: CARD_SELECT,
  });

  const bySlug = new Map(
    rows.map((row) => [row.slug, toShopProductItem(row, locale)]),
  );
  return capped.flatMap((slug) => bySlug.get(slug) ?? []);
}
