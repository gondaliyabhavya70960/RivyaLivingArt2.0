"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import {
  addNavItem,
  reorderNavItems,
  resetNavMenus,
  setNavItemVisible,
  updateNavHref,
  updateNavLabel,
} from "@/actions/nav-menus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/studio/field-error";
import { FieldHint, describedBy } from "@/components/studio/field-hint";
import {
  describeHrefProblem,
  describeLabelProblem,
  type NavMenuKey,
} from "@/lib/nav-menus";
import { cn } from "@/lib/utils";

export type NavItemRow = {
  id: string;
  key: string;
  href: string;
  visible: boolean;
  /** True for a link the site shipped with, false for one the owner added. */
  bundled: boolean;
  labels: Record<string, string>;
  /** True where this locale has a stored override rather than the catalogue. */
  overridden: Record<string, boolean>;
};

export type NavMenuRows = {
  menuKey: NavMenuKey;
  title: string;
  where: string;
  items: NavItemRow[];
};

type LocaleOption = { code: string; label: string };

/**
 * The navigation board — six menus, one language at a time.
 *
 * Hrefs are checked as you type, against the same rule the action enforces
 * (`describeHrefProblem`), because a link to a page that does not exist is the
 * one mistake this screen makes easy and a visitor finds first.
 *
 * No `useEffect`: draft state exists only while a row is open and is seeded in
 * the handler that opens it.
 */
export function NavMenusBoard({
  menus,
  locales,
  defaultLocale,
  knownRoutes,
  seeded,
}: {
  menus: readonly NavMenuRows[];
  locales: readonly LocaleOption[];
  defaultLocale: string;
  knownRoutes: readonly string[];
  seeded: boolean;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState(defaultLocale);
  const [busy, setBusy] = useState(false);

  async function runReset() {
    setBusy(true);
    const res = await resetNavMenus();
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      res.data?.hidden
        ? `Back to the shipped links — ${res.data.hidden} added one${res.data.hidden === 1 ? "" : "s"} hidden.`
        : "Back to the shipped links.",
    );
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {!seeded && (
        <p className="rounded-md border border-border bg-surface p-4 text-small leading-relaxed text-graphite">
          No links are stored yet, so the site is showing the menus it ships
          with. They appear here after the next deploy — or as soon as you add
          one below.
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
          Back to the shipped links
        </Button>
      </div>

      <p className="max-w-[70ch] text-small leading-relaxed text-graphite">
        The words on a shipped link come from Site Copy, where they are already
        translated into nine languages — editing one here overrides that for the
        language you are on. Links you add carry their own words instead.
      </p>

      {menus.map((menu) => (
        <MenuSection
          key={menu.menuKey}
          menu={menu}
          locale={locale}
          isDefaultLocale={locale === defaultLocale}
          knownRoutes={knownRoutes}
        />
      ))}
    </div>
  );
}

function MenuSection({
  menu,
  locale,
  isDefaultLocale,
  knownRoutes,
}: {
  menu: NavMenuRows;
  locale: string;
  isDefaultLocale: boolean;
  knownRoutes: readonly string[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState<{ label: string; href: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const addId = useId();

  const visible = menu.items.filter((i) => i.visible);
  const addProblem = adding ? describeHrefProblem(adding.href) : null;
  // Shown once there is something to judge: an empty row is the state every
  // add starts in, and the Add button already refuses it.
  const addHrefProblem = adding?.href.trim() ? addProblem : null;
  const addLabelProblem = adding?.label.trim()
    ? describeLabelProblem(adding.label)
    : null;

  async function add() {
    if (!adding) return;
    setBusy(true);
    const res = await addNavItem({
      menuKey: menu.menuKey,
      label: adding.label,
      href: adding.href,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAdding(null);
    toast.success(`Added to ${menu.title}.`);
    router.refresh();
  }

  async function move(index: number, delta: number) {
    const next = [...visible];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    const res = await reorderNavItems({
      menuKey: menu.menuKey,
      ids: next.map((i) => i.id),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <section aria-labelledby={`menu-${menu.menuKey}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
        <h2
          id={`menu-${menu.menuKey}`}
          className="font-display text-25 text-foreground"
        >
          {menu.title}
        </h2>
        <p className="text-small text-graphite">{menu.where}</p>
      </div>

      <ul className="divide-y divide-border">
        {menu.items.map((item) => (
          <NavRow
            key={item.id}
            item={item}
            locale={locale}
            isDefaultLocale={isDefaultLocale}
            index={visible.findIndex((i) => i.id === item.id)}
            count={visible.length}
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
            onClick={() => setAdding({ label: "", href: "" })}
          >
            <Plus aria-hidden className="size-4" />
            Add a link
          </Button>
        ) : (
          <div className="max-w-[52ch] space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`${addId}-label`}
                className="w-full sm:w-52"
                value={adding.label}
                autoFocus
                aria-label={`New ${menu.title} link text`}
                placeholder="What it says"
                aria-invalid={addLabelProblem ? true : undefined}
                aria-describedby={describedBy(
                  addLabelProblem && `${addId}-label-error`,
                )}
                onChange={(e) =>
                  setAdding({ ...adding, label: e.target.value })
                }
              />
              <Input
                id={`${addId}-href`}
                className="w-full sm:w-56"
                value={adding.href}
                aria-label={`New ${menu.title} link destination`}
                placeholder="/workshops"
                list="nav-known-routes"
                aria-invalid={addHrefProblem ? true : undefined}
                aria-describedby={describedBy(
                  `${addId}-href-hint`,
                  addHrefProblem && `${addId}-href-error`,
                )}
                onChange={(e) => setAdding({ ...adding, href: e.target.value })}
              />
            </div>
            <FieldError id={`${addId}-label-error`}>{addLabelProblem}</FieldError>
            <FieldError id={`${addId}-href-error`}>{addHrefProblem}</FieldError>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={add}
                disabled={
                  busy ||
                  !adding.label.trim() ||
                  Boolean(addProblem) ||
                  Boolean(addLabelProblem)
                }
              >
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
            </div>
            <FieldHint id={`${addId}-href-hint`}>
              Type the destination as it appears in the address bar —
              /workshops, /shop#collections, or a full https:// address.
            </FieldHint>
          </div>
        )}
      </div>

      {/* One shared datalist so every href field offers the site's own pages. */}
      <datalist id="nav-known-routes">
        {knownRoutes.map((route) => (
          <option key={route} value={route} />
        ))}
      </datalist>
    </section>
  );
}

function NavRow({
  item,
  locale,
  isDefaultLocale,
  index,
  count,
  onMove,
  disabled,
}: {
  item: NavItemRow;
  locale: string;
  isDefaultLocale: boolean;
  index: number;
  count: number;
  onMove: (index: number, delta: number) => void;
  disabled: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<{ label: string; href: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const rowId = useId();
  const label = item.labels[locale] ?? item.key;
  const overridden = item.overridden[locale] ?? false;
  const problem = draft ? describeHrefProblem(draft.href) : null;
  // Blank words are allowed here: they drop the override and the catalogue
  // wording comes back. Only the length cap applies.
  const labelProblem = draft
    ? describeLabelProblem(draft.label, { allowEmpty: true })
    : null;

  async function save() {
    if (!draft || problem || labelProblem) return;
    setBusy(true);
    if (draft.href.trim() !== item.href) {
      const res = await updateNavHref({ id: item.id, href: draft.href });
      if (!res.ok) {
        setBusy(false);
        toast.error(res.error);
        return;
      }
    }
    if (draft.label.trim() !== label) {
      const res = await updateNavLabel({
        id: item.id,
        locale,
        label: draft.label,
      });
      if (!res.ok) {
        setBusy(false);
        toast.error(res.error);
        return;
      }
    }
    setBusy(false);
    setDraft(null);
    router.refresh();
  }

  async function toggle() {
    setBusy(true);
    const res = await setNavItemVisible({
      id: item.id,
      visible: !item.visible,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <li className={cn("py-3", !item.visible && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          {draft === null ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-small text-foreground">{label}</span>
                {!item.visible && <Badge variant="outline">Hidden</Badge>}
                {!item.bundled && <Badge variant="secondary">Added</Badge>}
                {!isDefaultLocale && item.bundled && !overridden && (
                  <Badge variant="outline">From Site Copy</Badge>
                )}
              </div>
              <p className="mt-0.5 font-mono text-12 text-graphite">
                {item.href}
              </p>
            </>
          ) : (
            <div className="max-w-[52ch] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${rowId}-label`}
                  className="w-full sm:w-52"
                  value={draft.label}
                  autoFocus
                  aria-label={`Words for ${item.key}`}
                  aria-invalid={labelProblem ? true : undefined}
                  aria-describedby={describedBy(
                    item.bundled && `${rowId}-label-hint`,
                    labelProblem && `${rowId}-label-error`,
                  )}
                  onChange={(e) =>
                    setDraft({ ...draft, label: e.target.value })
                  }
                />
                <Input
                  id={`${rowId}-href`}
                  className="w-full sm:w-56"
                  value={draft.href}
                  aria-label={`Destination for ${item.key}`}
                  list="nav-known-routes"
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={describedBy(problem && `${rowId}-href-error`)}
                  onChange={(e) => setDraft({ ...draft, href: e.target.value })}
                />
              </div>
              <FieldError id={`${rowId}-label-error`}>{labelProblem}</FieldError>
              <FieldError id={`${rowId}-href-error`}>{problem}</FieldError>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={save}
                  disabled={busy || Boolean(problem) || Boolean(labelProblem)}
                >
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
              </div>
              {item.bundled && (
                <FieldHint id={`${rowId}-label-hint`}>
                  Clearing the words puts this link back to its Site Copy
                  wording, which is translated into nine languages.
                </FieldHint>
              )}
            </div>
          )}
        </div>

        {draft === null && (
          <div className="flex shrink-0 items-center gap-1">
            {item.visible && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || busy || index <= 0}
                  onClick={() => onMove(index, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                  <span className="sr-only">Move {label} up</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled || busy || index >= count - 1}
                  onClick={() => onMove(index, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                  <span className="sr-only">Move {label} down</span>
                </Button>
              </>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft({ label, href: item.href })}
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
              {item.visible ? "Hide" : "Show"}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}
