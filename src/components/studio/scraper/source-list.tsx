"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  addScrapeSources,
  deleteScrapeSources,
  seedScrapeSources,
  setSourcePolicyReview,
  toggleScrapeSources,
  verifyScrapeSource,
  type BulkAddReport,
} from "@/actions/scraper-sources";
import { BulkBar } from "@/components/studio/bulk-bar";
import { ConfirmDeleteDialog } from "@/components/studio/confirm-delete-dialog";
import { EmptyState } from "@/components/studio/page-header";
import { FieldError } from "@/components/studio/field-error";
import { FieldHint, describedBy } from "@/components/studio/field-hint";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { useDismissGuard } from "@/hooks/use-dismiss-guard";
import { SortHead, useSort } from "@/components/studio/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ScrapeJobStatus,
  ScrapePlatform,
  ScrapeTier,
} from "@/generated/prisma/enums";
import { useSelection } from "@/hooks/use-selection";
import {
  HEALTH_META,
  NEEDS_ATTENTION,
  type SourceHealth,
} from "@/lib/scraper/health";
import {
  scrapeTierChips,
  scrapeTierOptions,
  SCRAPE_TIER_SHORT,
  scrapeTierStudioLabel,
} from "@/lib/scraper/purge";
import { cn } from "@/lib/utils";

export type SourceRow = {
  id: string;
  key: string;
  name: string;
  baseUrl: string;
  tier: ScrapeTier;
  vertical: string;
  country: string;
  platform: ScrapePlatform;
  supply: boolean;
  enabled: boolean;
  /** Pre-formatted on the server (en-IN); null when never verified. */
  verifiedAt: string | null;
  notes: string | null;
  /** Derived scrape health for the status column. */
  health: SourceHealth;
  /** Total staged products for this source (all review statuses). */
  productCount: number;
  /** Staged products still PENDING review. */
  pendingCount: number;
  /** Latest job status / error, null when never run. */
  lastStatus: ScrapeJobStatus | null;
  lastError: string | null;
  /** Pre-formatted last-run time; raw ts for sorting. */
  lastRunAt: string | null;
  lastRunAtTs: number | null;
  /**
   * Why the governance gate would refuse this source, or null when it would
   * not. Computed on the SERVER by the same function the Scrape button calls,
   * so the badge here and the refusal there can never drift apart.
   */
  policyBlocked: string | null;
  /** Two or three words naming WHICH refusal it is, for the badge. */
  policyBadge: string | null;
};

type StatusFilter = "ALL" | "ATTENTION" | SourceHealth;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "ATTENTION", label: "Needs attention" },
  { value: "OK", label: "Scraped" },
  { value: "EMPTY", label: "No products" },
  { value: "FAILED", label: "Failed" },
  { value: "NEVER", label: "Not run" },
  { value: "RUNNING", label: "Running" },
  { value: "DISABLED", label: "Disabled" },
];

/** Small health pill used in the status column. */
function HealthBadge({
  health,
  title,
}: {
  health: SourceHealth;
  title?: string;
}) {
  const meta = HEALTH_META[health];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5", meta.className)}
      title={title}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

export type TierCounts = { all: number } & Record<ScrapeTier, number>;

/**
 * Source tiers on this screen come from `purge.ts`, and the two call sites
 * ask it DIFFERENT questions.
 *
 * The tab row asks `scrapeTierChips(counts)`: the four current tiers, plus any
 * retired provenance tier that still HOLDS rows. Those four used to be
 * unconditional, under a note saying that hiding a tab would hide the sources
 * behind it rather than retire them. The concern is right; the count answers
 * it as a fact instead of by keeping four dead tabs on every screen — the tab
 * goes with the last SUPPLIES source and returns the moment one is filed
 * again.
 *
 * The add form asks `scrapeTierOptions()`: the four current tiers only.
 * Filing something NEW under a retired value is precisely the thing being
 * retired, and a picker is where that happens.
 *
 * The words on the tabs, the select and the row line come from `purge.ts`
 * (`scrapeTierStudioLabel`, `SCRAPE_TIER_SHORT`); this file carried its own
 * copy once, and that copy is how a supplier list came to read "Tier 1 —
 * Large" beside a product tier that reads "Tier 1 — Collectible …".
 */

const PLATFORM_BADGE: Record<
  ScrapePlatform,
  "default" | "secondary" | "outline"
> = {
  SHOPIFY: "default",
  WOOCOMMERCE: "secondary",
  JSONLD: "secondary",
  UNKNOWN: "outline",
};

/** Add-source form. Fingerprints the URL live on submit. */
function AddSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix unmounts content on close, so a fresh body (and fresh field
          state) mounts on every open without any effect. */}
      <AddSourceBody
        key={open ? "open" : "closed"}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function AddSourceBody({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [urls, setUrls] = useState("");
  const [tier, setTier] = useState<ScrapeTier>("RESIN_GOODS");
  const [vertical, setVertical] = useState("resin");
  const [country, setCountry] = useState("IN");
  const [supply, setSupply] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<BulkAddReport | null>(null);
  // Blocks Escape and outside-clicks once something has been typed, not
  // only during the save — the "only while busy" pair this replaces let a
  // pasted list of URLs vanish on a stray key.
  const [dismissRef, dismissProps] = useDismissGuard(busy);
  const [errors, setErrors] = useState<{
    urls?: string;
    vertical?: string;
    country?: string;
  }>({});

  // Split on newlines OR commas so pasting either shape works.
  const parsedUrls = urls
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // The same bounds `addScrapeSources` enforces (1–25 URLs of at most 2048
    // characters, vertical ≤ 60, country ≤ 20) — named under the field here,
    // because the action's own zod wording never survives `runAction`. Which
    // of the URLs are usable is still the fingerprint's verdict, reported
    // per row once the batch runs.
    const problems: typeof errors = {};
    if (parsedUrls.length === 0) problems.urls = "Paste at least one URL.";
    else if (parsedUrls.length > 25)
      problems.urls = "Add up to 25 URLs at a time.";
    else if (parsedUrls.some((u) => u.length > 2048))
      problems.urls = "One of these addresses is over 2,048 characters.";
    if (vertical.trim().length > 60)
      problems.vertical = "Keep the vertical under 60 characters.";
    if (country.trim().length > 20)
      problems.country = "Keep the country under 20 characters.";
    setErrors(problems);
    const first = (["urls", "vertical", "country"] as const).find(
      (key) => problems[key],
    );
    if (first) {
      document.getElementById(`source-${first}`)?.focus();
      return;
    }
    setBusy(true);
    const res = await addScrapeSources({
      urls: parsedUrls,
      tier,
      vertical: vertical.trim() || "resin",
      country: country.trim() || "IN",
      supply,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data) {
      setReport(res.data);
      const { added, updated, failed } = res.data;
      const msg = `${added} added · ${updated} updated${failed ? ` · ${failed} failed` : ""}.`;
      if (failed) toast.warning(msg);
      else toast.success(msg);
      router.refresh(); // update the list behind the dialog
    }
  }

  return (
    <DialogContent className="max-w-md" ref={dismissRef} {...dismissProps}>
      <DialogHeader>
        <DialogTitle>Add sources</DialogTitle>
        <DialogDescription>
          Paste one or many website URLs (one per line). Each is fingerprinted
          live — Shopify, WooCommerce and JSON-LD Product schema are supported;
          marketplaces are blocked by design. Re-adding a site updates it.
        </DialogDescription>
      </DialogHeader>

      {report ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{report.added}</span>{" "}
            added ·{" "}
            <span className="font-medium text-foreground">
              {report.updated}
            </span>{" "}
            updated
            {report.failed > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-destructive">
                  {report.failed}
                </span>{" "}
                failed
              </>
            )}
          </p>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
            {report.results.map((r, i) => (
              <li
                key={`${r.url}-${i}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="truncate text-foreground">{r.url}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {r.platform && r.platform !== "UNKNOWN" && (
                    <Badge variant="outline">{r.platform}</Badge>
                  )}
                  <Badge
                    variant={
                      r.status === "added"
                        ? "default"
                        : r.status === "updated"
                          ? "outline"
                          : "secondary"
                    }
                    className={
                      r.status === "invalid" ||
                      r.status === "blocked" ||
                      r.status === "error"
                        ? "text-destructive"
                        : undefined
                    }
                    title={r.message}
                  >
                    {r.enabled === false && r.status !== "error"
                      ? "saved · disabled"
                      : r.status}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReport(null);
                setUrls("");
              }}
            >
              Add more
            </Button>
            <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="source-urls">Website URLs</Label>
            <Textarea
              id="source-urls"
              value={urls}
              onChange={(e) => {
                setUrls(e.target.value);
                if (errors.urls) setErrors({ ...errors, urls: undefined });
              }}
              placeholder={
                "https://one-resin-studio.com\nhttps://another-studio.com\nhttps://a-third-store.com"
              }
              rows={5}
              required
              autoFocus
              aria-invalid={errors.urls ? true : undefined}
              aria-describedby={describedBy(
                "source-urls-hint",
                errors.urls && "source-urls-error",
              )}
            />
            <FieldError id="source-urls-error">{errors.urls}</FieldError>
            <FieldHint id="source-urls-hint">
              {parsedUrls.length > 0
                ? `${parsedUrls.length} URL${parsedUrls.length === 1 ? "" : "s"} · up to 25 per batch`
                : "One per line · up to 25 per batch"}
            </FieldHint>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-tier">Source tier (applied to all)</Label>
            <Select
              value={tier}
              onValueChange={(value) => setTier(value as ScrapeTier)}
            >
              <SelectTrigger id="source-tier" className="w-full">
                <SelectValue placeholder="Source tier" />
              </SelectTrigger>
              <SelectContent>
                {scrapeTierOptions().map((t) => (
                  <SelectItem key={t} value={t}>
                    {scrapeTierStudioLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="source-vertical">Vertical</Label>
              <Input
                id="source-vertical"
                value={vertical}
                onChange={(e) => {
                  setVertical(e.target.value);
                  if (errors.vertical)
                    setErrors({ ...errors, vertical: undefined });
                }}
                placeholder="resin"
                aria-invalid={errors.vertical ? true : undefined}
                aria-describedby={describedBy(
                  errors.vertical && "source-vertical-error",
                )}
              />
              <FieldError id="source-vertical-error">
                {errors.vertical}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source-country">Country</Label>
              <Input
                id="source-country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  if (errors.country)
                    setErrors({ ...errors, country: undefined });
                }}
                placeholder="IN"
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={describedBy(
                  errors.country && "source-country-error",
                )}
              />
              <FieldError id="source-country-error">
                {errors.country}
              </FieldError>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="source-supply"
              checked={supply}
              onCheckedChange={(value) => setSupply(value === true)}
            />
            <Label htmlFor="source-supply" className="font-normal">
              Supplies catalog (moulds, pigments — runs are hard-capped)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy
                ? "Fingerprinting…"
                : `Add ${parsedUrls.length || ""} source${parsedUrls.length === 1 ? "" : "s"}`.trim()}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}

/** Header actions — re-seed + the add-source dialog. */
export function SourceRegistryActions() {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    const res = await seedScrapeSources();
    setSeeding(false);
    if (res.ok) {
      toast.success(
        `Registry re-seeded — ${res.data?.seeded ?? 0} curated sources upserted.`,
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSeed}
        disabled={seeding}
      >
        <RefreshCw className={seeding ? "animate-spin" : undefined} />
        {seeding ? "Seeding…" : "Re-seed registry"}
      </Button>
      <Button size="sm" onClick={() => setAddOpen(true)}>
        <Plus /> Add source
      </Button>
      <AddSourceDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function TierChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-foreground/15 bg-card/60 text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1.5 tabular-nums",
          active ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function SourceList({
  sources,
  counts,
}: {
  sources: SourceRow[];
  counts: TierCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  // Client-side status filter + name/host search over the source-tier-scoped rows.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sources.filter((s) => {
      if (statusFilter === "ATTENTION" && !NEEDS_ATTENTION.includes(s.health))
        return false;
      if (
        statusFilter !== "ALL" &&
        statusFilter !== "ATTENTION" &&
        s.health !== statusFilter
      )
        return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !s.baseUrl.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sources, statusFilter, query]);

  const getValue = useCallback((row: SourceRow, key: string) => {
    switch (key) {
      case "name":
        return row.name.toLowerCase();
      case "status":
        return HEALTH_META[row.health].rank;
      case "products":
        return row.productCount;
      case "platform":
        return row.platform;
      case "lastRun":
        return row.lastRunAtTs;
      case "enabled":
        return row.enabled;
      default:
        return null;
    }
  }, []);

  const { sorted, sort, toggle } = useSort(filtered, getValue, {
    key: "name",
    dir: "asc",
  });

  const { pageRows, page, setPage, pageCount, total, pageSize } = usePagination(
    sorted,
    PAGE_SIZE,
    `${searchParams.get("tier") ?? "ALL"}|${statusFilter}|${query}`,
  );

  // Selection is scoped to the visible page.
  const rowIds = useMemo(() => pageRows.map((s) => s.id), [pageRows]);
  const selection = useSelection(rowIds);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const activeTier = searchParams.get("tier") ?? "ALL";

  function setTierParam(tier: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tier === "ALL") params.delete("tier");
    else params.set("tier", tier);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  async function handleRowToggle(source: SourceRow) {
    setTogglingId(source.id);
    const res = await toggleScrapeSources([source.id], !source.enabled);
    setTogglingId(null);
    if (res.ok) {
      toast.success(
        source.enabled ? `${source.name} disabled.` : `${source.name} enabled.`,
      );
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  /**
   * Record one policy review across every selected source.
   *
   * The bulk shape is what makes the gate usable rather than something to work
   * around: every row starts PENDING, and 115 single reviews would have made
   * "turn the gate off" the reasonable response. The record is still real —
   * the action stamps who and when on each row.
   */
  async function handleBulkReview() {
    const count = selection.count;
    setBusy(true);
    const res = await setSourcePolicyReview(selection.ids, "APPROVED");
    setBusy(false);
    if (res.ok) {
      toast.success(
        `Recorded a policy review for ${count} source${count === 1 ? "" : "s"}.`,
      );
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleBulkToggle(enabled: boolean) {
    const count = selection.count;
    setBusy(true);
    const res = await toggleScrapeSources(selection.ids, enabled);
    setBusy(false);
    if (res.ok) {
      toast.success(
        `${enabled ? "Enabled" : "Disabled"} ${count} source${count === 1 ? "" : "s"}.`,
      );
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleDelete() {
    const count = selection.count;
    setBusy(true);
    const res = await deleteScrapeSources(selection.ids);
    setBusy(false);
    setConfirmOpen(false);
    if (res.ok) {
      toast.success(`Deleted ${count} source${count === 1 ? "" : "s"}.`);
      selection.clear();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function handleVerify(source: SourceRow) {
    setVerifyingId(source.id);
    const res = await verifyScrapeSource(source.id);
    setVerifyingId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data?.platform === "UNKNOWN") {
      toast.warning(
        `${source.name} has no supported platform — source disabled until an adapter exists.`,
      );
    } else {
      toast.success(`${source.name} verified as ${res.data?.platform}.`);
    }
    router.refresh();
  }

  return (
    <>
      {/* Source-tier tabs (`?tier=` — the URL value is the enum, unchanged) */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TierChip
          active={activeTier === "ALL"}
          label="All"
          count={counts.all}
          onClick={() => setTierParam("ALL")}
        />
        {scrapeTierChips(counts).map((tier) => (
          <TierChip
            key={tier}
            active={activeTier === tier}
            label={scrapeTierStudioLabel(tier)}
            count={counts[tier]}
            onClick={() => setTierParam(tier)}
          />
        ))}
      </div>

      {/* Status filter + search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Filter by scrape status"
            className="w-48"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or URL…"
          aria-label="Search sources"
          className="h-9 w-56"
        />
        <span className="text-xs text-muted-foreground">
          {sorted.length} of {sources.length}
        </span>
      </div>

      {sources.length === 0 ? (
        <EmptyState
          title="No sources in this view"
          description="Re-seed the registry to restore the curated list, or add a source by URL."
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No sources match"
          description="No sources match this status and search — clear the filters to see the rest."
        />
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-label="Scrape sources"
          className="overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <table className="w-full text-sm">
            <thead>
              <StudioTableHead>
                <th scope="col" className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selection.allSelected}
                    onCheckedChange={selection.toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <SortHead
                  label="Source"
                  sortKey="name"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Products"
                  sortKey="products"
                  sort={sort}
                  onSort={toggle}
                  numeric
                />
                <SortHead
                  label="Platform"
                  sortKey="platform"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Last run"
                  sortKey="lastRun"
                  sort={sort}
                  onSort={toggle}
                />
                <SortHead
                  label="Enabled"
                  sortKey="enabled"
                  sort={sort}
                  onSort={toggle}
                />
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Verify
                </th>
              </StudioTableHead>
            </thead>
            <tbody>
              {pageRows.map((source) => (
                <StudioRow key={source.id}>
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selection.selected.has(source.id)}
                      onCheckedChange={() => selection.toggle(source.id)}
                      aria-label={`Select ${source.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/studio/scraper/sources/${source.key}`}
                      className="font-medium text-foreground hover:text-sapphire-ink hover:underline"
                    >
                      {source.name}
                    </Link>
                    {source.policyBlocked && (
                      // A source can look perfectly healthy and still never
                      // run, so the reason belongs beside the name rather than
                      // only on the detail page.
                      <Badge
                        variant="outline"
                        className="ms-2 align-middle"
                        title={source.policyBlocked}
                      >
                        {source.policyBadge}
                      </Badge>
                    )}
                    <a
                      href={source.baseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 flex w-fit items-center gap-1 font-mono text-xs text-muted-foreground hover:text-sapphire-ink"
                    >
                      {source.baseUrl.replace(/^https?:\/\//, "")}
                      <ExternalLink aria-hidden className="size-3" />
                    </a>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {SCRAPE_TIER_SHORT[source.tier]} · {source.country}
                      {source.supply ? " · Supply" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <HealthBadge
                      health={source.health}
                      title={
                        source.health === "FAILED"
                          ? (source.lastError ?? undefined)
                          : (source.notes ?? undefined)
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {source.productCount > 0 ? (
                      <>
                        <span className="text-foreground">
                          {source.productCount}
                        </span>
                        {source.pendingCount > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            · {source.pendingCount} new
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={PLATFORM_BADGE[source.platform]}>
                      {source.platform}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {source.lastRunAt ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 px-2 text-xs"
                      onClick={() => handleRowToggle(source)}
                      disabled={togglingId === source.id}
                      aria-pressed={source.enabled}
                      aria-label={
                        source.enabled
                          ? `Disable ${source.name}`
                          : `Enable ${source.name}`
                      }
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 rounded-full",
                          source.enabled ? "bg-success" : "bg-hairline",
                        )}
                      />
                      {source.enabled ? "On" : "Off"}
                    </Button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleVerify(source)}
                      disabled={verifyingId !== null}
                    >
                      {verifyingId === source.id ? "Verifying…" : "Verify"}
                    </Button>
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
        pageSize={pageSize}
        onPageChange={setPage}
        unit="sources"
      />

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={handleBulkReview}
        >
          Mark reviewed
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => handleBulkToggle(true)}
        >
          Enable
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => handleBulkToggle(false)}
        >
          Disable
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          Delete
        </Button>
      </BulkBar>

      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        count={selection.count}
        noun="source"
        onConfirm={handleDelete}
        busy={busy}
        extraWarning="Past scrape jobs keep their history; only the registry entries are removed."
      />
    </>
  );
}
