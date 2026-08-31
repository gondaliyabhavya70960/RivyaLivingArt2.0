"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import { StudioRow } from "@/components/studio/studio-row";
import { useRouter } from "next/navigation";
import {
  Download,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sheet,
} from "lucide-react";
import { toast } from "sonner";

import {
  continueScrapeJob,
  createScrapeJob,
  type ScrapeJobSnapshot,
} from "@/actions/scraper-jobs";
import { sendScrapedToSheet1 } from "@/actions/scraper-review";
import {
  resumeScrapeSource,
  setSheetSyncPolicy,
  verifyScrapeSource,
} from "@/actions/scraper-sources";
import { BulkBar } from "@/components/studio/bulk-bar";
import { EmptyState } from "@/components/studio/page-header";
import { Pagination, PAGE_SIZE, usePagination } from "@/components/studio/pagination";
import {
  AddToCatalogDialog,
  type AddToCatalogItem,
} from "@/components/studio/scraper/add-to-catalog-dialog";
import { SortHead, useSort } from "@/components/studio/sort-header";
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
import type {
  ReviewStatus,
  ScrapeJobStatus,
  ScrapePlatform,
  ScrapeTier,
  SheetSyncPolicy,
} from "@/generated/prisma/enums";
import { useSelection } from "@/hooks/use-selection";
import { HEALTH_META, type SourceHealth } from "@/lib/scraper/health";
import { SHEET_POLICY_LABEL } from "@/lib/scraper/sheet-policy";
import { cn } from "@/lib/utils";

export type SourceInfo = {
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
  health: SourceHealth;
  notes: string | null;
  verifiedAt: string | null;
  /** When completed scrapes of this source reach the Google Sheet. */
  sheetSyncPolicy: SheetSyncPolicy;
  /** Circuit breaker: set when repeated failures paused this source. */
  pausedReason: string | null;
  consecutiveFailures: number;
  lastSheetSyncAt: string | null;
  lastSheetSyncError: string | null;
};

export type JobHistoryRow = {
  id: string;
  status: ScrapeJobStatus;
  platform: ScrapePlatform;
  cursorPage: number;
  totalScraped: number;
  newCount: number;
  updatedCount: number;
  error: string | null;
  createdAt: string;
  createdAtTs: number;
  finishedAt: string | null;
};

export type DetailProductRow = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  /** Free-text category from the source site. */
  category: string | null;
  /** Auto-mapped catalog category id (null when nothing matched). */
  mappedCategoryId: string | null;
  priceLabel: string;
  priceSort: number | null;
  /** Most recent recorded price move, e.g. "₹799 → ₹849". Null = never moved. */
  priceMove: string | null;
  reviewStatus: ReviewStatus;
  lastSeen: string;
  lastSeenTs: number;
};

const PLATFORM_BADGE: Record<
  ScrapePlatform,
  "default" | "secondary" | "outline"
> = {
  SHOPIFY: "default",
  WOOCOMMERCE: "secondary",
  JSONLD: "secondary",
  UNKNOWN: "outline",
};

const TIER_LABELS: Record<ScrapeTier, string> = {
  OWNER: "Tier 1 — Owner",
  RESIN_GOODS: "Tier 2 — Resin goods",
  SUPPLIES: "Tier 3 — Supplies",
  PRINT3D: "Tier 4 — 3D print",
};

function JobStatusBadge({ status }: { status: ScrapeJobStatus }) {
  switch (status) {
    case "QUEUED":
      return <Badge variant="outline">Queued</Badge>;
    case "RUNNING":
      return (
        <Badge>
          <Loader2 className="animate-spin" aria-hidden /> Running
        </Badge>
      );
    case "DONE":
      return <Badge variant="secondary">Done</Badge>;
    case "FAILED":
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Failed
        </Badge>
      );
  }
}

const REVIEW_BADGE: Record<
  ReviewStatus,
  { variant: "default" | "secondary" | "outline"; className?: string }
> = {
  PENDING: { variant: "outline" },
  APPROVED: { variant: "outline", className: "border-success/40 text-success" },
  REJECTED: { variant: "secondary", className: "text-muted-foreground" },
  IMPORTED: { variant: "default" },
};

const REVIEW_FILTERS: { value: ReviewStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All products" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "IMPORTED", label: "Imported" },
];

export function SourceDetail({
  source,
  jobs,
  products,
  totalProducts,
  categories,
}: {
  source: SourceInfo;
  jobs: JobHistoryRow[];
  products: DetailProductRow[];
  /** True total staged count (products[] is capped for rendering). */
  totalProducts: number;
  /** Catalog categories for the "Add to catalog" import dialog. */
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [progress, setProgress] = useState<ScrapeJobSnapshot | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sendingSheet, setSendingSheet] = useState(false);
  // Per-row catalog category overrides (row id → category id). Defaults fall
  // back to each row's auto-mapped category until the operator changes it.
  const [catOverrides, setCatOverrides] = useState<Record<string, string>>({});

  // Guards the poll loop against a component unmount mid-scrape — without it
  // the detached loop keeps polling and calling router.refresh on whatever
  // page the operator navigated to.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const [policy, setPolicy] = useState<SheetSyncPolicy>(source.sheetSyncPolicy);
  const [policyBusy, setPolicyBusy] = useState(false);

  const [resuming, setResuming] = useState(false);

  async function handleResume() {
    setResuming(true);
    const res = await resumeScrapeSource(source.id);
    setResuming(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${source.name} resumed.`);
    router.refresh();
  }

  async function handlePolicy(next: SheetSyncPolicy) {
    const previous = policy;
    setPolicy(next); // optimistic — a select that lags feels broken
    setPolicyBusy(true);
    const res = await setSheetSyncPolicy(source.id, next);
    setPolicyBusy(false);
    if (!res.ok) {
      setPolicy(previous);
      toast.error(res.error);
      return;
    }
    toast.success(
      next === "ON_COMPLETE"
        ? `${source.name} will push to the sheet when a scrape finishes.`
        : next === "MANUAL"
          ? `${source.name} will stage rows and wait for you to add them.`
          : `${source.name} will not touch the sheet.`,
    );
  }

  async function handleRun() {
    setRunning(true);
    setProgress(null);
    const res = await createScrapeJob({ sourceId: source.id, tier: source.tier });
    if (!aliveRef.current) return;
    if (!res.ok || !res.data) {
      toast.error(!res.ok ? res.error : "Could not start the scrape.");
      setRunning(false);
      return;
    }
    const jobId = res.data.jobId;
    if (res.data.alreadyRunning) {
      // Not an error — the guard handed us the run already in flight, and the
      // loop below picks it up from wherever it had got to.
      toast.info(`${source.name} was already being scraped — showing that run.`);
    }
    for (;;) {
      const step = await continueScrapeJob(jobId);
      if (!aliveRef.current) return; // unmounted — stop polling
      if (!step.ok || !step.data) {
        toast.error(!step.ok ? step.error : "Scrape run failed.");
        break;
      }
      setProgress(step.data);
      if (step.data.status === "DONE") {
        toast.success(
          `Scrape finished — ${step.data.totalScraped} products (${step.data.newCount} new).`,
        );
        break;
      }
      if (step.data.status === "FAILED") {
        toast.error(step.data.error ?? "Scrape failed.");
        break;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setRunning(false);
    router.refresh();
  }

  async function handleVerify() {
    setVerifying(true);
    const res = await verifyScrapeSource(source.id);
    setVerifying(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.data?.platform === "UNKNOWN") {
      toast.warning(`No supported platform — ${source.name} disabled.`);
    } else {
      toast.success(`Verified as ${res.data?.platform}.`);
    }
    router.refresh();
  }

  // ————— Products table: search + review-status filter + sort —————
  const [query, setQuery] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewStatus | "ALL">("ALL");

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (reviewFilter !== "ALL" && p.reviewStatus !== reviewFilter) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, reviewFilter]);

  const getProductValue = useCallback((row: DetailProductRow, key: string) => {
    switch (key) {
      case "title":
        return row.title.toLowerCase();
      case "category":
        return row.category?.toLowerCase() ?? null;
      case "price":
        return row.priceSort;
      case "review":
        return row.reviewStatus;
      case "lastSeen":
        return row.lastSeenTs;
      default:
        return null;
    }
  }, []);

  const {
    sorted: sortedProducts,
    sort: productSort,
    toggle: toggleProduct,
  } = useSort(filteredProducts, getProductValue, { key: "lastSeen", dir: "desc" });

  const {
    pageRows: productPage,
    page: prodPageNum,
    setPage: setProdPage,
    pageCount: prodPageCount,
    total: prodTotal,
    pageSize: prodPageSize,
  } = usePagination(sortedProducts, PAGE_SIZE, `${query}|${reviewFilter}`);

  // Select-to-import — scoped to the visible product page.
  const productIds = useMemo(() => productPage.map((p) => p.id), [productPage]);
  const selection = useSelection(productIds);

  // The catalog category chosen for a row: operator override → auto-map → none.
  const categoryFor = useCallback(
    (row: DetailProductRow): string =>
      catOverrides[row.id] ?? row.mappedCategoryId ?? "",
    [catOverrides],
  );

  // Selected rows paired with their resolved category, for the confirm dialog.
  const selectedItems = useMemo<AddToCatalogItem[]>(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    return selection.ids.map((id) => {
      const row = byId.get(id);
      return {
        id,
        title: row?.title ?? id,
        categoryId: row ? categoryFor(row) || null : null,
      };
    });
  }, [selection.ids, products, categoryFor]);

  // Link the selected products into the Google Sheet's Sheet1 tab (bulk-upload
  // format) without importing them into the catalog. Env-gated on the server.
  async function handleSendToSheet() {
    const items = selectedItems
      .filter((it) => it.categoryId)
      .map((it) => ({ id: it.id, categoryId: it.categoryId as string }));
    if (items.length === 0) {
      toast.error("Give the selected products a catalog category first.");
      return;
    }
    setSendingSheet(true);
    const res = await sendScrapedToSheet1({ items, mirrorImages: false });
    setSendingSheet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const report = res.data;
    if (!report) return;
    if (!report.configured) {
      toast.info(
        "Google Sheet sync isn't configured — set the service account + sheet id in the deployment env to enable Sheet1 linking.",
      );
      return;
    }
    const parts = [`${report.synced} linked to Sheet1`];
    if (report.skipped > 0) parts.push(`${report.skipped} skipped`);
    toast.success(`${parts.join(" · ")}.`);
  }

  // ————— Jobs table: sort —————
  const getJobValue = useCallback((row: JobHistoryRow, key: string) => {
    switch (key) {
      case "status":
        return row.status;
      case "pages":
        return row.cursorPage;
      case "total":
        return row.totalScraped;
      case "created":
        return row.createdAtTs;
      default:
        return null;
    }
  }, []);

  const {
    sorted: sortedJobs,
    sort: jobSort,
    toggle: toggleJob,
  } = useSort(jobs, getJobValue, { key: "created", dir: "desc" });

  const {
    pageRows: jobPage,
    page: jobPageNum,
    setPage: setJobPage,
    pageCount: jobPageCount,
    total: jobTotal,
    pageSize: jobPageSize,
  } = usePagination(sortedJobs, PAGE_SIZE);

  const meta = HEALTH_META[source.health];

  return (
    <div className="space-y-6">
      {/* Meta + actions */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("gap-1.5", meta.className)}>
                <span aria-hidden className={cn("size-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </Badge>
              <Badge variant={PLATFORM_BADGE[source.platform]}>
                {source.platform}
              </Badge>
              <Badge variant="outline">{TIER_LABELS[source.tier]}</Badge>
              {source.supply && <Badge variant="outline">Supply</Badge>}
              <span className="text-xs text-muted-foreground">{source.country}</span>
            </div>
            <a
              href={source.baseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1 font-mono text-sm text-muted-foreground hover:text-sapphire-ink"
            >
              {source.baseUrl.replace(/^https?:\/\//, "")}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
            {source.notes && (
              <p className="max-w-prose text-sm text-muted-foreground">{source.notes}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {source.verifiedAt
                ? `Platform verified ${source.verifiedAt}`
                : "Not yet verified"}
              {" · "}
              {source.enabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          {source.pausedReason && (
            <div
              role="status"
              className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-alert/40 bg-alert/5 p-3 text-sm"
            >
              <span className="flex-1 text-foreground">
                {source.pausedReason}
              </span>
              <Button size="sm" onClick={handleResume} disabled={resuming}>
                {resuming ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : null}
                Resume
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleRun} disabled={running}>
              {running ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden /> Scraping…
                </>
              ) : (
                <>
                  {/* The button names the source it will scrape. On a page that
                      can be reached from a list of a dozen suppliers, "Run
                      scrape" does not say which one — and a screenshot of the
                      wrong run then explains nothing. */}
                  <Play /> Scrape {source.name}
                </>
              )}
            </Button>
            {/* The owner's "push automatically, but when I say so", as a
                setting rather than a second button: one engine, three
                triggers. MANUAL is the default and is what the code did
                before this existed. */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sheet</span>
              <Select
                value={policy}
                disabled={policyBusy}
                onValueChange={(v) => void handlePolicy(v as SheetSyncPolicy)}
              >
                <SelectTrigger
                  className="h-9 w-[190px]"
                  aria-label={`When to push ${source.name} to the Google Sheet`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(SHEET_POLICY_LABEL) as SheetSyncPolicy[]
                  ).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SHEET_POLICY_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying}
            >
              <RefreshCw className={verifying ? "animate-spin" : undefined} /> Verify
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/scraper/export?source=${source.key}`}>
                <Download /> CSV
              </a>
            </Button>
          </div>
        </div>
        {running && progress && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-sand bg-sand px-3 py-2 text-sm text-sapphire-ink"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Page {progress.cursorPage} · {progress.totalScraped} products so far…
          </div>
        )}
      </section>

      {/* Products scraped from this source */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-foreground">
            Scraped products{" "}
            <span className="text-sm text-muted-foreground">({totalProducts})</span>
            {products.length < totalProducts && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                showing latest {products.length}
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={reviewFilter}
              onValueChange={(v) => setReviewFilter(v as ReviewStatus | "ALL")}
            >
              <SelectTrigger size="sm" aria-label="Filter by review status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVIEW_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="h-9 w-52"
            />
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            title="Nothing scraped yet"
            description="Run a scrape above — products staged from this source appear here."
          />
        ) : sortedProducts.length === 0 ? (
          <EmptyState
            title="No products match"
            description="Clear the review-status filter or search to see the rest."
          />
        ) : (
          <div
              tabIndex={0}
              role="region"
              aria-label="Scraped products"
              className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <th scope="col" className="w-12 px-4 py-3">
                    <Checkbox
                      checked={selection.allSelected}
                      onCheckedChange={selection.toggleAll}
                      aria-label="Select all products"
                    />
                  </th>
                  <th scope="col" className="w-14 px-4 py-3">
                    <span className="sr-only">Image</span>
                  </th>
                  <SortHead label="Title" sortKey="title" sort={productSort} onSort={toggleProduct} />
                  <SortHead label="Source category" sortKey="category" sort={productSort} onSort={toggleProduct} />
                  <th scope="col" className="px-4 py-3 font-medium">
                    Catalog category
                  </th>
                  <SortHead label="Price" sortKey="price" sort={productSort} onSort={toggleProduct} numeric />
                  <SortHead label="Review" sortKey="review" sort={productSort} onSort={toggleProduct} />
                  <SortHead label="Last seen" sortKey="lastSeen" sort={productSort} onSort={toggleProduct} />
                </StudioTableHead>
              </thead>
              <tbody>
                {productPage.map((p) => {
                  const badge = REVIEW_BADGE[p.reviewStatus];
                  return (
                    <StudioRow
                      key={p.id}
                    >
                      <td className="px-4 py-2">
                        <Checkbox
                          checked={selection.selected.has(p.id)}
                          onCheckedChange={() => selection.toggle(p.id)}
                          aria-label={`Select ${p.title}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- scraped images on arbitrary hosts; never next/image
                          <img
                            src={p.image}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="size-10 rounded-md bg-muted object-cover"
                          />
                        ) : (
                          <div aria-hidden className="size-10 rounded-md bg-muted" />
                        )}
                      </td>
                      <td className="max-w-[22rem] px-4 py-2">
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 font-medium text-foreground hover:text-sapphire-ink"
                        >
                          {p.title}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {p.category ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={categoryFor(p)}
                          onValueChange={(v) =>
                            setCatOverrides((prev) => ({ ...prev, [p.id]: v }))
                          }
                          disabled={p.reviewStatus === "IMPORTED"}
                        >
                          <SelectTrigger
                            size="sm"
                            aria-label={`Catalog category for ${p.title}`}
                            className="w-44"
                          >
                            <SelectValue placeholder="Choose…" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {p.priceLabel}
                        {/* The last recorded move, when there is one. A price
                            that has held since the first scrape shows nothing
                            rather than a reassuring but meaningless "no
                            change". */}
                        {p.priceMove && (
                          <span className="block text-12 text-sapphire-ink">
                            {p.priceMove}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={badge.variant} className={badge.className}>
                          {p.reviewStatus.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                        {p.lastSeen}
                      </td>
                    </StudioRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={prodPageNum}
          pageCount={prodPageCount}
          total={prodTotal}
          pageSize={prodPageSize}
          onPageChange={setProdPage}
          unit="products"
        />
      </section>

      {/* Run history */}
      <section className="space-y-3">
        <h2 className="font-display text-lg text-foreground">
          Run history{" "}
          <span className="text-sm text-muted-foreground">({jobs.length})</span>
        </h2>
        {jobs.length === 0 ? (
          <EmptyState
            title="No runs yet"
            description="This source has never been scraped. Run a scrape above to start."
          />
        ) : (
          <div
              tabIndex={0}
              role="region"
              aria-label="Scrape run history"
              className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
            <table className="w-full text-sm">
              <thead>
                <StudioTableHead>
                  <SortHead label="Status" sortKey="status" sort={jobSort} onSort={toggleJob} />
                  <SortHead label="Pages" sortKey="pages" sort={jobSort} onSort={toggleJob} numeric />
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Total / new / upd
                  </th>
                  <SortHead label="Started" sortKey="created" sort={jobSort} onSort={toggleJob} />
                  <th scope="col" className="px-4 py-3 font-medium">
                    Error
                  </th>
                </StudioTableHead>
              </thead>
              <tbody>
                {jobPage.map((job) => (
                  <StudioRow
                    key={job.id}
                  >
                    <td className="px-4 py-3">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{job.cursorPage}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {job.totalScraped} / {job.newCount} / {job.updatedCount}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {job.createdAt}
                    </td>
                    <td className="max-w-[18rem] px-4 py-3">
                      {job.error ? (
                        <span
                          className="block truncate text-xs text-destructive"
                          title={job.error}
                        >
                          {job.error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </StudioRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={jobPageNum}
          pageCount={jobPageCount}
          total={jobTotal}
          pageSize={jobPageSize}
          onPageChange={setJobPage}
          unit="runs"
        />
      </section>

      <BulkBar count={selection.count} onClear={selection.clear}>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSendToSheet}
          disabled={sendingSheet}
        >
          {sendingSheet ? (
            <>
              <Loader2 className="animate-spin" aria-hidden /> Sending…
            </>
          ) : (
            <>
              <Sheet aria-hidden /> Send to Sheet1
            </>
          )}
        </Button>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          Add to catalog
        </Button>
      </BulkBar>

      <AddToCatalogDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        items={selectedItems}
        categories={categories}
        onDone={() => {
          selection.clear();
          setCatOverrides({});
          router.refresh();
        }}
      />
    </div>
  );
}
