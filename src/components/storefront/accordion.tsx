"use client";

import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Check, ChevronDown, Link2 } from "lucide-react";
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

/**
 * Accordion — REDESIGN.md §4.6.
 *
 * > "56px rows, chevron rotates 180° over 180ms, open via
 * > `grid-template-rows: 0fr → 1fr` at 350ms. Single-open per group.
 * > Deep-linkable by hash so a specific FAQ answer can be pasted straight
 * > into a WhatsApp reply. **An accordion with no content must not render.**"
 *
 * Four decisions the spec leaves to the build:
 *
 * 1. **The grid transition lives one element inside Radix's Content.** Radix
 *    animates collapsibles with CSS *keyframes* on purpose: its content layout
 *    effect sets `style.transitionDuration = "0s"` on the Content node, forces
 *    a reflow to measure it, then restores the value — which cancels any CSS
 *    transition declared on that node. `transition-duration` is not inherited,
 *    so the animated grid is a child div and Radix never touches it. The
 *    Content itself is `forceMount`ed, which is what keeps `data-state` on a
 *    node that is always in the DOM and therefore transitionable.
 * 2. **Collapsed content is `visibility: hidden`, not just clipped.** A 0fr
 *    grid row with `overflow: hidden` is invisible but still focusable and
 *    still read by a screen reader. `visibility` interpolates as a step that
 *    flips to `visible` immediately on open and holds until the end of the
 *    close, so it doubles as the collapse animation's own gate — the panel
 *    leaves the tab order and the accessibility tree exactly when it finishes
 *    closing (Part 17: full keyboard path, nothing focusable off-screen).
 *    The price of `forceMount` is that Radix's `role="region"` wrapper now
 *    exists for closed panels too — empty, labelled, and reachable only via a
 *    landmark list. Kept rather than stripped: the trigger's `aria-expanded`
 *    carries the state, and dropping an ARIA role is a semantics change, not
 *    the visual-layer change this pass is scoped to.
 * 3. **Deep-linking is opt-in** (`deepLink` on the root). The FAQ wants the
 *    URL to drive it; the PDP's spec panels must not fight `#gallery` or a
 *    marketing anchor. When on, the root becomes controlled and any hash
 *    change wins over the previous manual toggle — `defaultValue` still
 *    applies while the URL carries no fragment.
 * 4. **An item whose content is empty returns `null`.** §9.4 calls the three
 *    empty panels on the product page "the single most damaging detail on the
 *    page", so the guard lives in the primitive rather than in each caller.
 *    `hasAccordionContent` is exported for callers that need to make the same
 *    decision one level up (hiding a whole section, not just a row).
 *
 * Single-open (`type="single" collapsible`) is the default; `type="multiple"`
 * still works for callers that need it.
 */

/* Part 16: 2px sapphire ring at 3px offset, champagne inside a dark band. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral in-data-[theme=navy]:focus-visible:ring-offset-obsidian";

/* ————————————————————— deep-link hash ————————————————————— */

const NO_HASH = "";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function subscribeToNothing() {
  return () => undefined;
}

function readHash(): string {
  const raw = window.location.hash.slice(1);
  if (!raw) return NO_HASH;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed fragment is still a fragment — match it verbatim.
    return raw;
  }
}

function readNoHash(): string {
  return NO_HASH;
}

/**
 * The current fragment, as an external store. `useSyncExternalStore` rather
 * than an effect: the server snapshot is empty, so hydration matches the HTML
 * and React re-reads the real hash on the client without a setState-in-effect.
 */
function useHashTarget(enabled: boolean): string {
  return useSyncExternalStore(
    enabled ? subscribeToHash : subscribeToNothing,
    enabled ? readHash : readNoHash,
    readNoHash,
  );
}

/* ————————————————————— empty-content guard ————————————————————— */

/**
 * Does this node put anything on the page? Whitespace, `null`, `undefined`,
 * `false` and elements whose only child is an empty string all count as
 * nothing — which is exactly the shape an unfilled CMS field arrives in
 * (`<p>{product.careInstructions}</p>` with a blank column).
 *
 * Anything unrecognised counts as content: this guard hides panels, and
 * hiding real copy is a worse failure than showing an empty one.
 */
export function hasAccordionContent(node: ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (typeof node === "string") return node.trim().length > 0;
  if (typeof node === "number") return true;
  if (Array.isArray(node)) return node.some(hasAccordionContent);
  if (isValidElement<{ children?: ReactNode }>(node)) {
    // A void element (<img>, <hr>) carries no children but is still content.
    if (!("children" in node.props)) return true;
    return hasAccordionContent(node.props.children);
  }
  return true;
}

/** True only when the item HAS an `AccordionContent` child and it is empty. */
function itemIsEmpty(children: ReactNode): boolean {
  let sawContent = false;
  let filled = false;
  Children.forEach(children, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.type !== AccordionContent) return;
    sawContent = true;
    if (hasAccordionContent(child.props.children)) filled = true;
  });
  return sawContent && !filled;
}

/* ————————————————————— scopes ————————————————————— */

type AccordionScopeValue = { deepLink: boolean; hash: string };

const AccordionScope = createContext<AccordionScopeValue>({
  deepLink: false,
  hash: NO_HASH,
});

/** Translated copy-link strings — primitives never call `useTranslations`. */
export type AccordionCopyLink = {
  /** Accessible name of the icon button, e.g. "Copy link to this answer". */
  label: string;
  /** Announced once the URL is on the clipboard, e.g. "Link copied". */
  copiedLabel: string;
};

type AccordionItemScopeValue = { copyLink?: AccordionCopyLink };

const AccordionItemScope = createContext<AccordionItemScopeValue>({});

/* ————————————————————— root ————————————————————— */

type AccordionSingle = Omit<AccordionPrimitive.AccordionSingleProps, "type"> & {
  type?: "single";
  /** Let `location.hash` open and scroll to a matching item. Opt-in. */
  deepLink?: boolean;
};

type AccordionMultiple = AccordionPrimitive.AccordionMultipleProps & {
  deepLink?: boolean;
};

export type AccordionProps = AccordionSingle | AccordionMultiple;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function Accordion(props: AccordionProps) {
  const deepLink = props.deepLink ?? false;
  const hash = useHashTarget(deepLink);

  /* The last value the visitor chose, tagged with the fragment it was chosen
     under. A new fragment invalidates it, so pasting a link into an already
     open page still lands on the right answer. */
  const [manual, setManual] = useState<{ from: string; value: string[] }>(
    () => ({ from: NO_HASH, value: toArray(props.defaultValue) }),
  );
  const open = manual.from === hash ? manual.value : hash ? [hash] : [];

  const scope = useMemo(() => ({ deepLink, hash }), [deepLink, hash]);
  /* A caller that manages `value` itself keeps it — deep-linking never
     overrules an explicitly controlled accordion. `drive` is recomputed per
     branch so `deepLink` is consumed rather than discarded on the way out of
     the props object; it must not reach the underlying div. */

  if (props.type === "multiple") {
    const { deepLink: drives, onValueChange, defaultValue, ...rest } = props;
    const drive = drives === true && props.value === undefined;
    return (
      <AccordionScope.Provider value={scope}>
        <AccordionPrimitive.Root
          data-slot="sf-accordion"
          {...rest}
          {...(drive
            ? {
                value: open,
                onValueChange: (next: string[]) => {
                  setManual({ from: hash, value: next });
                  onValueChange?.(next);
                },
              }
            : { defaultValue, onValueChange })}
        />
      </AccordionScope.Provider>
    );
  }

  const {
    deepLink: drives,
    onValueChange,
    defaultValue,
    /* §4.6 "single-open per group" — and collapsible, so the visitor can
       always close what they opened. */
    collapsible = true,
    ...rest
  } = props;
  const drive = drives === true && props.value === undefined;
  return (
    <AccordionScope.Provider value={scope}>
      <AccordionPrimitive.Root
        data-slot="sf-accordion"
        {...rest}
        type="single"
        collapsible={collapsible}
        {...(drive
          ? {
              value: open[0] ?? "",
              onValueChange: (next: string) => {
                setManual({ from: hash, value: next ? [next] : [] });
                onValueChange?.(next);
              },
            }
          : { defaultValue, onValueChange })}
      />
    </AccordionScope.Provider>
  );
}

/* ————————————————————— item ————————————————————— */

export type AccordionItemProps = ComponentProps<
  typeof AccordionPrimitive.Item
> & {
  /**
   * Renders a copy-link icon button in the row. Off by default — it only
   * earns its 44px where the answer is worth pasting into a WhatsApp reply
   * (§11.6). Requires `deepLink` on the root for the URL to reopen the item.
   */
  copyLink?: AccordionCopyLink;
};

export function AccordionItem({
  className,
  children,
  copyLink,
  ...props
}: AccordionItemProps) {
  const { deepLink, hash } = useContext(AccordionScope);
  const targeted = deepLink && hash === props.value;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!targeted) return;
    const node = ref.current;
    if (!node) return;
    /* Part 14: the global CSS collapse cannot reach scrollIntoView, so
       JS-driven motion checks the query itself. */
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [targeted]);

  /* §9.4 — an empty panel is worse than no panel. */
  if (itemIsEmpty(children)) return null;

  return (
    <AccordionItemScope.Provider value={{ copyLink }}>
      <AccordionPrimitive.Item
        {...props}
        /* The item IS the anchor when deep-linking, so a cold load with a
           fragment lands on the row before hydration ever runs. */
        id={deepLink ? props.value : props.id}
        data-slot="sf-accordion-item"
        className={cn(
          "relative scroll-mt-28 border-b border-hairline in-data-[theme=navy]:border-hairline-dk",
          className,
        )}
        ref={ref}
      >
        {children}
        {copyLink ? <CopyLink value={props.value} {...copyLink} /> : null}
      </AccordionPrimitive.Item>
    </AccordionItemScope.Provider>
  );
}

/**
 * Absolutely positioned rather than placed inside `AccordionPrimitive.Header`:
 * the header is an `<h3>`, and a second control inside it would be folded into
 * the heading's accessible name. The trigger reserves the space via `pe-14`.
 */
function CopyLink({
  value,
  label,
  copiedLabel,
}: AccordionCopyLink & { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const held = timer;
    return () => {
      if (held.current) clearTimeout(held.current);
    };
  }, []);

  async function copy() {
    const base = window.location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(
        `${base}#${encodeURIComponent(value)}`,
      );
    } catch {
      /* No clipboard permission (insecure context, denied). Say nothing
         rather than confirm something that did not happen. */
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2400);
  }

  return (
    <>
      <button
        type="button"
        data-slot="sf-accordion-copy-link"
        aria-label={label}
        onClick={() => void copy()}
        className={cn(
          "absolute end-0 top-1.5 inline-flex size-11 items-center justify-center rounded-input text-graphite",
          "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire motion-reduce:transition-none",
          "in-data-[theme=navy]:text-mist in-data-[theme=navy]:hover:text-champagne",
          FOCUS_RING,
        )}
      >
        {copied ? (
          <Check
            aria-hidden
            strokeWidth={1.5}
            className="size-4 text-success"
          />
        ) : (
          <Link2 aria-hidden strokeWidth={1.5} className="size-4" />
        )}
      </button>
      {/* Part 16: success is an explicit confirmation, role="status". */}
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

/* ————————————————————— trigger ————————————————————— */

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  const { copyLink } = useContext(AccordionItemScope);

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="sf-accordion-trigger"
        className={cn(
          /* §4.6: 56px rows. py-4 around a single line lands exactly there. */
          "flex min-h-14 w-full flex-1 items-center justify-between gap-4 py-4 text-start font-body text-body text-ink",
          "transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire motion-reduce:transition-none",
          "in-data-[theme=navy]:text-mineral in-data-[theme=navy]:hover:text-champagne",
          /* Part 16: disabled is 40% opacity; the reason belongs to the caller. */
          "disabled:pointer-events-none disabled:opacity-40",
          "[&[data-state=open]>svg]:rotate-180",
          copyLink && "pe-14",
          FOCUS_RING,
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown
          aria-hidden
          strokeWidth={1.5}
          className="pointer-events-none size-5 shrink-0 text-graphite transition-transform duration-(--dur-fast) ease-(--ease-settle) in-data-[theme=navy]:text-mist motion-reduce:transition-none"
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

/* ————————————————————— content ————————————————————— */

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      forceMount
      data-slot="sf-accordion-content"
      className="group/panel"
      {...props}
    >
      <div
        className={cn(
          /* §4.6 · Part 14: 0fr → 1fr at 350ms on the house curve. The
             `visibility` leg rides the same transition so the panel leaves
             the tab order and the a11y tree only once it is fully closed. */
          "invisible grid grid-rows-[0fr] transition-[grid-template-rows,visibility] duration-(--dur-base) ease-(--ease-luxury)",
          "group-data-[state=open]/panel:visible group-data-[state=open]/panel:grid-rows-[1fr]",
          "motion-reduce:transition-none",
        )}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "pb-6 font-body text-body text-graphite in-data-[theme=navy]:text-mist",
              className,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </AccordionPrimitive.Content>
  );
}
