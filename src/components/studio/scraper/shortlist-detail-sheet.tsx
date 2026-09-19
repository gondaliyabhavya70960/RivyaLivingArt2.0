"use client";

/**
 * The shortlist detail sheet — one drawer, both views.
 *
 * Extracted from the review inbox when the Kanban board arrived (PR-4): the
 * funnel move with its reason, edit-before-import, the reviewer note and the
 * owner's tags live here, and the grid and the board open the SAME sheet so
 * a row's detail can never drift between the two views. Behaviour is
 * unchanged from the inbox's original `DetailSheetBody` — the extraction is
 * mechanical on purpose.
 */

import { useState } from "react";
import { Check, ExternalLink } from "lucide-react";

import { FieldError } from "@/components/studio/field-error";
import { FieldHint, describedBy } from "@/components/studio/field-hint";
import {
  StateBadge,
  dateFormatter,
  formatPriceRange,
} from "@/components/studio/scraper/shortlist-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
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
  SHORTLIST_TRANSITIONS,
  ShortlistState,
} from "@/lib/scraper/shortlist";
import type { InboxRow } from "@/lib/scraper/shortlist-query";

export function DetailSheetBody({
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
