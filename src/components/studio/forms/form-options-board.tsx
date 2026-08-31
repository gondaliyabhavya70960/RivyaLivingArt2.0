"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  addFormOption,
  reorderFormOptions,
  resetFormOptions,
  setFormOptionEnabled,
  updateFormOptionLabel,
} from "@/actions/form-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormOptionListKey } from "@/lib/form-options";
import { cn } from "@/lib/utils";

export type FormOptionRow = {
  id: string;
  /** The immutable machine value stored on the enquiry. */
  value: string;
  enabled: boolean;
  labels: Record<string, string>;
  translated: Record<string, boolean>;
  /** True for a choice the site shipped with, false for one the owner added. */
  bundled: boolean;
};

export type FormOptionListRows = {
  list: FormOptionListKey;
  title: string;
  where: string;
  options: FormOptionRow[];
};

type LocaleOption = { code: string; label: string };

/**
 * The commission-form option board — four lists, one language at a time.
 *
 * The language switch is the whole reason this screen looks the way it does.
 * Before Phase C every choice rendered in English in all nine locales, so the
 * first thing an owner needs to see is which languages a choice has been
 * written in and which are still falling back.
 *
 * No `useEffect`: draft state exists only while a row is open and is seeded in
 * the handler that opens it (`react-hooks/set-state-in-effect`).
 */
export function FormOptionsBoard({
  lists,
  locales,
  defaultLocale,
  seeded,
}: {
  lists: readonly FormOptionListRows[];
  locales: readonly LocaleOption[];
  defaultLocale: string;
  seeded: boolean;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState(defaultLocale);
  const [busy, setBusy] = useState(false);

  async function runReset() {
    setBusy(true);
    const res = await resetFormOptions();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data?.retired
        ? `Back to the shipped choices — ${res.data.retired} added one${res.data.retired === 1 ? "" : "s"} retired.`
        : "Back to the shipped choices.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {!seeded && (
        <p className="rounded-md border border-border bg-surface p-4 text-small leading-relaxed text-graphite">
          No choices are stored yet, so the commission form is showing the lists
          it ships with. They appear here after the next deploy — or as soon as
          you add one below, which starts the list from what you type.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-border py-4">
        <nav aria-label="Language" className="flex flex-wrap gap-1.5">
          {locales.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLocale(l.code)}
              aria-current={l.code === locale ? "true" : undefined}
              className={cn(
                "rounded-md border px-3 py-1.5 text-small transition-colors",
                l.code === locale
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-graphite hover:border-foreground hover:text-foreground",
              )}
            >
              {l.label}
            </button>
          ))}
        </nav>
        <Button
          variant="outline"
          size="sm"
          onClick={runReset}
          disabled={busy}
          className="ms-auto"
        >
          {busy ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden className="size-4" />
          )}
          Back to the shipped choices
        </Button>
      </div>

      <p className="max-w-[70ch] text-small leading-relaxed text-graphite">
        What a customer picks is stored on the enquiry and sent to WhatsApp in
        English, whichever language they were browsing in — so the studio reads
        one vocabulary. Editing the wording here changes what they <em>read</em>
        , never what past enquiries mean.
      </p>

      {lists.map((list) => (
        <ListSection
          key={list.list}
          list={list}
          locale={locale}
          isDefaultLocale={locale === defaultLocale}
        />
      ))}
    </div>
  );
}

function ListSection({
  list,
  locale,
  isDefaultLocale,
}: {
  list: FormOptionListRows;
  locale: string;
  isDefaultLocale: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const enabled = list.options.filter((o) => o.enabled);

  async function add() {
    if (!adding?.trim()) return;
    setBusy(true);
    const res = await addFormOption({ list: list.list, label: adding });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAdding(null);
    toast.success(`Added to ${list.title}.`);
    router.refresh();
  }

  async function move(index: number, delta: number) {
    const next = [...enabled];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    const res = await reorderFormOptions({
      list: list.list,
      ids: next.map((o) => o.id),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-labelledby={`list-${list.list}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
        <h2
          id={`list-${list.list}`}
          className="font-display text-25 text-foreground"
        >
          {list.title}
        </h2>
        <p className="text-small text-graphite">{list.where}</p>
      </div>

      <ul className="divide-y divide-border">
        {list.options.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            locale={locale}
            isDefaultLocale={isDefaultLocale}
            index={enabled.findIndex((o) => o.id === option.id)}
            count={enabled.length}
            onMove={move}
            disabled={busy}
          />
        ))}
      </ul>

      <div className="mt-3">
        {adding === null ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAdding("")}
          >
            <Plus aria-hidden className="size-4" />
            Add a choice
          </Button>
        ) : (
          <div className="flex max-w-[40ch] flex-wrap items-center gap-2">
            <Input
              value={adding}
              autoFocus
              aria-label={`New ${list.title} choice`}
              placeholder="What the customer will read"
              onChange={(e) => setAdding(e.target.value)}
            />
            <Button type="button" size="sm" onClick={add} disabled={busy}>
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdding(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <p className="w-full text-12 leading-relaxed text-graphite">
              Type it in English — that becomes what enquiries record. Other
              languages are added by switching the language above and editing
              the choice.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function OptionRow({
  option,
  locale,
  isDefaultLocale,
  index,
  count,
  onMove,
  disabled,
}: {
  option: FormOptionRow;
  locale: string;
  isDefaultLocale: boolean;
  index: number;
  count: number;
  onMove: (index: number, delta: number) => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label = option.labels[locale] ?? option.value;
  const translated = option.translated[locale] ?? false;

  async function save() {
    if (draft === null) return;
    setBusy(true);
    const res = await updateFormOptionLabel({
      id: option.id,
      locale,
      label: draft,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function toggle() {
    setBusy(true);
    const res = await setFormOptionEnabled({
      id: option.id,
      enabled: !option.enabled,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className={cn("py-3", !option.enabled && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          {draft === null ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-small text-foreground">{label}</span>
                {!option.enabled && <Badge variant="outline">Hidden</Badge>}
                {!isDefaultLocale &&
                  (translated ? (
                    <Badge variant="secondary">Translated</Badge>
                  ) : (
                    <Badge variant="outline">Showing English</Badge>
                  ))}
                {!option.bundled && <Badge variant="secondary">Added</Badge>}
              </div>
              {!isDefaultLocale && (
                <p className="mt-0.5 font-mono text-12 text-graphite">
                  recorded as “{option.value}”
                </p>
              )}
            </>
          ) : (
            <div className="flex max-w-[40ch] flex-wrap items-center gap-2">
              <Input
                value={draft}
                autoFocus
                aria-label={`Wording for ${option.value}`}
                onChange={(e) => setDraft(e.target.value)}
              />
              <Button type="button" size="sm" onClick={save} disabled={busy}>
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDraft(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <p className="w-full text-12 leading-relaxed text-graphite">
                {isDefaultLocale
                  ? "Changes what customers read. Enquiries already sent keep the wording they were sent with."
                  : "Clear the field to go back to showing the English wording."}
              </p>
            </div>
          )}
        </div>

        {draft === null && (
          <div className="flex shrink-0 items-center gap-1">
            {option.enabled && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || busy || index <= 0}
                  onClick={() => onMove(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                  <span className="sr-only">Move {option.value} up</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || busy || index >= count - 1}
                  onClick={() => onMove(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                  <span className="sr-only">Move {option.value} down</span>
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(label)}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={toggle}
            >
              {option.enabled ? "Hide" : "Show"}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
