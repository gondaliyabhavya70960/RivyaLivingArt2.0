# 02 — The Copy Layer (`Site Copy`)

**The single highest-leverage change in this plan.** It makes all 1,149
storefront strings editable from `/studio`, in nine languages, in roughly a
week, without touching a single page component.

---

## 2.1 Why an overlay and not an extraction

The uploaded spec assumes the copy is trapped in `.tsx` files ("~85% of visible
words live in `.tsx`") and therefore proposes lifting all of it into 24
section types with Zod schemas — 31 working days before the owner can change a
headline.

That is not this repo. Every user-facing string already goes through next-intl:

| Fact | Evidence |
|---|---|
| 1,149 English strings, 29 namespaces | `messages/en.json` |
| All nine locales carry the same key tree | `messages/{ar,de,es,fr,gu,hi,ja,zh}.json` |
| Pages read copy with `getTranslations(ns)` | e.g. `src/app/[locale]/(v2)/about/page.tsx:26` |
| Even alt text is keyed | `CustomOrder.page.heroImageAlt`, `About.materials.alt1…4` |
| Every storefront route is already ISR | `export const revalidate = 300` on 14 routes |

So the copy is not trapped — it is **already addressed by a stable key**. The
job is not extraction. The job is to let the database win over the JSON file.

That is exactly the shape the repo already uses for pictures:

```
site-images.ts  (registry of slots + bundled defaults)
        ↓
SiteImage rows  (owner overrides; no row = default)
        ↓
getSiteImages() (total map, unstable_cache, tag-invalidated)
```

**Site Copy is the same pattern applied to text.** One table, one resolver,
one merge point, one studio screen. Nothing downstream changes, because
`t("Home.hero.headline")` keeps working — it just resolves against merged
messages.

> **Design rule.** The JSON files stay the source of *defaults* and stay in
> git. The database only ever holds *overrides*. An unset key falls through to
> the JSON exactly as today, so a database outage degrades to the shipped copy
> instead of a blank page — the same guarantee `getSiteImages()` gives.

---

## 2.2 Schema

```prisma
/// Owner overrides for storefront copy. The message catalogues in /messages
/// remain the defaults and stay in git; a row here replaces one key for one
/// locale. No row means the key renders its shipped default, so the site is
/// never broken by a missing row and "reset to default" is a DELETE — the
/// same contract as SiteImage.
model SiteCopy {
  /// next-intl message path, e.g. "Home.hero.headline".
  key       String
  /// Locale code from src/i18n/config.ts. One row per key per locale.
  locale    String
  /// The replacement text. Never empty — an empty edit deletes the row.
  value     String   @db.Text
  updatedAt DateTime @updatedAt
  updatedById String?

  @@id([key, locale])
  @@index([locale])
}
```

Two columns of note:

- **No `draftValue`.** Draft/publish arrives in Phase E (`06-governance.md`)
  and applies to the whole copy layer at once; adding a half-built draft
  column now would mean two migrations and a live table with a column nothing
  reads.
- **`@db.Text`, not `String`.** Some legal and process paragraphs run past 255
  characters today.

---

## 2.3 The slot registry

A bare key/value table is unusable by a human: `Home.why.factCommissions` tells
the owner nothing. Each key needs the same three things a site-image slot
carries — a plain-English label, where it appears, and what it must not break.

`src/lib/site-copy.ts`:

```ts
export type CopyKind =
  | "eyebrow"   // the mono micro-line above a heading
  | "heading"   // section headings and page titles
  | "body"      // paragraphs and lead copy
  | "cta"       // button and link labels
  | "label"     // form labels, table headers, badges
  | "alt"       // image alternative text
  | "meta"      // <title> and meta description
  | "micro";    // helper text, hints, validation messages

export type CopyTier =
  /** Copy the owner writes: headlines, body, eyebrows, CTAs, alt text. */
  | "editorial"
  /** Copy the interface needs: validation strings, aria labels, pagination. */
  | "interface";

export type CopySlot = {
  /** Full next-intl path — the join key against messages/*.json. */
  key: string;
  /** Surface, sharing the vocabulary of SITE_IMAGE_GROUPS. */
  group: CopyGroup;
  /** Section within the surface, so the board can nest. */
  section: string;
  /** What the owner is changing, in their words. */
  label: string;
  /** Where it appears, so it can be found without hunting. */
  where: string;
  kind: CopyKind;
  tier: CopyTier;
  /** Character budget from REDESIGN.md, enforced as a meter, not a hard stop. */
  max?: number;
  /** ICU placeholders that MUST survive an edit, e.g. ["count"]. */
  vars?: string[];
  /** Markup tags used by t.rich that MUST survive an edit. */
  tags?: string[];
  note?: string;
};
```

### Generating it, not typing it

1,149 hand-written slot objects would rot on the first copy change. The
registry is **generated from `messages/en.json`** and then enriched by hand
only where a human label genuinely helps.

`scripts/site-copy-registry.mjs` walks `messages/en.json` and emits
`src/lib/site-copy.generated.ts`:

- `group` from the namespace (`Home` → `Homepage`, `About` → `About`,
  `CustomOrder` → `Commission`, …) using the same group vocabulary as
  `SITE_IMAGE_GROUPS`, so one mental model covers pictures and words.
- `section` from the second path segment (`Home.hero.headline` → `hero`).
- `kind` inferred from the leaf name: `*Eyebrow`→`eyebrow`,
  `*Headline|*Heading|*Title`→`heading`, `*Lead|*Body|*Intro|*Copy`→`body`,
  `*Cta|*Label` on a link→`cta`, `*Alt|alt*`→`alt`, `meta.*`→`meta`,
  `*Hint|*Placeholder|validation*|aria*`→`micro`.
- `tier` — `interface` for `kind: "micro"`, anything under `Common`,
  `Errors`, `OrderErrors`, `Upload`, `Consent`, and every `validation*` /
  `aria*` leaf; `editorial` for the rest. On today's catalogue that splits
  roughly 780 editorial / 369 interface.
- `vars` by parsing ICU placeholders (`{count}`, `{count, plural, …}`) — 90
  keys carry them.
- `tags` by parsing `<tag>` markup — 1 key carries it.
- `label` / `where` / `max` / `note` are **merged from a hand-written
  overlay**, `src/lib/site-copy.labels.ts`, which only needs entries for keys
  where the generated label is not good enough. Start with the ~120 keys of
  the homepage, About, Process and the commission form; let the rest fall back
  to a humanised leaf name (`heroHeadline` → "Hero headline").

A CI check (`node scripts/site-copy-registry.mjs --check`) fails the build when
`messages/en.json` gains a key the generated registry has not been regenerated
for — the same gate `scripts/i18n-missing.mjs` already provides for
translations.

> **Why keys, not free text, are the unit.** A section-shaped CMS would let an
> editor add a fourth "signature" step to a homepage designed for three. A key
> cannot: it edits the words in a slot the layout already reserves. That is the
> spec's own governing rule ("fixed registry, editable content") delivered
> without building 24 schemas first.

---

## 2.4 The resolver

`src/lib/site-copy-server.ts` — deliberately a near-copy of
`site-images-server.ts`, including the failure behaviour and the comment about
why it logs.

```ts
import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { isCopyKey } from "@/lib/site-copy";

export const SITE_COPY_TAG = "site-copy";

/** Overrides for one locale: { "Home.hero.headline": "…" }. */
export type CopyOverrides = Record<string, string>;

const readCopyRows = unstable_cache(
  async (locale: string) =>
    db.siteCopy.findMany({
      where: { locale },
      select: { key: true, value: true },
    }),
  ["site-copy"],
  { revalidate: 86400, tags: [SITE_COPY_TAG] },
);

export const getSiteCopy = cache(
  async (locale: string): Promise<CopyOverrides> => {
    // A DB hiccup must degrade to the shipped catalogue, never to a blank
    // page — but it must not do so silently. Same reasoning as getSiteImages.
    const rows = await readCopyRows(locale).catch((error: unknown) => {
      console.error("Site copy unavailable — falling back to defaults:", error);
      return [];
    });

    const out: CopyOverrides = {};
    for (const row of rows) {
      const value = row.value.trim();
      // Ignore rows for keys that no longer exist (a renamed key survives in
      // the table until someone clears it) and rows that were blanked.
      if (value && isCopyKey(row.key)) out[row.key] = value;
    }
    return out;
  },
);
```

Cache reasoning matches `site-images-server.ts` verbatim: 24h TTL because this
is read on every route and route ISR is `min(segment, cached reads)` — a short
TTL here would cap the PDP's 24h revalidate.

---

## 2.5 The merge point — one file, fifteen lines

`src/i18n/request.ts` is the only place that changes:

```ts
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../../messages/${locale}.json`)).default;
  const overrides = await getSiteCopy(locale);

  return { locale, messages: applyCopyOverrides(base, overrides) };
});
```

### `applyCopyOverrides` — the one place a bug would be expensive

```ts
/**
 * Layer owner overrides onto a message catalogue.
 *
 * COPY-ON-WRITE, and that is not an optimisation — it is a correctness
 * requirement. `await import(...)` returns a CACHED module namespace: the same
 * object is handed to every request in the process. Mutating it in place would
 * persist one visitor's locale edits into every subsequent request, in every
 * locale that shares the object. So each overridden path is rebuilt down its
 * spine and every untouched branch is shared by reference — with 1,149 keys
 * and a handful of overrides this copies a few objects, not the catalogue.
 */
export function applyCopyOverrides(
  base: Messages,
  overrides: CopyOverrides,
): Messages {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return base;          // the common case: no clone

  let out: Messages = { ...base };
  for (const key of keys) {
    out = setPath(out, key.split("."), overrides[key]);
  }
  return out;
}

function setPath(node: Messages, path: string[], value: string): Messages {
  const [head, ...rest] = path;
  if (rest.length === 0) return { ...node, [head]: value };

  const child = node[head];
  if (typeof child !== "object" || child === null) return node; // stale key
  return { ...node, [head]: setPath(child as Messages, rest, value) };
}
```

### The second safety net

`src/i18n/request.ts` currently sets no `onError` and no `getMessageFallback`,
which means next-intl renders an unresolvable message **as its own key path** —
`Home.hero.headline`, printed on the homepage. Save-time validation (§2.6) is
the first line; add the second while editing this file:

```ts
getMessageFallback({ key, namespace }) {
  const path = namespace ? `${namespace}.${key}` : key;
  return readFromBundle(path) ?? "";   // the shipped default, never the path
},
onError(error) { console.error("[i18n]", error); },
```

See `10`, §10.2.

### Three properties worth stating, because each is a real failure mode avoided

1. **No overrides ⇒ no clone, no allocation.** The overlay costs nothing until
   the owner actually edits something.
2. **A stale key is ignored, not written.** If `Home.hero.headline` becomes
   `Home.hero.title` in a future redesign, the old row cannot inject a
   `headline` property into an object that no longer expects one.
3. **The module namespace is never mutated.** This is the bug that would be
   found in production and not in review.

---

## 2.6 Validation — what the action must refuse

`src/actions/site-copy.ts` follows the house pattern exactly
(`requireStaff` → Zod → prisma → `logActivity` → `revalidateTag(…, "max")`,
returning `ActionResult`; see `src/actions/site-images.ts` for the model).

The interesting part is what it rejects:

| Rule | Why | Failure if missed |
|---|---|---|
| Key must be in the registry | Same guard as `isSiteImageKey` | A typo'd key writes a row nothing reads |
| Locale must be in `routing.locales` | — | Dead rows |
| **Every `{var}` in the default must appear in the override** | next-intl throws when a message references a value the call site does not pass, and vice versa the value silently disappears | `Home.collections.pieceCount` edited to "pieces" ⇒ counts vanish sitewide |
| **ICU plural/select structure must still parse** | 90 keys carry it | `IntlError: SYNTAX_ERROR` at render on a cached page |
| **Every `<tag>` in the default must appear in the override** | `t.rich` maps tags to components | Missing tag throws |
| Empty (after trim) ⇒ **delete the row**, not store `""` | Blanking is how an owner asks for the default back | A blank headline ships to production |
| Length ≤ `max × 2` (hard), meter at `max` (soft) | REDESIGN.md budgets are design guidance, not a cage | A 400-character "eyebrow" breaks the mono micro-line |
| Reject `<script`, `javascript:` and raw HTML outside declared tags | Copy is rendered as text, but defence in depth | XSS if a future surface renders copy as HTML |

The ICU check is the one that earns its keep. Implement it by parsing both the
default and the candidate with `@formatjs/icu-messageformat-parser`, then
comparing the set of argument names and their types. That package is already in
the tree at `3.5.15` (`package-lock.json`), pulled in by
`next-intl → use-intl → intl-messageformat` — but **add it to `dependencies`
explicitly** rather than reaching through the tree, or a future next-intl
release quietly breaks the validator.

Reject with the actual difference in the message — "this text used `{count}`;
your version does not" — because the owner will hit this, and a generic error
would leave them stuck with no idea which of their words was the problem.

---

## 2.7 The studio screen — `/studio/site-copy`

Extend `SiteImageBoard`'s shape rather than inventing a second idiom:

```
Site Copy                                      [ Homepage ▾ ] [ English ▾ ]
─────────────────────────────────────────────────────────────────────────
Search  [ liquid                        ]   ☐ Only changed   ☐ Show interface strings

▾ Hero                                                        3 changed
  Hero eyebrow            custom resin art · 3d printing…     Default   [Edit]
  Hero headline           Liquid luxury, cast forever.        Custom ●  [Edit] [Reset]
    ┌──────────────────────────────────────────────────────┐
    │ Liquid luxury, cast forever.                         │  28 / 80
    └──────────────────────────────────────────────────────┘
    Was: “Liquid luxury, cast forever.”            [Cancel] [Save]
  Hero lead               Rivya Living Art crafts bespoke resin…     Default   [Edit]
▸ The signature (3)
▸ The collections (26)
```

Non-obvious decisions, each with a reason:

- **Grouped by surface → section → key**, mirroring the Site Images board, so
  "change the About page" is one screen and not a search.
- **The default is always visible** under the field ("Was: …"). Without it an
  owner cannot tell whether they are improving the copy or re-typing it.
- **Locale tabs are a page-level switch**, not per-field. Editing English then
  Hindi is two passes; interleaving them is how half-translated pages happen.
  The tab shows a coverage count (`Hindi · 12 changed · 1,137 default`).
- **`Only changed`** is the review view — it answers "what has the owner
  actually altered?", which is the first question after any content incident.
- **`Show interface strings`** is off by default. 369 validation and aria
  strings between the owner and their headline is a worse screen.
- **Reset** is per key, per section and per page. Per-page reset needs a
  typed confirmation, like the media delete guard.
- **No rich text.** These are single strings in a designed layout. Rich text
  belongs to the legal pages, which already have Tiptap
  (`src/actions/pages.ts`).

Role gate: `requireStaff(["ADMIN", "EDITOR"])` for editing; `["ADMIN"]` for
page-level and site-wide reset, matching how Settings is ADMIN-only today
(`src/app/studio/(dashboard)/settings/page.tsx:15`).

---

## 2.8 What this does *not* solve

Stated plainly so the phase after it is not a surprise:

- **Order.** Sections still render in the order the component declares.
- **Visibility.** A section cannot be switched off.
- **Repetition.** The owner cannot add a fourth material or a fifth FAQ tile
  to a grid that reads four keys.
- **New pages.** Seasonal landers still need a deploy.

Those four are precisely the job of `04-structure-layer.md`. The point of doing
copy first is that after roughly a week, every word on the site is the owner's
— and the structural work can then be done calmly, page by page, with no
content pressure behind it.

---

## 2.9 Migration and rollback

**Migration:** one `CREATE TABLE`. No data migration, no backfill, no
seed — an empty `SiteCopy` table renders today's site byte-for-byte. That is
the whole reason the overlay is safe to ship on a live database.

**Rollback:** revert the `request.ts` merge. Rows stay in the table, unread.
There is no state to unwind and no content to re-enter.

**Verification before merge:**

```bash
npm run typecheck && npm run lint && npm run test && npm run build
node scripts/i18n-missing.mjs                     # unchanged: JSON is untouched
node scripts/redesign-audit.mjs "/en,/en/about"   # copy length budgets hold
node scripts/a11y-audit.mjs  "/en,/en/about"      # alt-text edits stay compliant
```

The last two matter more than usual here: `redesign-audit.mjs` enforces "no
ellipsis in an accessible name" and "alt text that describes the picture", and
this layer hands both of those to a human for the first time.
