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
import type { ContentStatus } from "@/generated/prisma/enums";
import {
  confirmProducts,
  deleteProducts,
  setProductsCategory,
  setProductsStatus,
  toggleFeatured,
  unconfirmProducts,
  type BulkProductTarget,
} from "@/actions/products";
import { formatPriceBand } from "@/lib/utils";
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
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import { Pagination, PAGE_SIZE } from "@/components/studio/pagination";
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
  featured: boolean;
  needsRewrite: boolean;
  /** Owner-sheet tier (1-4) or null for studio-made products. */
  tier: number | null;
  inStock: boolean;
  /** True when the row came from the scheduled sheet import. */
  imported: boolean;
  /** Sheet draft pushed out by the tier cap — not an intentional owner draft. */
  demoted: boolean;
  thumbnailUrl: string | null;
  /** Pre-formatted on the server to keep hydration deterministic. */
  updatedAt: string;
};

const STATUS_TABS: { value: ProductStatusTab; label: string }[] = [
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "ALL", label: "All" },
];

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
  const [busy, setBusy] = useState(false);
  // Gmail pattern (audit L-AD1): true after "Select all N matching this
  // filter". Only effective while every row on the page is still ticked —
  // unticking any row drops straight back to page-scoped selection.
  const [allMatching, setAllMatching] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");

  const pageRows = products;
  const rowIds = useMemo(() => pageRows.map((p) => p.id), [pageRows]);
  const selection = useSelection(rowIds);

  const filterArmed = allMatching && selection.allSelected;
  /** The count every bulk action + confirmation actually applies to. */
  const effectiveCount = filterArmed ? total : selection.count;
  const bulkTarget: BulkProductTarget = filterArmed ? { filter } : selection.ids;

  const categoryFilter = searchParams.get("category") ?? "ALL";
  const tierFilter = searchParams.get("tier") ?? "ALL";
  const stockFilter = searchParams.get("stock") ?? "ALL";

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

  async function handleStatus(status: "DRAFT" | "PUBLISHED") {
    setBusy(true);
    const result = await setProductsStatus(bulkTarget, status);
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const { updated = 0, skippedRewrite = 0 } = result.data ?? {};
    if (status === "PUBLISHED") {
      if (skippedRewrite > 0) {
        toast.warning(
          `Published ${formatCount(updated)} product${updated === 1 ? "" : "s"}. Skipped ${formatCount(skippedRewrite)} that still need${skippedRewrite === 1 ? "s" : ""} a rewrite of scraped content.`,
        );
      } else {
        toast.success(
          `Published ${formatCount(updated)} product${updated === 1 ? "" : "s"}.`,
        );
      }
    } else {
      toast.success(
        `Moved ${formatCount(updated)} product${updated === 1 ? "" : "s"} to draft.`,
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
        className="mb-4 flex w-fit items-center gap-1 rounded-full border border-border bg-card p-1"
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
          value={tierFilter}
          onValueChange={(value) =>
            updateParams({ tier: value === "ALL" ? undefined : value })
          }
        >
          <SelectTrigger aria-label="Filter by sheet tier">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All tiers</SelectItem>
            <SelectItem value="1">Tier 1 — Owner</SelectItem>
            <SelectItem value="2">Tier 2 — Resin goods</SelectItem>
            <SelectItem value="3">Tier 3 — Supplies</SelectItem>
            <SelectItem value="4">Tier 4 — 3D printing</SelectItem>
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
      </div>

      {/* Cross-page selection banner (audit L-AD1, Gmail pattern). */}
      {selection.allSelected && total > rowIds.length && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-border bg-card px-4 py-3 text-small text-foreground">
          {filterArmed ? (
            <>
              <span>
                All{" "}
                <span className="u-num font-medium">
                  {formatCount(total)}
                </span>{" "}
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
                All{" "}
                <span className="u-num font-medium">
                  {rowIds.length}
                </span>{" "}
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
        <div
            tabIndex={0}
            role="region"
            aria-label="Products"
            className="relative overflow-x-auto rounded-card border border-border bg-card shadow-e1 xl:overflow-x-visible [contain:paint] xl:[contain:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
          <table className="w-full min-w-[62rem] text-small xl:min-w-0">
            <thead className="xl:sticky xl:top-16 xl:z-20 xl:bg-card">
              <StudioTableHead>
                <th className="w-10 py-3 pe-2 ps-4">
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
                <th className="w-14 py-3 pe-3" />
                <th className="py-3 pe-4">Title</th>
                <th className="py-3 pe-4">Category</th>
                <th className="py-3 pe-4">Price</th>
                <th className="py-3 pe-4">Status</th>
                <th className="py-3 pe-4">Tier</th>
                <th className="py-3 pe-4">Stock</th>
                <th className="py-3 pe-4 text-center">Featured</th>
                <th className="py-3 pe-4">Updated</th>
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
                  <td className="py-3 pe-2 ps-4 align-middle">
                    <Checkbox
                      aria-label={`Select ${product.title}`}
                      checked={selection.selected.has(product.id)}
                      onCheckedChange={() => selection.toggle(product.id)}
                    />
                  </td>
                  <td className="py-2 pe-3">
                    {product.thumbnailUrl ? (
                      <Image
                        src={product.thumbnailUrl}
                        unoptimized={!isOptimizableImageSrc(product.thumbnailUrl)}
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
                  <td className="py-3 pe-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/studio/products/${product.id}`}
                        className="rounded-input font-medium text-foreground underline-offset-4 outline-none hover:text-sapphire-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {product.title}
                      </Link>
                      {product.title.startsWith("DEMO") && (
                        <Badge variant="outline">DEMO</Badge>
                      )}
                      {product.needsRewrite && (
                        <Badge variant="warning">needs rewrite</Badge>
                      )}
                      {product.demoted && (
                        <Badge
                          variant="outline"
                          className="border-sapphire-ink/30 text-sapphire-ink"
                          title="Demoted to draft by the sheet import's tier cap — not an intentional owner draft."
                        >
                          Out of tier cap
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pe-4 text-graphite">
                    {product.categoryName}
                  </td>
                  <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                    {formatPriceBand(product.priceMin, product.priceMax)}
                  </td>
                  <td className="py-3 pe-4">
                    {/* Status is not an action, so it is not sapphire (A2:
                        royal = clickable). Published reads as a quiet success
                        outline; Draft keeps the neutral chip. */}
                    <Badge
                      variant={
                        product.status === "PUBLISHED" ? "success" : "secondary"
                      }
                    >
                      {product.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                    {product.tier ? (
                      <Badge variant="outline">
                        T{product.tier}
                        {product.imported ? " · sheet" : ""}
                      </Badge>
                    ) : (
                      <span aria-hidden>—</span>
                    )}
                  </td>
                  <td className="py-3 pe-4 whitespace-nowrap">
                    {product.inStock ? (
                      <span className="text-graphite">In stock</span>
                    ) : (
                      <Badge variant="secondary">Out of stock</Badge>
                    )}
                  </td>
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
                  <td className="u-num py-3 pe-4 whitespace-nowrap text-graphite">
                    {product.updatedAt}
                  </td>
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
          Draft
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
