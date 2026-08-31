"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  resetCopyGroup,
  resetSiteCopy,
  setSiteCopy,
} from "@/actions/site-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharCounter } from "@/components/ui/char-counter";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CopyGroup, CopyKind, CopyTier } from "@/lib/site-copy";
import { cn } from "@/lib/utils";

export type CopyRow = {
  key: string;
  label: string;
  where?: string;
  kind: CopyKind;
  tier: CopyTier;
  max?: number;
  note?: string;
  vars?: string[];
  tags?: string[];
  /** The shipped default for this locale — what Reset returns to. */
  fallback: string;
  /** What the storefront renders right now. */
  current: string;
  overridden: boolean;
  /** Staged but not yet published — a visitor is still reading the old words. */
  unpublished: boolean;
};

export type CopySectionRows = { section: string; rows: CopyRow[] };

type LocaleOption = { code: string; label: string; changed: number };

/** Multi-line kinds get a textarea; the rest a single-line input. */
const MULTILINE: ReadonlySet<CopyKind> = new Set(["body", "meta", "alt"]);

/**
 * The Site Copy board — one row per editable string, grouped by the section of
 * the page it belongs to.
 *
 * The words are the control: each row shows what the storefront renders right
 * now, and the shipped default sits under the field while editing so the owner
 * can always tell whether they are improving the copy or retyping it.
 * "Default" vs "Changed" is a badge and not a colour alone, and Reset is only
 * enabled where it would actually do something.
 *
 * No `useEffect` anywhere: the repo lints for `react-hooks/set-state-in-effect`
 * and a field editor is exactly the shape that provokes it. Draft state exists
 * only while a row is open and is seeded in the click handler that opens it;
 * after a save the row closes and re-reads its value from the refreshed props.
 */
export function SiteCopyBoard({
  group,
  groups,
  locale,
  locales,
  sections,
  canResetGroup,
}: {
  group: CopyGroup;
  groups: readonly CopyGroup[];
  locale: string;
  locales: readonly LocaleOption[];
  sections: readonly CopySectionRows[];
  /** Resetting a whole surface is ADMIN-only, matching the action's guard. */
  canResetGroup: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [showInterface, setShowInterface] = useState(false);
  const [resetting, setResetting] = useState(false);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sections
      .map((section) => ({
        section: section.section,
        rows: section.rows.filter((row) => {
          if (!showInterface && row.tier === "interface") return false;
          if (onlyChanged && !row.overridden) return false;
          if (!needle) return true;
          // Search the words themselves, not just the labels — an owner looks
          // for the sentence they can see on the site, not for our name for it.
          return (
            row.current.toLowerCase().includes(needle) ||
            row.label.toLowerCase().includes(needle) ||
            row.key.toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((section) => section.rows.length > 0);
  }, [sections, query, onlyChanged, showInterface]);

  const totalShown = visible.reduce((n, s) => n + s.rows.length, 0);
  const changedHere = sections
    .flatMap((s) => s.rows)
    .filter((r) => r.overridden).length;

  async function runGroupReset() {
    const keys = sections.flatMap((s) => s.rows.map((r) => r.key));
    setResetting(true);
    const res = await resetCopyGroup({ keys, locale });
    setResetting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data?.removed
        ? `${res.data.removed} field${res.data.removed === 1 ? "" : "s"} back to the shipped wording.`
        : "Nothing to reset — every field is already the default.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* ————— surface + language ————— */}
      <div className="space-y-4">
        <nav aria-label="Surface" className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <Link
              key={g}
              href={`/studio/site-copy?group=${encodeURIComponent(g)}&locale=${locale}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-small transition-colors",
                g === group
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-graphite hover:border-foreground hover:text-foreground",
              )}
              aria-current={g === group ? "page" : undefined}
            >
              {g}
            </Link>
          ))}
        </nav>

        <nav aria-label="Language" className="flex flex-wrap gap-1.5">
          {locales.map((l) => (
            <Link
              key={l.code}
              href={`/studio/site-copy?group=${encodeURIComponent(group)}&locale=${l.code}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-small transition-colors",
                l.code === locale
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-graphite hover:border-foreground hover:text-foreground",
              )}
              aria-current={l.code === locale ? "page" : undefined}
            >
              {l.label}
              <span className="ms-2 text-xs tabular-nums opacity-70">
                {l.changed}
              </span>
            </Link>
          ))}
        </nav>
        <p className="max-w-[70ch] text-small leading-relaxed text-graphite">
          The number beside each language is how many fields have been changed
          from the wording that ships with the site. Edit English first — when
          you improve an English line, the other eight still say the old thing
          until you come back to them.
        </p>
      </div>

      {/* ————— filters ————— */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-4">
        <div className="min-w-56 flex-1">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the words themselves…"
            aria-label="Search copy"
          />
        </div>
        <label className="flex items-center gap-2 text-small text-foreground">
          <Checkbox
            checked={onlyChanged}
            onCheckedChange={(v) => setOnlyChanged(v === true)}
          />
          Only changed
          <span className="tabular-nums text-graphite">({changedHere})</span>
        </label>
        <label className="flex items-center gap-2 text-small text-foreground">
          <Checkbox
            checked={showInterface}
            onCheckedChange={(v) => setShowInterface(v === true)}
          />
          Show interface strings
        </label>
        {canResetGroup && changedHere > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={runGroupReset}
            disabled={resetting}
          >
            {resetting ? (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            ) : (
              <RotateCcw aria-hidden className="size-4" />
            )}
            Reset this surface
          </Button>
        )}
      </div>

      {totalShown === 0 ? (
        <p className="py-12 text-center text-small text-graphite">
          Nothing here matches those filters.
        </p>
      ) : (
        visible.map((section) => (
          <section
            key={section.section}
            aria-labelledby={`sec-${section.section}`}
          >
            <h2
              id={`sec-${section.section}`}
              className="mb-4 border-b border-border pb-2 font-display text-25 text-foreground"
            >
              {humanise(section.section)}
            </h2>
            <ul className="divide-y divide-border">
              {section.rows.map((row) => (
                <CopyRowItem key={row.key} row={row} locale={locale} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function humanise(section: string) {
  const spaced = section
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function CopyRowItem({ row, locale }: { row: CopyRow; locale: string }) {
  const router = useRouter();
  // `draft === null` means the row is closed. Opening seeds it from the
  // current value in the click handler — never in an effect.
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const max = row.max ?? 200;
  const multiline = MULTILINE.has(row.kind);

  async function save() {
    if (draft === null) return;
    setBusy(true);
    const res = await setSiteCopy({ key: row.key, locale, value: draft });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    toast.success(
      draft.trim() ? `${row.label} updated.` : `${row.label} back to default.`,
    );
    router.refresh();
  }

  async function reset() {
    setBusy(true);
    const res = await resetSiteCopy({ key: row.key, locale });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    toast.success(`${row.label} back to the shipped wording.`);
    router.refresh();
  }

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-small font-medium text-foreground">
              {row.label}
            </span>
            <Badge variant={row.overridden ? "default" : "secondary"}>
              {row.overridden ? "Changed" : "Default"}
            </Badge>
            {row.unpublished && <Badge variant="outline">Not published</Badge>}
            {row.tier === "interface" && (
              <Badge variant="outline">Interface</Badge>
            )}
          </div>
          {row.where && (
            <p className="mt-0.5 text-xs text-graphite">{row.where}</p>
          )}
          {draft === null && (
            <p className="mt-1.5 max-w-[70ch] whitespace-pre-wrap text-small leading-relaxed text-foreground">
              {row.current}
            </p>
          )}
        </div>
        {draft === null && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft(row.current)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={!row.overridden || busy}
            >
              <RotateCcw aria-hidden className="size-4" />
              <span className="sr-only">Reset {row.label}</span>
            </Button>
          </div>
        )}
      </div>

      {draft !== null && (
        <div className="mt-3 max-w-[70ch] space-y-2">
          {row.note && (
            <p className="text-xs leading-relaxed text-graphite">{row.note}</p>
          )}
          {(row.vars?.length || row.tags?.length) && (
            <p className="text-xs leading-relaxed text-graphite">
              Keep{" "}
              {[
                ...(row.vars ?? []).map((v) => `{${v}}`),
                ...(row.tags ?? []).map((t) => `<${t}>`),
              ].join(", ")}{" "}
              in your wording —{" "}
              {row.vars?.length
                ? "it fills in a live value"
                : "it carries formatting"}
              .
            </p>
          )}
          {multiline ? (
            <Textarea
              value={draft}
              rows={4}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              aria-label={row.label}
            />
          ) : (
            <Input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              aria-label={row.label}
            />
          )}
          <CharCounter length={draft.length} max={max} />
          {row.overridden && (
            <p className="text-xs leading-relaxed text-graphite">
              Ships with:{" "}
              <span className="text-foreground">“{row.fallback}”</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy}>
              {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <span className="text-xs text-graphite">
              Clear the field to go back to the shipped wording.
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
