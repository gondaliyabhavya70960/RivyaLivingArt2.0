import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Prisma } from "@/generated/prisma/client";
import type { ContentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import { SuggestSizeTiersButton } from "@/components/studio/products/suggest-size-tiers-button";
import {
  ProductList,
  type ProductRow,
} from "@/components/studio/products/product-list";
import {
  buildProductWhere,
  parseProductListFilter,
} from "@/components/studio/products/product-filter";

export const metadata: Metadata = { title: "Products" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

/** Rows per page. Local constant — importing it from the "use client"
 *  pagination module turns it into a client-reference proxy in the RSC
 *  graph and Prisma throws on `take` (audit C4). Keep in sync with
 *  src/components/studio/pagination.tsx PAGE_SIZE. */
const PAGE_SIZE = 50;

/** Rows per Kanban lane (board shows the most recently updated slice of each
 *  status; the lane headers carry the TRUE counts, same as the tabs). */
const LANE_CAP = 30;

/** The row shape both views read — one select, one mapping, no drift. */
const rowSelect = {
  id: true,
  title: true,
  priceMin: true,
  priceMax: true,
  status: true,
  isDemo: true,
  featured: true,
  needsRewrite: true,
  tier: true,
  sizeTier: true,
  inStock: true,
  importSource: true,
  updatedAt: true,
  category: { select: { name: true } },
  images: {
    orderBy: { order: "asc" },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductSelect;

type RowQueryProduct = Prisma.ProductGetPayload<{
  select: typeof rowSelect;
}>;

function toRow(product: RowQueryProduct): ProductRow {
  const imported = product.importSource?.startsWith("sheet:") ?? false;
  return {
    id: product.id,
    title: product.title,
    categoryName: product.category.name,
    priceMin: product.priceMin,
    priceMax: product.priceMax,
    status: product.status,
    isDemo: product.isDemo,
    featured: product.featured,
    needsRewrite: product.needsRewrite,
    tier: product.tier,
    sizeTier: product.sizeTier,
    inStock: product.inStock,
    imported,
    // Fill-demoted drafts (audit M-A1): a catalog-fill row sitting in DRAFT
    // was pushed out by its import list's cap on the last fill run — distinct from
    // intentional owner drafts. sheet:owner-ready rows import as drafts BY
    // DESIGN (published from the studio later), so they are excluded.
    demoted:
      product.status === "DRAFT" &&
      imported &&
      product.importSource !== "sheet:owner-ready" &&
      product.tier !== null,
    thumbnailUrl: product.images[0]?.url ?? null,
    updatedAt: dateFormatter.format(product.updatedAt),
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    tier?: string;
    sizeTier?: string;
    stock?: string;
    media?: string;
    // `rewrite` and `stale` were in the filter vocabulary and the where
    // builder from the day they were added, but NOT here — so the two
    // Overview cards that link with them opened the whole Published (or
    // Draft) tab instead of the rows they counted. That is the exact failure
    // `action-queue.ts`'s header says it exists to prevent, and it survived
    // because the test pins `parseProductListFilter` + `buildProductWhere`,
    // which are both correct; the gap was this page's own contract.
    rewrite?: string;
    stale?: string;
    demo?: string;
    page?: string;
    /** Table | Kanban — read by the list; the page serves both views' data
     *  either way, so the toggle is a render decision, not a refetch. */
    view?: string;
  }>;
}) {
  const {
    q,
    status,
    category,
    tier,
    sizeTier,
    stock,
    media,
    rewrite,
    stale,
    demo,
    page,
  } = await searchParams;

  // One validated filter shape drives the where clause here AND the bulk
  // actions' select-all-matching path (audit L-AD1) — see product-filter.ts.
  const filter = parseProductListFilter({
    q,
    status,
    category,
    tier,
    sizeTier,
    stock,
    media,
    rewrite,
    stale,
    demo,
  });
  const statusTab = filter.status ?? "PUBLISHED";
  const where = buildProductWhere(filter);

  // Live per-status counts for the tabs (audit M-A1) — one groupBy over the
  // non-status filters replaces the old bare count and feeds the tab badges.
  // The SAME counts head the Kanban lanes: the board never lies about a
  // capped lane.
  const statusGroups = await db.product.groupBy({
    by: ["status"],
    where: buildProductWhere({ ...filter, status: "ALL" }),
    _count: { _all: true },
  });
  const publishedCount =
    statusGroups.find((g) => g.status === "PUBLISHED")?._count._all ?? 0;
  const reviewCount =
    statusGroups.find((g) => g.status === "REVIEW")?._count._all ?? 0;
  const draftCount =
    statusGroups.find((g) => g.status === "DRAFT")?._count._all ?? 0;
  const archivedCount =
    statusGroups.find((g) => g.status === "ARCHIVED")?._count._all ?? 0;
  const allCount = publishedCount + reviewCount + draftCount + archivedCount;

  // Server pagination (ENG-805 pattern, same as inquiries/activity): the
  // four-tier import put 4,000+ rows in this table — count → clamp a stale
  // ?page= → skip/take, and a `select` scoped to the row shape instead of
  // hydrating every scalar (description/careNotes/translations are heavy).
  const total =
    statusTab === "ALL"
      ? allCount
      : statusTab === "DRAFT"
        ? draftCount
        : statusTab === "REVIEW"
          ? reviewCount
          : statusTab === "ARCHIVED"
            ? archivedCount
            : publishedCount;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNum = Math.min(
    Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
    pageCount,
  );

  // The board's lanes: the most recently updated slice of EVERY status, under
  // the same non-status filters the table uses. The `status` param drives the
  // table's tab only — the board is by definition the all-status view, and
  // rendering it through a one-status clause would make three lanes read as
  // empty when they are not.
  const laneWhere = (status: ContentStatus): Prisma.ProductWhereInput =>
    buildProductWhere({ ...filter, status });

  const [
    products,
    categories,
    draftLane,
    reviewLane,
    publishedLane,
    archivedLane,
  ] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: rowSelect,
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    db.product.findMany({
      where: laneWhere("DRAFT"),
      orderBy: { updatedAt: "desc" },
      take: LANE_CAP,
      select: rowSelect,
    }),
    db.product.findMany({
      where: laneWhere("REVIEW"),
      orderBy: { updatedAt: "desc" },
      take: LANE_CAP,
      select: rowSelect,
    }),
    db.product.findMany({
      where: laneWhere("PUBLISHED"),
      orderBy: { updatedAt: "desc" },
      take: LANE_CAP,
      select: rowSelect,
    }),
    db.product.findMany({
      where: laneWhere("ARCHIVED"),
      orderBy: { updatedAt: "desc" },
      take: LANE_CAP,
      select: rowSelect,
    }),
  ]);

  const rows: ProductRow[] = products.map(toRow);
  const kanbanLanes: Record<ContentStatus, ProductRow[]> = {
    DRAFT: draftLane.map(toRow),
    REVIEW: reviewLane.map(toRow),
    PUBLISHED: publishedLane.map(toRow),
    ARCHIVED: archivedLane.map(toRow),
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything in the catalog — drafts stay invisible on the public site until published."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SuggestSizeTiersButton />
            <Button asChild>
              <Link href="/studio/products/new">
                <Plus /> Add product
              </Link>
            </Button>
          </div>
        }
      />
      <ProductList
        products={rows}
        categories={categories}
        filter={filter}
        statusTab={statusTab}
        statusCounts={{
          PUBLISHED: publishedCount,
          REVIEW: reviewCount,
          DRAFT: draftCount,
          ARCHIVED: archivedCount,
          ALL: allCount,
        }}
        initialQuery={filter.q ?? ""}
        page={pageNum}
        pageCount={pageCount}
        total={total}
        kanbanLanes={kanbanLanes}
        kanbanLaneCap={LANE_CAP}
      />
    </div>
  );
}
