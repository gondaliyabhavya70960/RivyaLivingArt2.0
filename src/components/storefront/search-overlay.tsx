"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Search, X } from "lucide-react";

import { searchStudio } from "@/actions/search";
import { Skeleton } from "@/components/storefront/skeletons";
import { useOverlayOpen } from "@/hooks/use-overlay-signal";
import { Link, useRouter } from "@/i18n/navigation";
import { isOptimizableImageSrc, sizedExternalSrc } from "@/lib/image-src";
import type { SearchResults } from "@/lib/search-query";
import { closeSearch, searchSignal, toggleSearch } from "@/lib/search-signal";
import { cn, formatPriceBand, monogram } from "@/lib/utils";

/**
 * The search overlay — REDESIGN.md §5.6.
 *
 *     Full-screen dark overlay, obsidian at 92%, large field:
 *     "Search the studio…"
 *     Results appear from the second character, debounced 180ms, grouped
 *     under mono headings — Products · Collections · Portfolio · Journal.
 *     Empty input shows Recent plus six suggestion chips.
 *     Full keyboard loop (⌘K / "/" to open, ↑↓ to move, Enter to open,
 *     Esc to close).
 *
 * Four decisions the markup does not explain:
 *
 * 1. **It is a combobox, not a menu.** The field keeps DOM focus for the
 *    whole session and the highlighted row is named by `aria-activedescendant`
 *    (`role="listbox"` / `role="option"`). Moving real focus onto each row
 *    would mean the field loses it on every arrow press — and with it the
 *    caret, so typing "vase" then pressing ↓ then "s" would go nowhere. The
 *    rows stay real anchors, so click, middle-click and "open in new tab"
 *    behave; ↵ on the highlighted row navigates programmatically.
 * 2. **The overlay owns the global shortcut.** `⌘K` / `Ctrl+K` / `/` are bound
 *    here rather than in the header, because this component is mounted once
 *    per page and the header is not the only trigger (§5.5's bottom bar opens
 *    it too). The binding never fires while focus sits in a field — stealing
 *    "/" from someone typing an address is the classic version of this bug.
 * 3. **The panel is keyed to `open` by mounting.** Every piece of session
 *    state (query, results, highlight) lives in `SearchPanel`, which unmounts
 *    on close — so re-opening is a fresh field with no stale result set, and
 *    no effect ever has to reset state (`react-hooks/set-state-in-effect`).
 * 4. **Loading is a skeleton, and only on the first query.** Part 16: never a
 *    spinner where a skeleton will do. Subsequent keystrokes keep the previous
 *    rows on screen while the next reply is in flight — swapping settled
 *    results for placeholders on every character is the jitter that makes
 *    instant search feel broken.
 */

/** §5.6: debounced 180ms — the house `--dur-fast`, expressed in JS. */
const DEBOUNCE_MS = 180;

/**
 * §5.6: results appear from the second character. Mirrors `MIN_QUERY` in
 * `@/lib/search-query`, which cannot be imported here for its value — that
 * module reaches Prisma, and a value import would drag the client into it
 * (the same line `@/lib/shop` draws for `@/lib/shop-filters`).
 */
const MIN_QUERY = 2;

/** Recent queries kept on the device. "The last few", not a history page. */
const RECENT_KEY = "rr.recent-searches";
const RECENT_MAX = 5;

/**
 * §5.6's six suggestion chips. Real studio vocabulary, lifted from the
 * hand-curated synonym map in `@/lib/search-synonyms` — every one of these
 * words is already in the catalogue, and none of them is a product name this
 * file invented (HARD RULES: the catalogue is owner-fed only). Each chip runs
 * a real query, so a chip can never lead somewhere that does not exist.
 *
 * The terms stay in catalogue vocabulary in all nine locales: search matches
 * the English base columns (`localize` overrides are a render-time layer, not
 * an index), so a translated chip would run a query that matches nothing. The
 * chips' accessible names ARE localised — see `suggestionAria`.
 */
const SUGGESTIONS = [
  "resin",
  "agate",
  "varmala",
  "keychain",
  "lithophane",
  "filament",
] as const;

/* ————————————————— recent queries (device-local) ————————————————— */

const EMPTY_RECENT: readonly string[] = [];

let recentCache: readonly string[] | null = null;
const recentListeners = new Set<() => void>();

function readRecent(): readonly string[] {
  if (typeof window === "undefined") return EMPTY_RECENT;
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return EMPTY_RECENT;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_RECENT;
    const clean = parsed
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length >= MIN_QUERY && q.length <= 120)
      .slice(0, RECENT_MAX);
    return clean.length > 0 ? clean : EMPTY_RECENT;
  } catch {
    // Corrupt JSON / storage unavailable — treat as empty, never throw.
    return EMPTY_RECENT;
  }
}

function emitRecent(): void {
  for (const listener of recentListeners) listener();
}

function writeRecent(next: readonly string[]): void {
  recentCache = next;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — the in-memory list still serves this session.
  }
  emitRecent();
}

function subscribeRecent(listener: () => void): () => void {
  recentListeners.add(listener);
  return () => {
    recentListeners.delete(listener);
  };
}

function getRecent(): readonly string[] {
  if (recentCache === null) recentCache = readRecent();
  return recentCache;
}

/** SSR snapshot — the server never knows the device's history. */
function getRecentServer(): readonly string[] {
  return EMPTY_RECENT;
}

function rememberQuery(query: string): void {
  const q = query.trim();
  if (q.length < MIN_QUERY) return;
  const current = getRecent();
  const lower = q.toLowerCase();
  writeRecent(
    [q, ...current.filter((entry) => entry.toLowerCase() !== lower)].slice(
      0,
      RECENT_MAX,
    ),
  );
}

function clearRecent(): void {
  writeRecent(EMPTY_RECENT);
}

/* ————————————————— shortcut host ————————————————— */

/** Never steal a keystroke from someone who is already typing (§5.6). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Mount ONCE in the storefront layout. Renders nothing until the shared
 * signal opens (`openSearch()` from the header, the bottom bar, or the
 * shortcut below), so a closed overlay costs one subscription.
 */
export function SearchOverlay() {
  const open = useOverlayOpen(searchSignal);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const cmdK =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "k";
      const slash =
        event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (!cmdK && !slash) return;
      // Also covers the overlay's own field, so "/" and ⌘K type and toggle
      // nothing once it is open; Esc is the way out.
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      toggleSearch(
        event.target instanceof HTMLElement ? event.target : undefined,
      );
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return open ? <SearchPanel /> : null;
}

/* ————————————————— the panel ————————————————— */

type Phase = "idle" | "loading" | "ready" | "error";

/** Page chrome taken out of the a11y tree and the tab order while open. */
const PAGE_CHROME =
  "[data-slot='sf-site-header'], main, body footer, [data-slot='sf-announcement-bar'], [data-slot='sf-consent'], [data-slot='sf-bottom-bar'], [data-slot='sf-mobile-wa-bar'], [data-slot='sf-wa-fab']";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function optionId(index: number): string {
  return `sf-search-option-${index}`;
}

function SearchPanel() {
  const t = useTranslations("Search.overlay");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<SearchResults | null>(null);
  /** Highlighted row, -1 = none. Named by `aria-activedescendant`. */
  const [active, setActive] = useState(-1);

  const recent = useSyncExternalStore(
    subscribeRecent,
    getRecent,
    getRecentServer,
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  /** Reply sequence — a slow "va" must never overwrite a fast "vase". */
  const seqRef = useRef(0);

  /* ——— open: scroll lock, background inert, focus the field. ——— */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // aria-modal only excludes the page for AT that honours it; the chrome
    // is a set of siblings that would otherwise stay in the tab order
    // (the fix the mobile menu already carries).
    const chrome = Array.from(
      document.querySelectorAll<HTMLElement>(PAGE_CHROME),
    ).filter((el) => !el.contains(panelRef.current));
    for (const el of chrome) el.inert = true;
    inputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      for (const el of chrome) el.inert = false;
      window.clearTimeout(timerRef.current);
      // Any reply still in flight belongs to a closed overlay.
      seqRef.current += 1;
    };
  }, []);

  /* ——— keep the highlighted row in view (DOM write, never state). ——— */
  useEffect(() => {
    if (active < 0) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      const seq = (seqRef.current += 1);
      const reply = await searchStudio({ query: q, locale });
      if (seq !== seqRef.current) return; // superseded
      if (!reply.ok) {
        setPhase("error");
        return;
      }
      setResults(reply.results);
      setPhase("ready");
      setActive(-1);
    },
    [locale],
  );

  /** Debounce the DB round-trip; below the threshold there is nothing to ask. */
  const schedule = useCallback(
    (next: string, immediate = false) => {
      window.clearTimeout(timerRef.current);
      setActive(-1);
      if (next.trim().length < MIN_QUERY) {
        seqRef.current += 1;
        setResults(null);
        setPhase("idle");
        return;
      }
      setPhase("loading");
      if (immediate) {
        void run(next);
        return;
      }
      timerRef.current = window.setTimeout(() => void run(next), DEBOUNCE_MS);
    },
    [run],
  );

  const searchPath = `/search?q=${encodeURIComponent(query.trim())}`;

  /** Leave for a real page: remember the query, close, then navigate. */
  const leaveFor = useCallback(
    (href: string) => {
      rememberQuery(query);
      closeSearch();
      router.push(href);
    },
    [query, router],
  );

  function submit() {
    if (query.trim().length < MIN_QUERY) return;
    leaveFor(searchPath);
  }

  function fill(next: string) {
    setQuery(next);
    schedule(next, true);
    inputRef.current?.focus();
  }

  /* ——— the flat option list, in §5.6's group order. ——— */
  const products = results?.products ?? [];
  const collections = results?.collections ?? [];
  const portfolio = results?.portfolio ?? [];
  const journal = results?.journal ?? [];
  const hrefs = [
    ...products.map((p) => `/product/${p.slug}`),
    ...collections.map((c) => `/shop/${c.slug}`),
    ...portfolio.map((p) => `/portfolio/${p.slug}`),
    ...journal.map((j) => `/blog/${j.slug}`),
  ];
  const offset = {
    products: 0,
    collections: products.length,
    portfolio: products.length + collections.length,
    journal: products.length + collections.length + portfolio.length,
  };

  const searched = query.trim().length >= MIN_QUERY;
  const hasResults = hrefs.length > 0;
  const showSkeleton = phase === "loading" && !hasResults;
  const showNothing = phase === "ready" && searched && !hasResults;

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (hrefs.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Wrap in both directions, starting from the field (-1) so ↑ from the
      // field lands on the last row.
      setActive((current) => {
        const next = current + step;
        if (next < 0) return hrefs.length - 1;
        if (next >= hrefs.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      leaveFor(hrefs[active]);
      return;
    }

    if (event.key !== "Tab") return;
    // Focus trap (Part 17). The background is inert, but a browser that
    // ignores `inert` must still not tab out of the layer.
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      // `tabIndex >= 0` drops the result rows: they are anchors, but the
      // combobox owns the tab stop and they are reached with ↑↓, not Tab.
    ).filter((el) => el.offsetParent !== null && el.tabIndex >= 0);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const current = document.activeElement;
    if (!panel.contains(current)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={panelRef}
      data-slot="sf-search-overlay"
      // The overlay paints obsidian, so it re-scopes the token layer: inks
      // resolve to mineral/mist and the focus ring flips to champagne, the
      // only accent that clears 3:1 on this ground.
      data-theme="navy"
      role="dialog"
      aria-modal="true"
      aria-label={t("dialogLabel")}
      onKeyDown={onKeyDown}
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-obsidian/92 font-body text-mineral",
        // Part 3.5 allows blur in exactly one place — the sticky header. The
        // overlay IS the header's own layer (it is the search action's panel),
        // so it carries that one sanctioned blur and nothing else does.
        "backdrop-blur-md",
        "animate-in fade-in duration-(--dur-fast) ease-(--ease-settle) motion-reduce:animate-none",
      )}
    >
      {/* ——— field ——— */}
      <div className="u-shell shrink-0 pt-5 pb-4 md:pt-8">
        <div className="flex items-start justify-between gap-6">
          <label
            htmlFor="sf-search-field"
            className="u-micro flex items-center gap-3 pt-3"
          >
            <span
              aria-hidden
              className="block h-px w-6 shrink-0 bg-champagne"
            />
            {t("label")}
          </label>
          <button
            type="button"
            onClick={() => closeSearch()}
            className="-me-3 inline-flex size-11 shrink-0 items-center justify-center rounded-input text-mist outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
          >
            <X aria-hidden strokeWidth={1.5} className="size-6" />
            <span className="sr-only">{tCommon("close")}</span>
          </button>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          /* The field is bare by design, so its focus indicator rides on the
             wrapper: the Part 16 ring (champagne inside a dark band) plus the
             rule beneath going champagne. The input's own outline is dropped
             only because this replaces it — never simply removed. */
          className="mt-2 flex items-center gap-4 rounded-input border-b border-hairline-dk pb-4 focus-within:border-champagne focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-obsidian"
        >
          <Search
            aria-hidden
            strokeWidth={1.5}
            className="size-6 shrink-0 text-mist"
          />
          <input
            id="sf-search-field"
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              schedule(event.target.value);
            }}
            type="text"
            role="combobox"
            aria-expanded={hasResults}
            aria-controls="sf-search-results"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            maxLength={120}
            placeholder={t("placeholder")}
            className="min-w-0 flex-1 bg-transparent font-display text-h3 tracking-display text-mineral outline-none placeholder:text-mist/70"
          />
        </form>
      </div>

      {/* ——— results / empty / nothing / error ——— */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="u-shell pb-10">
          {/* One announcement per settled reply — the rows themselves are a
              listbox, which a screen reader reads on arrow. */}
          <p role="status" aria-live="polite" className="sr-only">
            {phase === "loading"
              ? t("loading")
              : phase === "ready" && searched
                ? t("countAnnounce", { count: hrefs.length })
                : ""}
          </p>

          {showSkeleton ? <ResultsSkeleton /> : null}

          {hasResults ? (
            <div
              id="sf-search-results"
              role="listbox"
              aria-label={t("resultsLabel")}
              className="pb-2"
            >
              {products.length > 0 ? (
                <Group id="sf-search-group-products" label={t("groupProducts")}>
                  {products.map((product, i) => {
                    const index = offset.products + i;
                    const price =
                      product.showPrice && product.priceMin != null
                        ? formatPriceBand(product.priceMin, product.priceMax)
                        : tCommon("enquire");
                    return (
                      <OptionRow
                        key={product.id}
                        index={index}
                        active={active === index}
                        href={hrefs[index]}
                        onNavigate={leaveFor}
                        onHover={setActive}
                        image={product.image}
                        fallback={product.displayTitle}
                        // The full catalogue title is the accessible name even
                        // though the visible line clamps (Part 17).
                        label={product.title}
                        title={product.displayTitle}
                        meta={price}
                        metaClassName="u-num"
                      />
                    );
                  })}
                </Group>
              ) : null}

              {collections.length > 0 ? (
                <Group
                  id="sf-search-group-collections"
                  label={t("groupCollections")}
                >
                  {collections.map((collection, i) => {
                    const index = offset.collections + i;
                    return (
                      <OptionRow
                        key={collection.id}
                        index={index}
                        active={active === index}
                        href={hrefs[index]}
                        onNavigate={leaveFor}
                        onHover={setActive}
                        image={null}
                        fallback={collection.name}
                        label={collection.name}
                        title={collection.name}
                        meta={t("collectionCount", {
                          count: collection.count,
                        })}
                        metaClassName="u-num"
                      />
                    );
                  })}
                </Group>
              ) : null}

              {portfolio.length > 0 ? (
                <Group
                  id="sf-search-group-portfolio"
                  label={t("groupPortfolio")}
                >
                  {portfolio.map((item, i) => {
                    const index = offset.portfolio + i;
                    return (
                      <OptionRow
                        key={item.id}
                        index={index}
                        active={active === index}
                        href={hrefs[index]}
                        onNavigate={leaveFor}
                        onHover={setActive}
                        image={item.image}
                        fallback={item.title}
                        label={item.title}
                        title={item.title}
                      />
                    );
                  })}
                </Group>
              ) : null}

              {journal.length > 0 ? (
                <Group id="sf-search-group-journal" label={t("groupJournal")}>
                  {journal.map((post, i) => {
                    const index = offset.journal + i;
                    return (
                      <OptionRow
                        key={post.id}
                        index={index}
                        active={active === index}
                        href={hrefs[index]}
                        onNavigate={leaveFor}
                        onHover={setActive}
                        image={post.image}
                        fallback={post.title}
                        label={post.title}
                        title={post.title}
                        meta={post.category}
                        metaClassName="u-micro"
                      />
                    );
                  })}
                </Group>
              ) : null}
            </div>
          ) : null}

          {/* §5.6's zero state. The miss is the brand's best moment: every
              piece is made to order, so "we don't have it" is really "we
              haven't poured it yet". */}
          {showNothing ? (
            <div className="max-w-xl py-10">
              <p className="font-display text-h3 tracking-display text-mineral">
                {t("nothingHeading")}
              </p>
              <p className="mt-3 font-body text-body text-mist">
                {t.rich("nothingBody", {
                  commission: (chunks) => (
                    <Link
                      href="/custom-order"
                      onClick={() => {
                        rememberQuery(query);
                        closeSearch();
                      }}
                      className="text-champagne underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          ) : null}

          {/* Part 16 error: human language, a retry, and the same commission
              escape hatch — a database hiccup must never read as "we don't
              make that". */}
          {phase === "error" ? (
            <div className="max-w-xl py-10">
              <p className="font-display text-h3 tracking-display text-mineral">
                {t("errorHeading")}
              </p>
              <p className="mt-3 font-body text-body text-mist">
                {t("errorBody")}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button
                  type="button"
                  onClick={() => schedule(query, true)}
                  className="inline-flex min-h-11 items-center font-body text-body font-medium text-champagne underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
                >
                  {t("retry")}
                </button>
                <Link
                  href="/custom-order"
                  onClick={() => closeSearch()}
                  className="inline-flex min-h-11 items-center gap-2 font-body text-body text-mist underline underline-offset-4 outline-none hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
                >
                  {t("commission")}
                  <ArrowRight
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4 rtl:-scale-x-100"
                  />
                </Link>
              </div>
            </div>
          ) : null}

          {/* ——— empty field: Recent + six suggestions (§5.6) ——— */}
          {!searched && phase !== "error" ? (
            <div className="py-6">
              {recent.length > 0 ? (
                <section className="mb-10">
                  <div className="flex items-center justify-between gap-6">
                    <h2 className="u-micro">{t("recent")}</h2>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="u-micro inline-flex min-h-11 items-center text-mist underline underline-offset-4 outline-none hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
                    >
                      {t("clearRecent")}
                    </button>
                  </div>
                  <ul className="mt-2">
                    {recent.map((entry) => (
                      <li key={entry}>
                        <button
                          type="button"
                          onClick={() => fill(entry)}
                          className="group flex min-h-11 w-full items-center gap-3 border-b border-hairline-dk text-start font-body text-body text-mineral outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
                        >
                          <Search
                            aria-hidden
                            strokeWidth={1.5}
                            className="size-4 shrink-0 text-mist"
                          />
                          <span className="truncate">{entry}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h2 className="u-micro">{t("suggestionsLabel")}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((term) => (
                    <li key={term}>
                      <button
                        type="button"
                        onClick={() => fill(term)}
                        aria-label={t("suggestionAria", { term })}
                        className="inline-flex min-h-11 items-center rounded-full border border-hairline-dk px-5 font-body text-small text-mineral outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-champagne hover:text-champagne focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
                      >
                        {term}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      {/* ——— foot: the full results page, and the keyboard loop, stated ——— */}
      <div className="shrink-0 border-t border-hairline-dk">
        <div className="u-shell flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          {searched ? (
            <Link
              href={searchPath}
              onClick={() => {
                rememberQuery(query);
                closeSearch();
              }}
              className="inline-flex min-h-11 items-center gap-2 font-body text-small font-medium text-champagne outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
            >
              {t("seeAll")}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          ) : (
            <span className="u-micro">{t("hintType")}</span>
          )}
          {/* Keyboard hints are for pointer-and-keyboard desktops; a screen
              reader gets the combobox semantics instead of this legend. */}
          <p aria-hidden className="u-micro hidden md:block">
            {t("hints")}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ————————————————— pieces ————————————————— */

function Group({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div role="group" aria-labelledby={id} className="pt-6 first:pt-2">
      {/* Mono heading, not an <h2>: a listbox may only contain options and
          groups, and Part 17 keeps the page to one heading outline. */}
      <p id={id} className="u-micro">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function OptionRow({
  index,
  active,
  href,
  onNavigate,
  onHover,
  image,
  fallback,
  label,
  title,
  meta,
  metaClassName,
}: {
  index: number;
  active: boolean;
  href: string;
  onNavigate: (href: string) => void;
  onHover: (index: number) => void;
  image: { url: string; alt: string } | null;
  /** Name behind the monogram tile when there is no photograph. */
  fallback: string;
  /** The full title — the visible line truncates, the name must not (Part 17). */
  label: string;
  title: string;
  /** Price, count or category — the row's second line. */
  meta?: string | null;
  metaClassName?: string;
}) {
  return (
    <a
      id={optionId(index)}
      role="option"
      aria-selected={active}
      // Spelled out rather than left to the text nodes: the visible name is
      // the short editorial one and can end in an ellipsis, and the meta line
      // (price, piece count, journal category) belongs to the announcement.
      aria-label={meta ? `${label}, ${meta}` : label}
      href={href}
      tabIndex={-1}
      onMouseMove={() => onHover(index)}
      onClick={(event) => {
        // Let the browser own modified clicks (new tab, new window).
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        onNavigate(href);
      }}
      data-active={active || undefined}
      className={cn(
        "flex items-center gap-4 border-s-2 border-transparent py-2 ps-3 pe-2 transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
        // The field keeps DOM focus, so the highlight — not a focus ring — is
        // what marks the row `aria-activedescendant` is announcing.
        "data-active:border-champagne data-active:bg-mineral/8",
      )}
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-image bg-deep-ocean">
        {image ? (
          <Image
            src={sizedExternalSrc(image.url, 160)}
            alt=""
            fill
            sizes="56px"
            unoptimized={!isOptimizableImageSrc(image.url)}
            className="object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-full w-full items-center justify-center font-display text-16 text-mineral/70"
          >
            {monogram(fallback)}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body text-body font-medium text-mineral">
          {title}
        </span>
        {meta ? (
          <span
            className={cn("mt-0.5 block truncate text-mist", metaClassName)}
          >
            {meta}
          </span>
        ) : null}
      </span>
      <ArrowRight
        aria-hidden
        strokeWidth={1.5}
        className="size-4 shrink-0 text-mist opacity-0 rtl:-scale-x-100 in-data-active:opacity-100"
      />
    </a>
  );
}

/**
 * Part 16: flat blocks at the final dimensions, no spinner. Five rows — the
 * product cap — so the panel does not resize when the real rows land.
 */
function ResultsSkeleton() {
  return (
    <div aria-hidden className="pt-8">
      <Skeleton className="h-3 w-24" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 ps-3">
            <Skeleton className="size-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
