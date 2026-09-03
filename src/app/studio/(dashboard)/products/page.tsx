import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import { WebsiteSheetButton } from "@/components/studio/products/website-sheet-button";
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    tier?: string;
    stock?: string;
    page?: string;
  }>;
}) {
  const { q, status, category, tier, stock, page } = await searchParams;

  // One validated filter shape drives the where clause here AND the bulk
  // actions' select-all-matching path (audit L-AD1) — see product-filter.ts.
  const filter = parseProductListFilter({ q, status, category, tier, stock });
  const statusTab = filter.status ?? "PUBLISHED";
  const where = buildProductWhere(filter);

  // Live per-status counts for the tabs (audit M-A1) — one groupBy over the
  // non-status filters replaces the old bare count and feeds the tab badges.
  const statusGroups = await db.product.groupBy({
    by: ["status"],
    where: buildProductWhere({ ...filter, status: "ALL" }),
    _count: { _all: true },
  });
  const publishedCount =
    statusGroups.find((g) => g.status === "PUBLISHED")?._count._all ?? 0;
  const draftCount =
    statusGroups.find((g) => g.status === "DRAFT")?._count._all ?? 0;
  const allCount = publishedCount + draftCount;

  // Server pagination (ENG-805 pattern, same as inquiries/activity): the
  // four-tier import put 4,000+ rows in this table — count → clamp a stale
  // ?page= → skip/take, and a `select` scoped to the row shape instead of
  // hydrating every scalar (description/careNotes/translations are heavy).
  const total =
    statusTab === "ALL"
      ? allCount
      : statusTab === "DRAFT"
        ? draftCount
        : publishedCount;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNum = Math.min(
    Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
    pageCount,
  );

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        priceMin: true,
        priceMax: true,
        status: true,
        isDemo: true,
        featured: true,
        needsRewrite: true,
        tier: true,
        inStock: true,
        importSource: true,
        updatedAt: true,
        category: { select: { name: true } },
        images: {
          orderBy: { order: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    }),
    db.category.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: ProductRow[] = products.map((product) => {
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
      inStock: product.inStock,
      imported,
      // Sheet-demoted drafts (audit M-A1): a tiered sheet row sitting in DRAFT
      // was pushed out by the tier cap on the last import run — distinct from
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
  });

  return (
    <div>
      <PageHeader
        title="Products"
        description="Everything in the catalog — drafts stay invisible on the public site until published."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WebsiteSheetButton />
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
          DRAFT: draftCount,
          ALL: allCount,
        }}
        initialQuery={filter.q ?? ""}
        page={pageNum}
        pageCount={pageCount}
        total={total}
      />
    </div>
  );
}
