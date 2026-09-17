"use client";

import { useMemo, useState } from "react";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Star } from "lucide-react";
import { toast } from "sonner";
import type { ContentStatus, ProductSizeTier } from "@/generated/prisma/enums";
import {
  approveProducts,
  confirmProducts,
  deleteProducts,
  setProductsCategory,
  setProductsSizeTier,
  setProductsStatus,
  toggleFeatured,
  unconfirmProducts,
  type BulkProductTarget,
} from "@/actions/products";
import { formatPriceBand } from "@/lib/utils";
import { IMPORT_LISTS, importListLabel, importListOf } from "@/lib/import-list";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
  SIZE_TIER_NUMBER,
  SIZE_TIER_SHORT,
  sizeTierStudioLabel,
} from "@/lib/product-size-tier";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useSelection } from "@/hooks/use-selection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SavedViews } from "@/components/studio/saved-views";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ColumnsMenu } from "@/components/studio/columns-menu";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { ApproveProductsDialog } from "@/components/studio/products/approve-dialog";
import { describeApproval } from "@/lib/product-approve";
import { DemoBadge } from "@/components/studio/demo-badge";
import { EmptyState } from "@/components/studio/page-header";
import { Pagination, PAGE_SIZE } from "@/components/studio/pagination";
import { SortHead, useSort } from "@/components/studio/sort-header";
import type { ColumnDef } from "@/lib/column-visibility";
import type {
  ProductListFilter,
  ProductStatusTab,
} from "@/components/studio/products/product-filter";

export type ProductRow = {
  id: string;
  title: string;
  categoryName: string;
  priceMin: number | null;
  priceMax: number | null;
  status: ContentStatus;
  isDemo: boolean;
  featured: boolean;
  needsRewrite: boolean;
  /** Import list (1-4) — `Product.tier`, which committed CSV the row came
   *  from — or null for studio-made products. Not the product tier. */
  tier: number | null;
  /** The product tier. Null is the backlog this list has to surface. */
  sizeTier: ProductSizeTier | null;
  inStock: boolean;
  /** True when the row is fed by the catalog fill (an import-list CSV). */
  imported: boolean;
  /** A catalog-fill draft pushed out by its import list's cap — not an
   *  intentional owner draft. */
  demoted: boolean;
  thumbnailUrl: string | null;
  /** Pre-formatted on the server to keep hydration deterministic. */
  updatedAt: string;
};

const STATUS_TABS: { value: ProductStatusTab; label: string }[] = [
  { value: "PUBLISHED", label: "Published" },
  { value: "REVIEW", label: "Review" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "ALL", label: "All" },
];

/** Row status chip — one tone/label per `ContentStatus` value. */
const STATUS_BADGE_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "secondary" | "outline"
> = {
  PUBLISHED: "success",
  REVIEW: "warning",
  DRAFT: "secondary",
  ARCHIVED: "outline",
};
const STATUS_BADGE_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Published",
  REVIEW: "Review",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "category", label: "Category" },
  { key: "price", label: "Price" },
  { key: "sizeTier", label: "Product tier" },
  // Label only — the KEY stays "tier" because saved views persist it. The
  // column is `Product.tier`, the import list a row came from; "tier" on a
  // Studio screen means the product tier, so the label does not use it.
  { key: "tier", label: "Import list" },
  { key: "stock", label: "Stock" },
  { key: "featured", label: "Featured" },
  { key: "updated", label: "Updated" },
];

/**
 * The import-list cell: "L1", with "· fill" on a row the catalog fill still
 * refreshes (it read "T1 · sheet" until 2026-09-17).
 *
 * "L1", NOT `IMPORT_LIST_SHORT`. The width note on the table header is
 * measured — the margin at 1440 is eight pixels — and "Resin goods" in this
 * mono cell would spend it. Same footprint as the "T1" it replaces; the
 * list's full name is the title, one hover away.
 */
function ImportListCell({
  tier,
  imported,
}: {
  tier: number | null;
  imported: boolean;
}) {
  const list = importListOf(tier);
  if (!list) return <span aria-hidden>—</span>;
  return (
    <Badge
      variant="outline"
      title={`${importListLabel(list)}${
        imported ? " · refreshed by the catalog fill" : ""
      }`}
    >
      L{list}
      {imported ? " · fill" : ""}
    </Badge>
  );
}

/** Sticky right actions column wherever the table scrolls horizontally — i.e.
 *  below `xl`, which is exactly where the wrapper keeps `overflow-x: auto`.
 *  The row stays reachable while the rest of the table slides under it, and
 *  the e2 shadow is the "more content behind me" affordance. */
const STICKY_ACTIONS_CELL =
  "max-xl:sticky max-xl:end-0 max-xl:bg-card max-xl:shadow-e2";

export function ProductList({
  products,
  categories,
  filter,
  statusTab,
  statusCounts,
  initialQuery,
  page,
  pageCount,
  total,
}: {
  products: ProductRow[];
  categories: { id: string; name: string }[];
  /** The server-validated filter currently applied — echoed back verbatim by
   *  "select all matching" bulk actions so the server rebuilds the exact same
   *  where clause (audit L-AD1). */
  filter: ProductListFilter;
  statusTab: ProductStatusTab;
  statusCounts: Record<ProductStatusTab, number>;
  initialQuery: string;
  /** Server-driven pagination (the catalog is 4,000+ rows). */
  page: number;
  pageCount: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialQuery);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // Gmail pattern (audit L-AD1): true after "Select all N matching this
  // filter". Only effective while every row on the page is still ticked —
  // unticking any row drops straight back to page-scoped selection.
  const [allMatching, setAllMatching] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSizeTier, setBulkSizeTier] = useState("");

  // The current server page, sorted client-side (SortHead sorts what is
  // ON SCREEN — the catalog itself is server-paginated, so a "global" sort
  // would need a server-side order-by this list does not have).
  const {
    sorted,
    sort,
    toggle: toggleSort,
  } = useSort<ProductRow>(
    products,
    (row, key) => {
      switch (key) {
        case "title":
          return row.title;
        case "category":
          return row.categoryName;
        case "price":
          return row.priceMin;
        case "sizeTier":
          // Sorts on the owner's own 1-2-3 ordering, so LARGE leads and the
          // untiered backlog sorts together at one end rather than by the
          // alphabetical accident of LARGE_/MEDIUM_/SMALL_.
          return row.sizeTier ? SIZE_TIER_NUMBER[row.sizeTier] : null;
        case "tier":
          return row.tier;
        case "stock":
          return row.inStock;
        case "featured":
          return row.featured;
        case "updated":
          return row.updatedAt;
        default:
          return null;
      }
    },
    { key: "updated", dir: "desc" },
  );
  const pageRows = sorted;
  const rowIds = useMemo(() => pageRows.map((p) => p.id), [pageRows]);
  const selection = useSelection(rowIds);
  const columns = useColumnVisibility("products", PRODUCT_COLUMNS);

  const filterArmed = allMatching && selection.allSelected;
  /** The count every bulk action + confirmation actually applies to. */
  const effectiveCount = filterArmed ? total : selection.count;
  const bulkTarget: BulkProductTarget = filterArmed
    ? { filter }
    : selection.ids;

  const categoryFilter = searchParams.get("category") ?? "ALL";
  const tierFilter = searchParams.get("tier") ?? "ALL";
  const sizeTierFilter = searchParams.get("sizeTier") ?? "ALL";
  const stockFilter = searchParams.get("stock") ?? "ALL";
  const demoFilter = searchParams.get("demo") === "1";

  const formatCount = (n: number) => n.toLocaleString("en-IN");

  function updateParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    // Any filter change invalidates the current page number.
    if (!("page" in next)) params.delete("page");
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // A changed filter/page means "all matching" no longer describes what the
    // operator is looking at — never carry it across.
    setAllMatching(false);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearSelection() {
    selection.clear();
    setAllMatching(false);
  }

  async function handleConfirm() {
    setBusy(true);
    const result = await confirmProducts(bulkTarget);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { confirmed = 0, refused = [] } = result.data ?? {};
    if (confirmed > 0) {
      toast.success(
        `Confirmed ${formatCount(confirmed)} product${confirmed === 1 ? "" : "s"} for the final list.`,
      );
    }
    // Refusals are named, one toast each, capped — an operator who selected
    // 200 rows does not need 60 toasts, but "3 refused" with no names is a
    // dead end.
    for (const row of refused.slice(0, 4)) toast.warning(row.reason);
    if (refused.length > 4) {
      toast.warning(
        `${formatCount(refused.length - 4)} more could not be confirmed — filter by what they are missing.`,
      );
    }
    router.refresh();
  }

  async function handleApprove() {
    setBusy(true);
    const result = await approveProducts(bulkTarget);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setApproveOpen(false);
    const { success, holds } = describeApproval(
      result.data ?? {
        approved: 0,
        published: 0,
        untiered: 0,
        placeholder: 0,
        alreadyLive: 0,
        archived: 0,
      },
    );
    if (success) toast.success(success);
    // Every hold is named with its remedy — "skipped 12" with no reason is
    // the toast that sends an owner to look for a bug that is a guardrail.
    for (const hold of holds) toast.warning(hold);
    clearSelection();
    router.refresh();
  }

  async function handleUnconfirm() {
    setBusy(true);
    const result = await unconfirmProducts(bulkTarget);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { unconfirmed = 0 } = result.data ?? {};
    toast.success(
      `Removed ${formatCount(unconfirmed)} product${unconfirmed === 1 ? "" : "s"} from the final list.`,
    );
    router.refresh();
  }

  async function handleStatus(status: ContentStatus) {
    setBusy(true);
    const result = await setProductsStatus(bulkTarget, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const {
      updated = 0,
      skippedRewrite = 0,
      skippedUntiered = 0,
      skippedPlaceholder = 0,
    } = result.data ?? {};
    if (status === "PUBLISHED") {
      // All three reasons are named. "Skipped 12" with no reason is the toast
      // that sends an owner to look for a bug that is a guardrail.
      const skipped = [
        skippedRewrite > 0 &&
          `${formatCount(skippedRewrite)} that still need${skippedRewrite === 1 ? "s" : ""} a rewrite of scraped content`,
        skippedUntiered > 0 &&
          `${formatCount(skippedUntiered)} with no product tier set`,
        skippedPlaceholder > 0 &&
          `${formatCount(skippedPlaceholder)} still on a concept placeholder image instead of a photograph`,
      ].filter((line): line is string => typeof line === "string");
      if (skipped.length > 0) {
        toast.warning(
          `Published ${formatCount(updated)} product${updated === 1 ? "" : "s"}. Skipped ${skipped.join(", and ")}.`,
        );
      } else {
        toast.success(
          `Published ${formatCount(updated)} product${updated === 1 ? "" : "s"}.`,
        );
      }
    } else {
      toast.success(
        `Moved ${formatCount(updated)} product${updated === 1 ? "" : "s"} to ${STATUS_BADGE_LABEL[status].toLowerCase()}.`,
      );
    }
    clearSelection();
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const result = await deleteProducts(bulkTarget);
    setBusy(false);
    setDeleteOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const deleted = result.data?.deleted ?? 0;
    toast.success(
      `Deleted ${formatCount(deleted)} product${deleted === 1 ? "" : "s"}.`,
    );
    clearSelection();
    router.refresh();
  }

  async function handleCategory(categoryId: string) {
    setBulkCategory(categoryId);
    setBusy(true);
    const result = await setProductsCategory(bulkTarget, categoryId);
    setBusy(false);
    setBulkCategory("");

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const moved = result.data?.updated ?? 0;
    const categoryName =
      categories.find((c) => c.id === categoryId)?.name ?? "the new category";
    toast.success(
      `Moved ${formatCount(moved)} product${moved === 1 ? "" : "s"} to ${categoryName}.`,
    );
    clearSelection();
    router.refresh();
  }

  async function handleSizeTier(sizeTier: string) {
    setBulkSizeTier(sizeTier);
    setBusy(true);
    const result = await setProductsSizeTier(bulkTarget, sizeTier);
    setBusy(false);
    setBulkSizeTier("");

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const moved = result.data?.updated ?? 0;
    const name =
      SIZE_TIER_NAME[sizeTier as ProductSizeTier] ?? "the selected tier";
    toast.success(
      `Filed ${formatCount(moved)} product${moved === 1 ? "" : "s"} under ${name}.`,
    );
    clearSelection();
    router.refresh();
  }

  async function handleFeature(product: ProductRow) {
    const result = await toggleFeatured(product.id, !product.featured);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      product.featured
        ? `"${product.title}" removed from featured.`
        : `"${product.title}" is now featured.`,
    );
    router.refresh();
  }

  return (
    <div>
      {/* Status tabs with live counts (audit M-A1) — Published is the default
          view so the 3,500+ auto-demoted drafts never bury the live catalog. */}
      <div
        role="group"
        aria-label="Filter by status"
        className="mb-4 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 [scrollbar-width:none]"
      >
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                updateParams({
                  status: tab.value === "PUBLISHED" ? undefined : tab.value,
                })
              }
              className={
                active
                  ? "inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground/6 px-5 text-small font-medium text-foreground"
                  : "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-small text-graphite outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              }
            >
              {tab.label}
              <span
                className={
                  active
                    ? "u-num text-12 text-sapphire-ink"
                    : "u-num text-12 text-graphite"
                }
              >
                {formatCount(statusCounts[tab.value])}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {/* C2 saved filter views — per-device chips above the live filters. */}
      <SavedViews storageKey="rr-studio-product-views" />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: search.trim() || undefined });
          }}
        >
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-graphite"
          />
          <Input
            type="search"
            name="q"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-64 ps-10"
          />
        </form>

        <Select
          value={categoryFilter}
          onValueChange={(value) =>
            updateParams({ category: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sizeTierFilter}
          onValueChange={(value) =>
            updateParams({ sizeTier: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by product tier">
            <SelectValue placeholder="Product tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All product tiers</SelectItem>
            {/* The backlog, first in the list, because on a catalogue this
                column arrived after it is the answer for nearly every row. */}
            <SelectItem value="NONE">No tier yet</SelectItem>
            {PRODUCT_SIZE_TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {sizeTierStudioLabel(tier)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={tierFilter}
          onValueChange={(value) =>
            updateParams({ tier: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by import list">
            <SelectValue placeholder="Import list" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All import lists</SelectItem>
            {/* `?tier=1` stays the URL value — it is the column value and a
                contract; only the words come from import-list.ts. */}
            {IMPORT_LISTS.map((list) => (
              <SelectItem key={list} value={String(list)}>
                {importListLabel(list)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stockFilter}
          onValueChange={(value) =>
            updateParams({ stock: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by availability">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All availability</SelectItem>
            <SelectItem value="in">In stock</SelectItem>
            <SelectItem value="out">Out of stock</SelectItem>
          </SelectContent>
        </Select>

        <button
          type="button"
          aria-pressed={demoFilter}
          onClick={() => updateParams({ demo: demoFilter ? undefined : "1" })}
          className={
            demoFilter
              ? "inline-flex min-h-11 items-center rounded-full border border-sapphire-ink bg-sapphire-ink/10 px-4 text-small font-medium text-sapphire-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
              : "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-small text-graphite outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          }
        >
          Demo only
        </button>

        <ColumnsMenu tableKey="products" columns={PRODUCT_COLUMNS} />
      </div>

      {/* Cross-page selection banner (audit L-AD1, Gmail pattern). */}
      {selection.allSelected && total > rowIds.length && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border bg-card px-4 py-3 text-small text-foreground">
          {filterArmed ? (
            <>
              <span>
                All{" "}
                <span className="u-num font-medium">{formatCount(total)}</span>{" "}
                products matching this filter are selected.
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-input font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
              >
                Clear selection
              </button>
            </>
          ) : (
            <>
              <span>
                All <span className="u-num font-medium">{rowIds.length}</span>{" "}
                products on this page are selected.
              </span>
              <button
                type="button"
                onClick={() => setAllMatching(true)}
                className="rounded-input font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
              >
                Select all {formatCount(total)} matching this filter
              </button>
            </>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <EmptyState
          title="No products found"
          description="Try clearing the filters, or add your first product to start building the catalog."
        />
      ) : (
        <>
          {/* §12.6 — on a phone the table becomes cards (inquiry-list.tsx
            pattern). Both views render; one is `display:none` per breakpoint,
            which also removes it from the accessibility tree. */}
          <label className="mb-3 flex min-h-11 cursor-pointer items-center gap-3 text-small text-graphite md:hidden">
            <Checkbox
              aria-label="Select all"
              checked={selection.allSelected}
              onCheckedChange={() => {
                if (selection.allSelected) setAllMatching(false);
                selection.toggleAll();
              }}
            />
            Select all on this page
          </label>
          <ul className="space-y-3 md:hidden">
            {pageRows.map((product) => (
              <li
                key={product.id}
                className="rounded-card border border-border bg-card p-4 shadow-e1"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    aria-label={`Select ${product.title}`}
                    checked={selection.selected.has(product.id)}
                    onCheckedChange={() => selection.toggle(product.id)}
                    className="mt-1"
                  />
                  {product.thumbnailUrl ? (
                    <Image
                      src={product.thumbnailUrl}
                      unoptimized={!isOptimizableImageSrc(product.thumbnailUrl)}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-image border border-border object-cover"
                    />
                  ) : (
                    <div
                      aria-hidden
                      className="size-12 shrink-0 rounded-image border border-border bg-background"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/studio/products/${product.id}`}
                        className="rounded-input font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {product.title}
                      </Link>
                      {product.isDemo && <DemoBadge />}
                    </div>
                    <p className="mt-0.5 text-small text-graphite">
                      {product.categoryName}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE_VARIANT[product.status]}>
                        {STATUS_BADGE_LABEL[product.status]}
                      </Badge>
                      <span className="u-num text-12 text-graphite">
                        {formatPriceBand(product.priceMin, product.priceMax)}
                      </span>
                      <span className="u-micro ms-auto">
                        {product.updatedAt}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div
            tabIndex={0}
            role="region"
            aria-label="Products"
            className="relative hidden overflow-x-auto rounded-card border border-border bg-card shadow-e1 md:block xl:overflow-x-visible [contain:paint] xl:[contain:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <table className="w-full min-w-[62rem] text-small xl:min-w-0">
              <thead className="xl:sticky xl:top-16 xl:z-20 xl:bg-card">
                <StudioTableHead>
                  <th className="w-10 py-3 pe-2 ps-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-0">
                    <Checkbox
                      aria-label="Select all"
                      checked={selection.allSelected}
                      onCheckedChange={() => {
                        // Unticking select-all always disarms filter-mode too.
                        if (selection.allSelected) setAllMatching(false);
                        selection.toggleAll();
                      }}
                    />
                  </th>
                  <th className="w-15 py-3 pe-3 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-10" />
                  <th className="py-3 pe-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-25">
                    Title
                  </th>
                  {columns.isVisible("category") && (
                    <SortHead
                      label="Category"
                      sortKey="category"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  )}
                  {columns.isVisible("price") && (
                    <SortHead
                      label="Price"
                      sortKey="price"
                      sort={sort}
                      onSort={toggleSort}
                      numeric
                    />
                  )}
                  <th className="py-3 pe-4">Status</th>
                  {/* pe-2, not the pe-4 every other column uses. At 1440 the
                      content rail leaves this table 1151px and its intrinsic
                      width with the product-tier and import-list columns is
                      1161 — the studio audit failed /studio/products at
                      exactly 1450-in-1440 when the product-tier column was
                      added. Eight pixels off each of these two is the whole
                      margin. Adding a THIRTEENTH column needs a real answer
                      (a default-hidden column, or moving the scroll region
                      past xl), not more shaving. */}
                  {columns.isVisible("sizeTier") && (
                    <th className="py-3 pe-2">Product tier</th>
                  )}
                  {columns.isVisible("tier") && (
                    <th className="py-3 pe-2">Import list</th>
                  )}
                  {columns.isVisible("stock") && (
                    <th className="py-3 pe-4">Stock</th>
                  )}
                  {columns.isVisible("featured") && (
                    <th className="py-3 pe-4 text-center">Featured</th>
                  )}
                  {columns.isVisible("updated") && (
                    <SortHead
                      label="Updated"
                      sortKey="updated"
                      sort={sort}
                      onSort={toggleSort}
                      numeric
                    />
                  )}
                  <th className={`py-3 pe-4 ${STICKY_ACTIONS_CELL}`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {pageRows.map((product) => (
                  <StudioRow
                    key={product.id}
                    selected={selection.selected.has(product.id)}
                  >
                    <td className="py-3 pe-2 ps-4 align-middle max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-0">
                      <Checkbox
                        aria-label={`Select ${product.title}`}
                        checked={selection.selected.has(product.id)}
                        onCheckedChange={() => selection.toggle(product.id)}
                      />
                    </td>
                    <td className="py-2 pe-3 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-10">
                      {product.thumbnailUrl ? (
                        <Image
                          src={product.thumbnailUrl}
                          unoptimized={
                            !isOptimizableImageSrc(product.thumbnailUrl)
                          }
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 rounded-image border border-border object-cover"
                        />
                      ) : (
                        <div
                          aria-hidden
                          className="size-12 rounded-image border border-border bg-background"
                        />
                      )}
                    </td>
                    <td className="py-3 pe-4 max-xl:sticky max-xl:z-10 max-xl:bg-inherit max-xl:start-25">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/studio/products/${product.id}`}
                          className="rounded-input font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {product.title}
                        </Link>
                        {product.isDemo && <DemoBadge />}
                        {product.needsRewrite && (
                          <Badge variant="warning">needs rewrite</Badge>
                        )}
                        {product.demoted && (
                          <Badge
                            variant="outline"
                            className="border-sapphire-ink/30 text-sapphire-ink"
                            title="Demoted to draft by the catalog fill — its import list's cap was reached. Not an intentional owner draft."
                          >
                            Over list cap
                          </Badge>
                        )}
                      </div>
                    </td>
                    {columns.isVisible("category") && (
                      <td className="py-3 pe-4 text-graphite">
                        {product.categoryName}
                      </td>
                    )}
                    {columns.isVisible("price") && (
                      <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                        {formatPriceBand(product.priceMin, product.priceMax)}
                      </td>
                    )}
                    <td className="py-3 pe-4">
                      {/* Status is not an action, so it is not sapphire (A2:
                        royal = clickable). Published reads as a quiet success
                        outline; the newer statuses (10 remnants: REVIEW,
                        ARCHIVED) get their own tone rather than falling back
                        to Draft's grey, which used to be every non-published
                        row regardless of which of the four it actually was. */}
                      <Badge variant={STATUS_BADGE_VARIANT[product.status]}>
                        {STATUS_BADGE_LABEL[product.status]}
                      </Badge>
                    </td>
                    {columns.isVisible("sizeTier") && (
                      <td className="py-3 pe-2 whitespace-nowrap">
                        {product.sizeTier ? (
                          <span
                            className="text-graphite"
                            title={SIZE_TIER_NAME[product.sizeTier]}
                          >
                            {SIZE_TIER_SHORT[product.sizeTier]}
                          </span>
                        ) : (
                          // Named, not a dash. This is the backlog, and a row
                          // that reads "—" looks finished.
                          <Badge variant="secondary">No tier yet</Badge>
                        )}
                      </td>
                    )}
                    {columns.isVisible("tier") && (
                      <td className="u-num py-3 pe-2 whitespace-nowrap text-graphite">
                        <ImportListCell
                          tier={product.tier}
                          imported={product.imported}
                        />
                      </td>
                    )}
                    {columns.isVisible("stock") && (
                      <td className="py-3 pe-4 whitespace-nowrap">
                        {product.inStock ? (
                          <span className="text-graphite">In stock</span>
                        ) : (
                          <Badge variant="secondary">Out of stock</Badge>
                        )}
                      </td>
                    )}
                    {columns.isVisible("featured") && (
                      <td className="py-3 pe-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleFeature(product)}
                          aria-label={
                            product.featured
                              ? `Unfeature ${product.title}`
                              : `Feature ${product.title}`
                          }
                          aria-pressed={product.featured}
                          className="inline-flex size-11 items-center justify-center rounded-input outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-foreground/6 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
                        >
                          <Star
                            className={
                              product.featured
                                ? "size-4 fill-sapphire-ink text-sapphire-ink"
                                : "size-4 text-graphite/50"
                            }
                          />
                        </button>
                      </td>
                    )}
                    {columns.isVisible("updated") && (
                      <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                        {product.updatedAt}
                      </td>
                    )}
                    <td className={`py-3 pe-4 text-end ${STICKY_ACTIONS_CELL}`}>
                      <Link
                        href={`/studio/products/${product.id}`}
                        className="inline-flex min-h-11 items-center rounded-input px-2 text-small font-medium text-sapphire-ink underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        Edit
                        <span className="sr-only"> {product.title}</span>
                      </Link>
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={(next) =>
          updateParams({ page: next > 1 ? String(next) : undefined })
        }
        unit="products"
      />

      <BulkBar count={effectiveCount} onClear={clearSelection}>
        {/* Approve is the batch "confirm rewrite" — Publish keeps refusing
            flagged rows (that refusal is the guardrail), and this is the
            explicit act that lifts it, behind a dialog that says so. */}
        <Button size="sm" disabled={busy} onClick={() => setApproveOpen(true)}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => handleStatus("PUBLISHED")}
        >
          Publish
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("DRAFT")}
        >
          {statusTab === "ARCHIVED" ? "Restore to draft" : "Draft"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("REVIEW")}
        >
          Send to review
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleStatus("ARCHIVED")}
        >
          Archive
        </Button>
        <Select
          value={bulkCategory}
          onValueChange={(value) => {
            if (!busy && value) void handleCategory(value);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Change category"
            className="h-8 w-44 text-sm"
          >
            <SelectValue placeholder="Change category…" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={bulkSizeTier}
          onValueChange={(value) => {
            if (!busy && value) void handleSizeTier(value);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Set product tier"
            className="h-8 w-44 text-sm"
          >
            <SelectValue placeholder="Set product tier…" />
          </SelectTrigger>
          <SelectContent>
            {/* No "— none" option. Clearing a filtered selection of thousands
                on one misclick is not a correction anyone asked for, and the
                product form already clears the one row where it is. */}
            {PRODUCT_SIZE_TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {sizeTierStudioLabel(tier)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={busy} onClick={() => void handleConfirm()}>
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void handleUnconfirm()}
        >
          Unconfirm
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </BulkBar>

      <ApproveProductsDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        count={effectiveCount}
        busy={busy}
        onConfirm={handleApprove}
        filterWide={filterArmed}
      />
      <ConfirmDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={effectiveCount}
        noun="Product"
        busy={busy}
        onConfirm={handleDelete}
        extraWarning={
          filterArmed
            ? `This deletes every product matching the current filter, across all ${pageCount.toLocaleString("en-IN")} pages — not just this page. Their gallery images are removed from storage too.`
            : "Their gallery images are removed from storage too."
        }
      />
    </div>
  );
}
