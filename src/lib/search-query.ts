import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { groupForTier } from "@/lib/catalog-taxonomy";
import { localize, localizeName } from "@/lib/localize";
import { editorialName } from "@/lib/product-name";
import { expandQueryTerms } from "@/lib/search-synonyms";
import { NO_DEMO, type DemoClause } from "@/lib/demo-clause";

/**
 * The site's one search query layer — REDESIGN.md §5.6 and §11.
 *
 * These functions were the /search page's private helpers. The overlay needs
 * the SAME ranking (a visitor who types "geode" into the overlay and the
 * visitor who lands on /search?q=geode are looking at one catalogue), so they
 * moved here verbatim rather than being written a second time. The page and
 * the overlay's server action are now two presentations of one result set;
 * the only thing either surface chooses is how many rows it takes and whether
 * it pays for the `count(*)`.
 *
 * Server-only (imports db). Client components may take TYPE-ONLY imports from
 * here — the same contract src/lib/shop.ts carries.
 */

/** Minimum characters before we hit the database (§5.6: from the 2nd char). */
export const MIN_QUERY = 2;

/**
 * Cap every inbound query at the shop action's own 120-char bound — an
 * unbounded q hammers Neon through the ILIKE scans (ENG-807).
 */
export const MAX_QUERY = 120;

/** Product cards shown on the /search page; the full set lives behind /shop?q=. */
export const PRODUCTS_TAKE = 24;

/** Journal / portfolio rows shown per section on the /search page. */
export const LIST_TAKE = 6;

/**
 * `total` sentinel for callers that opted out of the `count(*)` — the same
 * contract `ShopPage.total` carries (M-P2). The overlay never counts: with a
 * take of 5 the combined-OR scan would run on every debounced keystroke.
 */
export const TOTAL_NOT_COUNTED = -1;

/** PUBLISHED plus the caller's demo-content gate (see demo-clause.ts). */
function productBaseWhere(demo: DemoClause): Prisma.ProductWhereInput {
  return { status: "PUBLISHED", ...demo };
}

const PRODUCT_CARD_SELECT = {
  id: true,
  slug: true,
  displayName: true,
  title: true,
  shortTagline: true,
  priceMin: true,
  priceMax: true,
  showPrice: true,
  tier: true,
  inStock: true,
  featured: true,
  translations: true,
  category: { select: { name: true, translations: true } },
  images: {
    select: { url: true, alt: true },
    orderBy: { order: "asc" },
    take: 2,
  },
} satisfies Prisma.ProductSelect;

/** Opt out of the `count(*)` — see {@link TOTAL_NOT_COUNTED}. */
type CountOption = { withTotal?: boolean; demo?: DemoClause };

/**
 * Relevance-ish product search: title matches rank ahead of tagline/
 * description matches. Two trigram-indexed ILIKE queries (see migration
 * 20260814050000_search_trgm), deduped by id and concatenated title-first.
 * The section total is DERIVED from the fetched rows whenever neither
 * branch hit its cap (we then hold the complete union) — the standalone
 * combined-OR count, the page's most expensive scan, only runs as a
 * fallback when a branch overflowed (M-P3).
 */
export async function searchProducts(
  q: string,
  take: number = PRODUCTS_TAKE,
  { withTotal = true, demo = NO_DEMO }: CountOption = {},
) {
  const base = productBaseWhere(demo);
  // Gap 7: buyer vocabulary ("epoxy", "geode", "PLA") expands to studio
  // vocabulary before matching — both languages hit the same shelf.
  const terms = expandQueryTerms(q);
  const titleMatch = {
    OR: terms.map((term) => ({
      title: { contains: term, mode: "insensitive" as const },
    })),
  } satisfies Prisma.ProductWhereInput;
  const secondaryMatch = {
    OR: terms.flatMap((term) => [
      { shortTagline: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
    ]),
  } satisfies Prisma.ProductWhereInput;

  const [titleRows, secondaryRows] = await Promise.all([
    db.product.findMany({
      where: { ...base, ...titleMatch },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take,
      select: PRODUCT_CARD_SELECT,
    }),
    db.product.findMany({
      where: { ...base, ...secondaryMatch },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take,
      select: PRODUCT_CARD_SELECT,
    }),
  ]);

  const seen = new Set<string>();
  const merged = [...titleRows, ...secondaryRows].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  // Gap 7: ecosystem grouping — pieces before pigments before prints ("blue"
  // returns art before supplies). Stable sort keeps the title-first ranking
  // inside each group; tier↔group is 1:1 on the live catalog.
  const GROUP_RANK = { art: 0, supplies: 1, print: 2 } as const;
  merged.sort(
    (a, b) =>
      GROUP_RANK[groupForTier(a.tier)] - GROUP_RANK[groupForTier(b.tier)],
  );

  const capped = titleRows.length === take || secondaryRows.length === take;
  const total = !withTotal
    ? TOTAL_NOT_COUNTED
    : capped
      ? await db.product.count({
          where: {
            ...base,
            OR: [titleMatch, ...secondaryMatch.OR],
          },
        })
      : merged.length;

  return { rows: merged.slice(0, take), total };
}

export async function searchPosts(
  q: string,
  take: number = LIST_TAKE,
  { withTotal = true, demo = NO_DEMO }: CountOption = {},
) {
  const where: Prisma.BlogPostWhereInput = {
    status: "PUBLISHED",
    ...demo,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { excerpt: { contains: q, mode: "insensitive" } },
    ],
  };
  const rows = await db.blogPost.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      translations: true,
      // §5.6's journal result is "image + title + category"; the /search page
      // renders neither and simply ignores both columns. Two extra columns on
      // ≤6 rows is cheaper than maintaining a second query for one surface.
      coverImage: true,
      blogCategory: { select: { name: true, translations: true } },
    },
  });
  // Under the cap the fetched rows ARE the full result set — only run the
  // count when the section overflowed (M-P3 fan-out trim).
  const total = !withTotal
    ? TOTAL_NOT_COUNTED
    : rows.length < take
      ? rows.length
      : await db.blogPost.count({ where });
  return { rows, total };
}

export async function searchPortfolios(
  q: string,
  take: number = LIST_TAKE,
  { withTotal = true, demo = NO_DEMO }: CountOption = {},
) {
  const where: Prisma.PortfolioWhereInput = {
    status: "PUBLISHED",
    ...demo,
    OR: [
      { title: { contains: q, mode: "insensitive" } },
      { story: { contains: q, mode: "insensitive" } },
    ],
  };
  const rows = await db.portfolio.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      slug: true,
      title: true,
      story: true,
      translations: true,
      // §5.6's portfolio result is "image + project name". The case-study
      // hero is the after shot; the gallery's first frame is the fallback.
      afterImageUrl: true,
      images: {
        select: { url: true, alt: true },
        orderBy: { order: "asc" },
        take: 1,
      },
    },
  });
  // Same complete-set derivation as searchPosts — count only on overflow.
  const total = !withTotal
    ? TOTAL_NOT_COUNTED
    : rows.length < take
      ? rows.length
      : await db.portfolio.count({ where });
  return { rows, total };
}

/**
 * Collections — §5.6's third group, and the one the /search page never had.
 * A category only counts as a result when it has something published behind
 * it: a doorway into an empty shelf is worse than no doorway.
 */
export async function searchCategories(
  q: string,
  take: number = LIST_TAKE,
  demo: DemoClause = NO_DEMO,
) {
  const base = productBaseWhere(demo);
  const terms = expandQueryTerms(q);
  const where = {
    OR: terms.flatMap((term) => [
      { name: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
    ]),
    visible: true,
    products: { some: base },
  } satisfies Prisma.CategoryWhereInput;

  const rows = await db.category.findMany({
    where,
    orderBy: { order: "asc" },
    take,
    select: {
      id: true,
      slug: true,
      name: true,
      translations: true,
      _count: { select: { products: { where: base } } },
    },
  });
  return { rows };
}

/* ————————————————— serialisable hits for the overlay ————————————————— */

export type SearchHitImage = { url: string; alt: string };

export type ProductHit = {
  id: string;
  slug: string;
  /** Full catalogue title — the link's accessible name (Part 17). */
  title: string;
  /** Editorial short name for the visible row. */
  displayTitle: string;
  priceMin: number | null;
  priceMax: number | null;
  showPrice: boolean;
  image: SearchHitImage | null;
};

export type CollectionHit = {
  id: string;
  slug: string;
  name: string;
  /** Published pieces behind the doorway. */
  count: number;
};

export type PortfolioHit = {
  id: string;
  slug: string;
  title: string;
  image: SearchHitImage | null;
};

export type JournalHit = {
  id: string;
  slug: string;
  title: string;
  /** Blog category name, or null when the post is uncategorised. */
  category: string | null;
  image: SearchHitImage | null;
};

/** The overlay's four groups, in §5.6's order. */
export type SearchResults = {
  /** Echo of the query these hits answer — the client drops stale replies. */
  query: string;
  products: ProductHit[];
  collections: CollectionHit[];
  portfolio: PortfolioHit[];
  journal: JournalHit[];
  /** Hits actually returned across the four groups (capped, not a total). */
  count: number;
};

export const EMPTY_RESULTS: SearchResults = {
  query: "",
  products: [],
  collections: [],
  portfolio: [],
  journal: [],
  count: 0,
};

type ProductRow = Awaited<ReturnType<typeof searchProducts>>["rows"][number];
type PostRow = Awaited<ReturnType<typeof searchPosts>>["rows"][number];
type PortfolioRow = Awaited<
  ReturnType<typeof searchPortfolios>
>["rows"][number];
type CategoryRow = Awaited<ReturnType<typeof searchCategories>>["rows"][number];

/** A stored URL we cannot render is the same as no image — never a broken frame. */
function hitImage(
  url: string | null | undefined,
  alt: string | null | undefined,
  fallbackAlt: string,
): SearchHitImage | null {
  if (!url || !(url.startsWith("/") || url.startsWith("http"))) return null;
  return { url, alt: alt?.trim() || fallbackAlt };
}

export function toProductHit(row: ProductRow, locale: string): ProductHit {
  const lp = localize(row, locale, ["title", "displayName"]);
  return {
    id: row.id,
    slug: row.slug,
    title: lp.title,
    displayTitle: editorialName(lp.displayName, lp.title),
    priceMin: row.priceMin,
    priceMax: row.priceMax,
    showPrice: row.showPrice,
    image: hitImage(row.images[0]?.url, row.images[0]?.alt, lp.title),
  };
}

export function toCollectionHit(
  row: CategoryRow,
  locale: string,
): CollectionHit {
  return {
    id: row.id,
    slug: row.slug,
    name: localize(row, locale, ["name"]).name,
    count: row._count.products,
  };
}

export function toPortfolioHit(
  row: PortfolioRow,
  locale: string,
): PortfolioHit {
  const lp = localize(row, locale, ["title"]);
  return {
    id: row.id,
    slug: row.slug,
    title: lp.title,
    image:
      hitImage(row.afterImageUrl, null, lp.title) ??
      hitImage(row.images[0]?.url, row.images[0]?.alt, lp.title),
  };
}

export function toJournalHit(row: PostRow, locale: string): JournalHit {
  const lp = localize(row, locale, ["title"]);
  return {
    id: row.id,
    slug: row.slug,
    title: lp.title,
    category: row.blogCategory ? localizeName(row.blogCategory, locale) : null,
    image: hitImage(row.coverImage, null, lp.title),
  };
}
