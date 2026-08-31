/**
 * Named storefront copy slots — the text twin of `site-images.ts`.
 *
 * Every user-facing string on the storefront already has a stable address: a
 * next-intl key like `Home.hero.headline`. What it did not have was an owner.
 * A slot gives that key the same three things a site-image slot gives a
 * photograph — a plain-English label, the surface it appears on, and the
 * constraints an edit must not break — so `/studio/site-copy` can list it as
 * something a person can change rather than as a dotted identifier.
 *
 * The catalogues in `/messages` remain the source of DEFAULTS and stay in git.
 * A `SiteCopy` row overrides one key for one locale; no row means the key
 * renders its shipped default. So an empty table renders today's site exactly,
 * "reset to default" is a DELETE, and a database outage degrades to the
 * shipped copy rather than to a blank page — the guarantee `getSiteImages()`
 * already provides, extended to words.
 *
 * Plain module, no server imports: read by the RSC pages, the studio screen
 * and the generator script alike.
 */
import { GENERATED_COPY_SLOTS } from "./site-copy.generated";
import { COPY_SLOT_OVERRIDES } from "./site-copy.labels";

/** What the string does in the layout — drives the editor's field shape. */
export type CopyKind =
  | "eyebrow" // the mono micro-line above a heading
  | "heading" // section headings and page titles
  | "body" // paragraphs and lead copy
  | "cta" // button and link labels
  | "label" // form labels, table headers, badges
  | "alt" // image alternative text
  | "meta" // <title> and meta description
  | "micro"; // helper text, hints, validation messages

export type CopyTier =
  /** Copy the owner writes: headlines, body, eyebrows, CTAs, alt text. */
  | "editorial"
  /** Copy the interface needs: validation strings, aria labels, pagination. */
  | "interface";

/**
 * Surfaces, in the order the studio board lists them. Shares its vocabulary
 * with `SITE_IMAGE_GROUPS` wherever the two overlap, so one mental model
 * covers both words and pictures.
 */
export const COPY_GROUPS = [
  "Homepage",
  "About",
  "Process",
  "Workshops",
  "Commission",
  "Large format",
  "Contact",
  "Portfolio",
  "Journal",
  "FAQ",
  "Shop",
  "Legal",
  "Site chrome",
  "System",
] as const;

export type CopyGroup = (typeof COPY_GROUPS)[number];

export type CopySlot = {
  /** Full next-intl path — the join key against `messages/*.json`. */
  key: string;
  group: CopyGroup;
  /** Section within the surface, so the board can nest. */
  section: string;
  /** What the owner is changing, in their words. */
  label: string;
  kind: CopyKind;
  tier: CopyTier;
  /** Where it appears, so it can be found without hunting. */
  where?: string;
  /** Character budget — a meter in the UI, not a hard stop. */
  max?: number;
  /** ICU placeholders that MUST survive an edit, e.g. ["count"]. */
  vars?: readonly string[];
  /** Markup tags used by `t.rich` that MUST survive an edit. */
  tags?: readonly string[];
  /** Anything the owner needs to know before changing it. */
  note?: string;
  /**
   * No component appears to read this key. Reported by the generator, hidden
   * from the board — never auto-deleted, because the check over-approximates
   * reachability on purpose (see scripts/site-copy-registry.mjs).
   */
  orphan?: boolean;
};

/**
 * The registry: generated slots with the hand-written overlay layered on top.
 *
 * The generator decides what it can derive (surface, kind, ICU placeholders,
 * reachability). The overlay supplies what needs a human sentence — a real
 * label, where the string appears, a tighter character budget, a warning. Only
 * keys where the derived answer is not good enough need an entry.
 */
export const COPY_SLOTS: readonly CopySlot[] = GENERATED_COPY_SLOTS.map(
  (slot) => {
    const override = COPY_SLOT_OVERRIDES[slot.key];
    return override ? { ...slot, ...override } : slot;
  },
);

const SLOT_BY_KEY = new Map(COPY_SLOTS.map((slot) => [slot.key, slot]));

/** Slots the owner is offered — everything reachable from a component. */
export const EDITABLE_COPY_SLOTS: readonly CopySlot[] = COPY_SLOTS.filter(
  (slot) => !slot.orphan,
);

export function isCopyKey(key: string): boolean {
  return SLOT_BY_KEY.has(key);
}

export function copySlot(key: string): CopySlot | undefined {
  return SLOT_BY_KEY.get(key);
}

/** Groups that actually carry at least one editable slot, in board order. */
export function copyGroupsInUse(): CopyGroup[] {
  const present = new Set(EDITABLE_COPY_SLOTS.map((s) => s.group));
  return COPY_GROUPS.filter((g) => present.has(g));
}

/* ═══════════════════════ the merge ═══════════════════════ */

export type CopyOverrides = Record<string, string>;

/** A message catalogue: nested objects bottoming out in strings. */
export type MessageTree = { [key: string]: string | MessageTree };

/**
 * Layer owner overrides onto a message catalogue.
 *
 * COPY-ON-WRITE, and that is a correctness requirement rather than an
 * optimisation. `await import("../../messages/hi.json")` returns a CACHED
 * module namespace: the same object is handed to every request in the process.
 * Mutating it in place would persist one visitor's resolved overrides into
 * every subsequent request — and, because the object is shared, would survive
 * long after the row that caused it was deleted. So each overridden path is
 * rebuilt down its spine and every untouched branch is shared by reference.
 *
 * With no overrides the base catalogue is returned unchanged, by reference:
 * the overlay costs nothing until the owner actually edits something.
 */
export function applyCopyOverrides(
  base: MessageTree,
  overrides: CopyOverrides,
): MessageTree {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return base;

  let out = base;
  for (const key of keys) {
    out = setPath(out, key.split("."), overrides[key]);
  }
  return out;
}

/**
 * Rebuild one path with a new leaf, sharing every sibling by reference.
 *
 * Returns the node unchanged when the path does not exist in the catalogue or
 * runs through a string — a renamed key survives in the table until someone
 * clears it, and a stale row must not be able to graft a property onto an
 * object that no longer expects one.
 */
function setPath(
  node: MessageTree,
  path: string[],
  value: string,
): MessageTree {
  const [head, ...rest] = path;
  if (!(head in node)) return node;

  if (rest.length === 0) {
    // Only replace a leaf. A row whose key now names a whole namespace must
    // not flatten that namespace into a string.
    if (typeof node[head] !== "string") return node;
    return { ...node, [head]: value };
  }

  const child = node[head];
  if (typeof child !== "object" || child === null) return node;
  const next = setPath(child, rest, value);
  if (next === child) return node;
  return { ...node, [head]: next };
}

/* ═══════════════════════ validation ═══════════════════════ */

/** ICU argument names in a message, including plural/select forms. */
export function icuVars(value: string): string[] {
  const out = new Set<string>();
  const re = /\{\s*([a-zA-Z0-9_]+)\s*(?:,|\})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) out.add(match[1]);
  return [...out];
}

/** Markup tags used by `t.rich`, which map to React components. */
export function richTags(value: string): string[] {
  const out = new Set<string>();
  const re = /<([a-zA-Z][a-zA-Z0-9]*)>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value))) out.add(match[1]);
  return [...out];
}

/**
 * Why a candidate override is refused, phrased for the person who typed it.
 *
 * Returns null when the value is acceptable. Every message names the thing to
 * do next, because the owner WILL hit the placeholder rule and a validation
 * code would leave them stuck.
 */
export function describeCopyProblem(
  slot: CopySlot,
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null; // empty means "reset", handled by the caller

  const required = slot.vars ?? [];
  if (required.length) {
    const present = new Set(icuVars(trimmed));
    const missing = required.filter((name) => !present.has(name));
    if (missing.length) {
      const list = missing.map((n) => `{${n}}`).join(", ");
      return `This text uses ${list} to fill in a live value. Keep ${
        missing.length > 1 ? "them" : "it"
      } somewhere in your version.`;
    }
  }

  const tags = slot.tags ?? [];
  if (tags.length) {
    const present = new Set(richTags(trimmed));
    const missing = tags.filter((name) => !present.has(name));
    if (missing.length) {
      const list = missing.map((n) => `<${n}>`).join(", ");
      return `This text uses ${list} for formatting. Keep ${
        missing.length > 1 ? "those tags" : "that tag"
      } in your version.`;
    }
  }

  // Unbalanced braces parse as a syntax error at render, on a cached page.
  let depth = 0;
  for (const char of trimmed) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    return "The curly brackets do not match up. Every { needs a closing }.";
  }

  if (/<\s*script/i.test(trimmed) || /javascript:/i.test(trimmed)) {
    return "That looks like code rather than copy, so it has not been saved.";
  }

  // The budget is design guidance and some languages genuinely need more room,
  // so it warns in the UI rather than blocking. Twice the budget is no longer
  // a long translation, it is the wrong text in the wrong slot.
  if (slot.max && trimmed.length > slot.max * 2) {
    return `This is much longer than the space allows (${trimmed.length} characters against about ${slot.max}). Shorten it, or pick a different field.`;
  }

  return null;
}
