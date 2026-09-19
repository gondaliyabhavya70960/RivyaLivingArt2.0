"use client";

/**
 * The review inbox, rebuilt on ShortlistEntry (B7). Cards are researched
 * products; the badge is where a human last left them in the funnel. Bulk
 * moves ride the same state machine as the detail sheet — CONFIRMED only
 * from SHORTLISTED, and the toast says exactly what moved and what was
 * refused, so a mixed selection never silently half-applies.
 */

import { useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { updateStagedProduct } from "@/actions/scraper-review";
import {
  resolveInboxSelection,
  setShortlistNote,
  setShortlistState,
  setShortlistTags,
} from "@/actions/scraper-shortlist";
import type { TransitionReport } from "@/actions/scraper-shortlist";
import { InboxAddToCatalogDialog } from "@/components/studio/scraper/inbox-add-to-catalog-dialog";
import { BulkBar } from "@/components/studio/bulk-bar";
import { EmptyState } from "@/components/studio/page-header";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  SHORTLIST_STATE_DESCRIPTIONS,
  SHORTLIST_STATE_LABELS,
  SHORTLIST_STATE_ORDER,
  ShortlistState,
} from "@/lib/scraper/shortlist";
import type {
  InboxCounts,
  InboxFilter,
  InboxRow,
  InboxSizeTierFilter,
} from "@/lib/scraper/shortlist-query";
import type { ScrapeTier } from "@/generated/prisma/enums";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NUMBER,
  SIZE_TIER_SHORT,
  sizeTierStudioLabel,
} from "@/lib/product-size-tier";
import { MOVE_BATCH, chunk } from "@/lib/scraper/inbox-batch";
import { OFFERED_SCRAPE_TIERS, scrapeTierStudioLabel } from "@/lib/scraper/purge";
import {
  StateBadge,
  formatPriceRange,
} from "@/components/studio/scraper/shortlist-shared";
import { DetailSheetBody } from "@/components/studio/scraper/shortlist-detail-sheet";
import { describeScraperMoveToast } from "@/components/studio/scraper/scraper-kanban-model";
import { useSelection } from "@/hooks/use-selection";


/** A transition report's counts — one call's, or several batches' added up. */
type MoveTotals = { moved: number; already: number; blocked: number };

function totalsOf(report: TransitionReport): MoveTotals {
  return {
    moved: report.moved,
    already: report.already,
    blocked: report.blocked.length,
  };
}


// ————————————————————— Card —————————————————————

function InboxCard({
  row,
  checked,
  onToggle,
  onOpen,
}: {
  row: InboxRow;
  checked: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="relative">
      {/* Selection overlay — a sibling of the card button, never nested. */}
      <div className="absolute start-2 top-2 z-10 rounded-input bg-card p-1 shadow-e1">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={`Select ${row.title}`}
        />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full w-full flex-col overflow-hidden rounded-card border border-border bg-card text-left transition-shadow hover:shadow-e1 motion-reduce:transition-none"
      >
        {row.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
          <img
            src={row.images[0]}
            alt={row.imageAlts[0] ?? row.title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-40 w-full rounded-t-2xl bg-muted object-cover"
          />
        ) : (
          <div aria-hidden className="h-40 w-full rounded-t-2xl bg-muted" />
        )}
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <p className="line-clamp-2 text-sm font-medium text-foreground">
            {row.title}
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatPriceRange(row.priceMin, row.priceMax)}
          </p>
          {row.shortTagline && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {row.shortTagline}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
            <Badge variant="secondary" title="Source website">
              {row.sourceName}
            </Badge>
            {row.category && <Badge variant="secondary">{row.category}</Badge>}
            {row.suggestedSizeTier && (
              <Badge
                variant="outline"
                title={`Suggested tier: ${sizeTierStudioLabel(row.suggestedSizeTier)}`}
              >
                Tier {SIZE_TIER_NUMBER[row.suggestedSizeTier]} ·{" "}
                {SIZE_TIER_SHORT[row.suggestedSizeTier]}
              </Badge>
            )}
            <Badge variant={row.updated ? "outline" : "secondary"}>
              {row.updated ? "updated" : "new"}
            </Badge>
            <StateBadge state={row.state} />
            {row.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}

// ————————————————————— Inbox —————————————————————

export function ShortlistInbox({
  rows,
  sources,
  categories,
  counts,
  activeSource,
  activeSourceTier,
  activeSizeTier,
  activeState,
  initialQuery,
  truncated,
  totalMatching,
}: {
  rows: InboxRow[];
  sources: { key: string; name: string; tier: ScrapeTier }[];
  categories: { id: string; name: string }[];
  counts: InboxCounts;
  /** "ALL" or a sourceKey. */
  activeSource: string;
  /** "ALL" or a ScrapeTier — the SOURCE's list. */
  activeSourceTier: string;
  /** "ALL", a ProductSizeTier, or "NONE" — the SUGGESTED product tier. */
  activeSizeTier: string;
  /** "ALL" or a ShortlistState. */
  activeState: string;
  initialQuery: string;
  truncated: boolean;
  totalMatching: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The filter as the server actions take it — what "select all matching"
  // resolves against, so the bulk bar acts on exactly what the page shows.
  const filter = useMemo<InboxFilter>(
    () => ({
      sourceKey: activeSource !== "ALL" ? activeSource : undefined,
      sourceTier:
        activeSourceTier !== "ALL"
          ? (activeSourceTier as ScrapeTier)
          : undefined,
      sizeTier:
        activeSizeTier !== "ALL"
          ? (activeSizeTier as InboxSizeTierFilter)
          : undefined,
      q: initialQuery || undefined,
    }),
    [activeSource, activeSourceTier, activeSizeTier, initialQuery],
  );
  const state = activeState as ShortlistState | "ALL";
  const filterKey = `${activeSource}|${activeSourceTier}|${activeSizeTier}|${activeState}|${initialQuery}`;

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    rows,
    PAGE_SIZE,
    filterKey,
  );

  // Selection is scoped to the visible page.
  const rowIds = useMemo(
    () => pageRows.map((row) => row.researchProductId),
    [pageRows],
  );
  const selection = useSelection(rowIds);

  const [detail, setDetail] = useState<InboxRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<ShortlistState>(
    ShortlistState.SHORTLISTED,
  );

  // "Select all N matching": the selection is the FILTER, on every page,
  // rather than the ticks on this one. Any change to the filter or to a
  // single tick drops back to the ticks — the render-time reset pattern
  // `usePagination` already uses, never a synchronous setState in an effect.
  const [allMatching, setAllMatching] = useState(false);
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setAllMatching(false);
  }
  const effectiveCount = allMatching ? totalMatching : selection.count;

  function clearAll() {
    setAllMatching(false);
    selection.clear();
  }

  function toggleRow(id: string) {
    setAllMatching(false);
    selection.toggle(id);
  }

  function setParam(
    key: "source" | "tier" | "size" | "status" | "q",
    value: string,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    const isDefault =
      key === "status"
        ? value === ShortlistState.NEW
        : key === "q"
          ? value === ""
          : value === "ALL";
    if (isDefault) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setParam("q", String(data.get("q") ?? "").trim());
  }

  async function moveIds(
    ids: string[],
    target: ShortlistState,
    reason?: string,
  ): Promise<boolean> {
    setBusy(true);
    const res = await setShortlistState(ids, target, reason);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    if (res.data) {
      toast.success(describeScraperMoveToast(target, totalsOf(res.data)));
    }
    router.refresh();
    return true;
  }

  /**
   * Move every row the filter matches: resolve the ids on the server, then
   * feed `setShortlistState` in batches of its own ceiling. One toast adds
   * the batches up, so "312 moved · 4 skipped" reads like a single move.
   */
  async function moveAllMatching(target: ShortlistState) {
    setBusy(true);
    const resolved = await resolveInboxSelection({ filter, state });
    if (!resolved.ok || !resolved.data) {
      setBusy(false);
      toast.error(resolved.ok ? "Nothing to move." : resolved.error);
      return;
    }
    const totals: MoveTotals = { moved: 0, already: 0, blocked: 0 };
    let stopped = false;
    for (const ids of chunk(resolved.data.ids, MOVE_BATCH)) {
      const res = await setShortlistState(ids, target);
      if (!res.ok) {
        toast.error(res.error);
        stopped = true;
        break;
      }
      if (res.data) {
        totals.moved += res.data.moved;
        totals.already += res.data.already;
        totals.blocked += res.data.blocked.length;
      }
    }
    setBusy(false);
    if (!stopped) {
      toast.success(describeScraperMoveToast(target, totals));
      if (resolved.data.capped) {
        toast.info(
          `The first ${resolved.data.ids.length} of ${resolved.data.totalMatching} matching rows moved — run it again for the rest.`,
        );
      }
    }
    clearAll();
    router.refresh();
  }

  async function handleDetailTransition(
    target: ShortlistState,
    reason: string,
  ) {
    if (!detail) return;
    const moved = await moveIds([detail.researchProductId], target, reason);
    if (moved) setDetail(null);
  }

  async function handleSaveEdit(patch: {
    id: string;
    title: string;
    shortTagline: string | null;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
  }) {
    const res = await updateStagedProduct(patch);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Saved.");
    setDetail((d) =>
      d && d.twinId === patch.id
        ? {
            ...d,
            title: patch.title,
            shortTagline: patch.shortTagline,
            category: patch.category,
            priceMin: patch.priceMin,
            priceMax: patch.priceMax,
          }
        : d,
    );
    router.refresh();
  }

  async function handleSaveNote(note: string | null) {
    if (!detail) return;
    const res = await setShortlistNote(detail.researchProductId, note);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Note saved.");
    setDetail((d) => (d ? { ...d, note } : d));
    router.refresh();
  }

  async function handleSaveTags(tags: string[]) {
    if (!detail) return;
    const res = await setShortlistTags(detail.researchProductId, tags);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Tags saved.");
    setDetail((d) => (d ? { ...d, tags } : d));
    router.refresh();
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={activeSource}
          onValueChange={(value) => setParam("source", value)}
        >
          <SelectTrigger size="sm" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.key} value={source.key}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeState}
          onValueChange={(value) => setParam("status", value)}
        >
          <SelectTrigger size="sm" aria-label="Filter by funnel state">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            {SHORTLIST_STATE_ORDER.map((state) => (
              <SelectItem key={state} value={state}>
                {SHORTLIST_STATE_LABELS[state]}
              </SelectItem>
            ))}
            <SelectItem value="ALL">All states</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={activeSourceTier}
          onValueChange={(value) => setParam("tier", value)}
        >
          <SelectTrigger size="sm" aria-label="Filter by the source's tier">
            <SelectValue placeholder="Source tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All source tiers</SelectItem>
            {/* "Tier 1 sources — …": the qualifier is what tells this list
                of options from the product-tier filter's, next to it, whose
                options read "Tier 1 — …" for the same three names. */}
            {/* The offered tiers only. A staged row from a retired-tier
                source still appears under "All source tiers" — it is the
                filter that is unlisted, not the rows. */}
            {OFFERED_SCRAPE_TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {scrapeTierStudioLabel(tier, "sources")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={activeSizeTier}
          onValueChange={(value) => setParam("size", value)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filter by suggested product tier"
          >
            <SelectValue placeholder="Suggested tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any suggested tier</SelectItem>
            {PRODUCT_SIZE_TIERS.map((tier) => (
              <SelectItem key={tier} value={tier}>
                {sizeTierStudioLabel(tier)}
              </SelectItem>
            ))}
            <SelectItem value="NONE">Unsure — no suggestion</SelectItem>
          </SelectContent>
        </Select>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            key={initialQuery}
            name="q"
            defaultValue={initialQuery}
            placeholder="Search title or URL…"
            aria-label="Search researched products"
            className="h-9 w-56"
          />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Count summary chips — clicking one filters to that state. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SHORTLIST_STATE_ORDER.map((state) => (
          <button
            key={state}
            type="button"
            onClick={() => setParam("status", state)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors motion-reduce:transition-none ${
              activeState === state
                ? "border-foreground/40 bg-muted text-foreground"
                : "border-foreground/15 bg-card/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {SHORTLIST_STATE_LABELS[state]}
            <span className="tabular-nums text-foreground">
              {counts[state]}
            </span>
          </button>
        ))}
      </div>

      {truncated && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the {rows.length} most recently seen of {totalMatching}{" "}
          matching items — narrow the filters to see the rest, or select all on
          this page and then all {totalMatching} matching to act on every one of
          them.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <Checkbox
              checked={selection.allSelected}
              onCheckedChange={() => {
                setAllMatching(false);
                selection.toggleAll();
              }}
              aria-label="Select all on this page"
            />
            <span>Select all on this page</span>
          </label>
          {selection.allSelected &&
            !allMatching &&
            totalMatching > selection.count && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setAllMatching(true)}
              >
                Select all {totalMatching} matching
              </Button>
            )}
          {allMatching && (
            <span role="status" className="text-muted-foreground">
              All {totalMatching} matching items are selected, on every page.
            </span>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description="Run a scrape job or loosen the filters — freshly researched products land in this inbox as New."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-4">
          {pageRows.map((row) => (
            <InboxCard
              key={row.researchProductId}
              row={row}
              checked={
                allMatching || selection.selected.has(row.researchProductId)
              }
              onToggle={() => toggleRow(row.researchProductId)}
              onOpen={() => setDetail(row)}
            />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        unit="products"
      />

      <BulkBar count={effectiveCount} onClear={clearAll}>
        <Select
          value={bulkTarget}
          onValueChange={(value) => setBulkTarget(value as ShortlistState)}
        >
          <SelectTrigger size="sm" aria-label="Move selection to">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHORTLIST_STATE_ORDER.map((state) => (
              <SelectItem
                key={state}
                value={state}
                title={SHORTLIST_STATE_DESCRIPTIONS[state]}
              >
                {SHORTLIST_STATE_LABELS[state]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            allMatching
              ? moveAllMatching(bulkTarget)
              : moveIds(selection.ids, bulkTarget)
          }
        >
          Move {effectiveCount} to {SHORTLIST_STATE_LABELS[bulkTarget]}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setCatalogOpen(true)}>
          Add to catalog…
        </Button>
      </BulkBar>

      <InboxAddToCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        filter={filter}
        state={state}
        ids={allMatching ? null : selection.ids}
        categories={categories}
        onDone={() => {
          clearAll();
          router.refresh();
        }}
      />

      <Sheet
        open={detail !== null}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        {detail && (
          <DetailSheetBody
            key={detail.researchProductId}
            row={detail}
            busy={busy}
            onTransition={handleDetailTransition}
            onSave={handleSaveEdit}
            onSaveNote={handleSaveNote}
            onSaveTags={handleSaveTags}
          />
        )}
      </Sheet>
    </>
  );
}
