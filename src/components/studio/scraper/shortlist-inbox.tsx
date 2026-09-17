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
import { Check, ExternalLink } from "lucide-react";
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
import { FieldError } from "@/components/studio/field-error";
import { FieldHint, describedBy } from "@/components/studio/field-hint";
import {
  Pagination,
  PAGE_SIZE,
  usePagination,
} from "@/components/studio/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  SHORTLIST_STATE_DESCRIPTIONS,
  SHORTLIST_STATE_LABELS,
  SHORTLIST_STATE_ORDER,
  SHORTLIST_TRANSITIONS,
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
import { SCRAPE_TIERS, scrapeTierStudioLabel } from "@/lib/scraper/purge";
import { useSelection } from "@/hooks/use-selection";

const STATE_BADGE: Record<
  ShortlistState,
  {
    variant: "default" | "secondary" | "outline" | "success";
    className?: string;
  }
> = {
  NEW: { variant: "outline" },
  REVIEW: { variant: "secondary" },
  SHORTLISTED: { variant: "success" },
  CONFIRMED: { variant: "default" },
  REJECTED: { variant: "secondary", className: "text-muted-foreground" },
  INSPIRATION_ONLY: { variant: "outline" },
  DUPLICATE: { variant: "secondary", className: "text-muted-foreground" },
};

const inr = new Intl.NumberFormat("en-IN");

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatPriceRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min != null && max != null && min !== max) {
    return `₹${inr.format(min)} – ₹${inr.format(max)}`;
  }
  return `₹${inr.format((min ?? max) as number)}`;
}

function StateBadge({ state }: { state: ShortlistState }) {
  const config = STATE_BADGE[state];
  return (
    <Badge variant={config.variant} className={config.className}>
      {SHORTLIST_STATE_LABELS[state]}
    </Badge>
  );
}

/** A transition report's counts — one call's, or several batches' added up. */
type MoveTotals = { moved: number; already: number; blocked: number };

function totalsOf(report: TransitionReport): MoveTotals {
  return {
    moved: report.moved,
    already: report.already,
    blocked: report.blocked.length,
  };
}

function reportToast(
  action: string,
  report: MoveTotals,
  target: ShortlistState,
) {
  const parts = [`${report.moved} ${action}`];
  if (report.already > 0) parts.push(`${report.already} already there`);
  if (report.blocked > 0) {
    parts.push(
      target === ShortlistState.CONFIRMED
        ? `${report.blocked} skipped — only shortlisted items can be confirmed`
        : `${report.blocked} skipped — that move is not allowed from their state`,
    );
  }
  toast.success(parts.join(" · "));
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

// ————————————————————— Detail sheet —————————————————————

function DetailSheetBody({
  row,
  busy,
  onTransition,
  onSave,
  onSaveNote,
  onSaveTags,
}: {
  row: InboxRow;
  busy: boolean;
  onTransition: (target: ShortlistState, reason: string) => Promise<void>;
  onSave: (patch: {
    id: string;
    title: string;
    shortTagline: string | null;
    category: string | null;
    priceMin: number | null;
    priceMax: number | null;
  }) => Promise<void>;
  onSaveNote: (note: string | null) => Promise<void>;
  onSaveTags: (tags: string[]) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.title);
  const [tagline, setTagline] = useState(row.shortTagline ?? "");
  const [category, setCategory] = useState(row.category ?? "");
  const [priceMin, setPriceMin] = useState(
    row.priceMin != null ? String(row.priceMin) : "",
  );
  const [priceMax, setPriceMax] = useState(
    row.priceMax != null ? String(row.priceMax) : "",
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    tagline?: string;
    category?: string;
    priceMin?: string;
    priceMax?: string;
  }>({});
  const [note, setNote] = useState(row.note ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [tagsText, setTagsText] = useState(row.tags.join(", "));
  const [savingTags, setSavingTags] = useState(false);
  const [reason, setReason] = useState(row.reason ?? "");
  // Edit-before-import locks once the twin is in the catalog — the same rule
  // the old queue enforced on IMPORTED rows.
  const locked = row.twinImported;

  const ids = {
    title: `edit-title-${row.researchProductId}`,
    tagline: `edit-tagline-${row.researchProductId}`,
    category: `edit-category-${row.researchProductId}`,
    priceMin: `edit-min-${row.researchProductId}`,
    priceMax: `edit-max-${row.researchProductId}`,
    note: `edit-note-${row.researchProductId}`,
    tags: `edit-tags-${row.researchProductId}`,
    reason: `move-reason-${row.researchProductId}`,
  } as const;
  type EditKey = keyof typeof errors;

  function clear(key: EditKey) {
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  function a11y(key: EditKey) {
    return {
      "aria-invalid": errors[key] ? true : undefined,
      "aria-describedby": describedBy(errors[key] && `${ids[key]}-error`),
    };
  }

  async function handleSave() {
    // The bounds `editSchema` in actions/scraper-review.ts enforces (title
    // 1–300, tagline ≤ 500, category ≤ 200, prices whole non-negative
    // rupees), named under the field; plus min ≤ max, which the action does
    // not check and a listing cannot sensibly violate.
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = "Title is required.";
    else if (title.trim().length > 300)
      problems.title = "Keep the title under 300 characters.";
    if (tagline.trim().length > 500)
      problems.tagline = "Keep the tagline under 500 characters.";
    if (category.trim().length > 200)
      problems.category = "Keep the category under 200 characters.";
    const rawMin = priceMin.trim() === "" ? null : Number(priceMin);
    const rawMax = priceMax.trim() === "" ? null : Number(priceMax);
    const price = "Enter a whole number of rupees, zero or more.";
    if (rawMin != null && (!Number.isFinite(rawMin) || rawMin < 0))
      problems.priceMin = price;
    if (rawMax != null && (!Number.isFinite(rawMax) || rawMax < 0))
      problems.priceMax = price;
    if (
      !problems.priceMin &&
      !problems.priceMax &&
      rawMin != null &&
      rawMax != null &&
      rawMin > rawMax
    )
      problems.priceMax = "The maximum is below the minimum.";
    setErrors(problems);
    const first = (
      ["title", "tagline", "category", "priceMin", "priceMax"] as const
    ).find((key) => problems[key]);
    if (first) {
      document.getElementById(ids[first])?.focus();
      return;
    }
    if (!row.twinId) return;
    const min = rawMin == null ? null : Math.round(rawMin);
    const max = rawMax == null ? null : Math.round(rawMax);
    setSaving(true);
    await onSave({
      id: row.twinId,
      title: title.trim(),
      shortTagline: tagline.trim() || null,
      category: category.trim() || null,
      priceMin: min,
      priceMax: max,
    });
    setSaving(false);
  }

  async function handleSaveNote() {
    setSavingNote(true);
    await onSaveNote(note.trim() || null);
    setSavingNote(false);
  }

  async function handleSaveTags() {
    setSavingTags(true);
    await onSaveTags(
      tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    );
    setSavingTags(false);
  }

  const targets = SHORTLIST_TRANSITIONS[row.state];

  return (
    <SheetContent side="right" className="w-full gap-0 sm:max-w-lg">
      <SheetHeader className="pr-10">
        <SheetTitle className="text-lg leading-snug">{row.title}</SheetTitle>
        <SheetDescription>
          {row.sourceName} · {formatPriceRange(row.priceMin, row.priceMax)} ·
          last seen {dateFormatter.format(row.lastSeen)}
        </SheetDescription>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary" title="Source website">
            {row.sourceName}
          </Badge>
          {row.category && <Badge variant="secondary">{row.category}</Badge>}
          <Badge variant="outline">{row.vertical}</Badge>
          <StateBadge state={row.state} />
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-4">
        {/* Funnel move — the state machine decides which buttons exist. */}
        <div className="space-y-3 rounded-card border border-border p-3">
          <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
            Move through the funnel
          </h3>
          <p className="text-xs text-muted-foreground">
            {SHORTLIST_STATE_DESCRIPTIONS[row.state]}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor={ids.reason} className="text-xs">
              Reason (optional, recorded with the move)
            </Label>
            <Input
              id={ids.reason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. duplicate of the Pepperfry listing"
              maxLength={500}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {targets.map((target) => (
              <Button
                key={target}
                size="sm"
                variant={
                  target === ShortlistState.CONFIRMED ? "default" : "outline"
                }
                disabled={busy}
                title={SHORTLIST_STATE_DESCRIPTIONS[target]}
                onClick={() => onTransition(target, reason.trim())}
              >
                {target === ShortlistState.CONFIRMED && <Check />}
                {SHORTLIST_STATE_LABELS[target]}
              </Button>
            ))}
          </div>
          {row.changedAt && (
            <p className="text-xs text-muted-foreground">
              Last moved {dateFormatter.format(row.changedAt)}
              {row.reason ? ` — ${row.reason}` : ""}
            </p>
          )}
        </div>

        {/* Inline edit — curate the staged data before it imports as a draft. */}
        {row.twinId && (
          <div className="space-y-3 rounded-card border border-border p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
                Edit before import
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={locked || saving || busy}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.title} className="text-xs">
                Title
              </Label>
              <Input
                id={ids.title}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clear("title");
                }}
                disabled={locked}
                {...a11y("title")}
              />
              <FieldError id={`${ids.title}-error`}>{errors.title}</FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.tagline} className="text-xs">
                Tagline
              </Label>
              <Input
                id={ids.tagline}
                value={tagline}
                onChange={(e) => {
                  setTagline(e.target.value);
                  clear("tagline");
                }}
                disabled={locked}
                {...a11y("tagline")}
              />
              <FieldError id={`${ids.tagline}-error`}>
                {errors.tagline}
              </FieldError>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.category} className="text-xs">
                Category (source label)
              </Label>
              <Input
                id={ids.category}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  clear("category");
                }}
                disabled={locked}
                {...a11y("category")}
              />
              <FieldError id={`${ids.category}-error`}>
                {errors.category}
              </FieldError>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor={ids.priceMin} className="text-xs">
                  Price min (₹)
                </Label>
                <Input
                  id={ids.priceMin}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={priceMin}
                  onChange={(e) => {
                    setPriceMin(e.target.value);
                    clear("priceMin");
                  }}
                  disabled={locked}
                  {...a11y("priceMin")}
                />
                <FieldError id={`${ids.priceMin}-error`}>
                  {errors.priceMin}
                </FieldError>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={ids.priceMax} className="text-xs">
                  Price max (₹)
                </Label>
                <Input
                  id={ids.priceMax}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={priceMax}
                  onChange={(e) => {
                    setPriceMax(e.target.value);
                    clear("priceMax");
                  }}
                  disabled={locked}
                  {...a11y("priceMax")}
                />
                <FieldError id={`${ids.priceMax}-error`}>
                  {errors.priceMax}
                </FieldError>
              </div>
            </div>
          </div>
        )}

        {/* Reviewer note — lives on the entry now, not the staged row. */}
        <div className="space-y-2 rounded-card border border-border p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
              Reviewer note
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveNote}
              disabled={savingNote || busy}
            >
              {savingNote ? "Saving…" : "Save"}
            </Button>
          </div>
          <Textarea
            id={ids.note}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything worth flagging for the next look…"
            aria-label="Reviewer note"
            aria-describedby={`${ids.note}-hint`}
            rows={3}
            maxLength={4000}
          />
          <FieldHint id={`${ids.note}-hint`}>
            Up to 4,000 characters. Your words about the listing — never the
            source&apos;s data.
          </FieldHint>
        </div>

        {/* Tags — the owner's own labels, exported with the confirmed list. */}
        <div className="space-y-2 rounded-card border border-border p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-12 font-medium uppercase tracking-wider text-muted-foreground">
              Tags
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveTags}
              disabled={savingTags || busy}
            >
              {savingTags ? "Saving…" : "Save"}
            </Button>
          </div>
          <Input
            id={ids.tags}
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="large-format, diwali-benchmark"
            aria-label="Tags"
            aria-describedby={`${ids.tags}-hint`}
          />
          <FieldHint id={`${ids.tags}-hint`}>
            Comma-separated, up to 20. Exported with the confirmed list.
          </FieldHint>
        </div>

        {row.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {row.images.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- scraped images live on arbitrary hosts; never next/image
              <img
                key={`${url}-${i}`}
                src={url}
                alt={row.imageAlts[i] ?? row.title}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="size-20 shrink-0 rounded-lg bg-muted object-cover"
              />
            ))}
          </div>
        )}

        {row.shortTagline && (
          <p className="text-sm font-medium text-foreground">
            {row.shortTagline}
          </p>
        )}

        {row.description && (
          <div>
            <h3 className="mb-1 text-12 font-medium uppercase tracking-wider text-muted-foreground">
              Description
            </h3>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {row.description}
            </p>
          </div>
        )}

        {(row.materials || row.dimensions || row.timeline) && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            {row.materials && (
              <>
                <dt className="text-muted-foreground">Materials</dt>
                <dd className="text-foreground">{row.materials}</dd>
              </>
            )}
            {row.dimensions && (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd className="text-foreground">{row.dimensions}</dd>
              </>
            )}
            {row.timeline && (
              <>
                <dt className="text-muted-foreground">Timeline</dt>
                <dd className="text-foreground">{row.timeline}</dd>
              </>
            )}
          </dl>
        )}

        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-sapphire-ink hover:underline"
        >
          View on {row.sourceName}
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </div>

      <SheetFooter className="flex-row justify-end gap-2 border-t border-border">
        {targets.slice(0, 2).map((target) => (
          <Button
            key={target}
            variant={
              target === ShortlistState.CONFIRMED ? "default" : "outline"
            }
            size="sm"
            disabled={busy}
            onClick={() => onTransition(target, reason.trim())}
          >
            {SHORTLIST_STATE_LABELS[target]}
          </Button>
        ))}
      </SheetFooter>
    </SheetContent>
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
      reportToast(
        target === ShortlistState.CONFIRMED ? "confirmed" : "moved",
        totalsOf(res.data),
        target,
      );
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
      reportToast(
        target === ShortlistState.CONFIRMED ? "confirmed" : "moved",
        totals,
        target,
      );
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
            {SCRAPE_TIERS.map((tier) => (
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
