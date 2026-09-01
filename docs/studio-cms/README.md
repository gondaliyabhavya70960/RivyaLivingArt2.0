# Studio CMS — Making Every Word and Every Picture Editable

> [!IMPORTANT]
> **Plan documents frozen at their writing date.**
> The files in this directory (`docs/studio-cms/`) are original design and planning documents preserved for historical rationale. Numbers reflect the initial spec (such as 57 image slots, whereas the shipped total is 62 slots). **`CLAUDE.md` and `PROJECT_STATE.md` are the current-state authorities.**

**Goal:** every word, image, link and section on `www.rivyalivingart.com`
editable from `/studio`, with no deploy.

> ## ✅ Built.
>
> All eight phases shipped. The plan below is kept as written — the reasoning
> is why the code looks the way it does — but it is now a record rather than a
> proposal. What actually landed, and where it differs from the plan:
>
> | Phase | Shipped as | Notes |
> |---|---|---|
> | 0 | groundwork | `revalidatePath("/", "layout")` removed; the champagne check fixed so it can fire at all; 34 orphaned strings per locale deleted |
> | A | `/studio/site-copy` | 1,115 slots, generated + `npm run copy:check` in CI |
> | B | `/studio/site-images` | 57 slots, mobile crops, focal points |
> | C | `/studio/forms` | `FormOption`, plus business hours and announcement scheduling |
> | D | `/studio/navigation` | header · drawer · footer |
> | E | draft → preview → publish | staged per SURFACE, with `ContentRevision` history |
> | F | `/studio/sections` | **six pages**, not one — see below |
> | G | `/studio/custom-pages` | `/p/<slug>`, six block types, read-time scheduling |
> | H | media depth | ingest, dedupe, alt, "unused" and "no description" filters |
> | I | close the content gaps | taxonomy names in 9 languages, frame captions, asset provenance + the AI filter |
>
> **Where the plan was not followed, and why:**
>
> - **`usageCount` was not added** (planned in `03`). A denormalised counter has
>   to be maintained at every site that writes a media URL — the exact thing
>   that silently stops happening — and a stale counter behind a DELETE button
>   is worse than no button. The "Unused" filter asks the live scan in batches.
> - **Scheduling is resolved at read time, not by a cron** (planned in `07`).
>   A launch that depends on a job having fired is the one thing nobody can
>   check on the morning of a campaign.
> - **The section manifest covers six pages, not all of them.** `/shop`,
>   `/blog`, `/portfolio` and `/faq` are a hero plus their listing; hiding the
>   listing makes the page pointless.
> - **The landing-page closing band has no dark option.** It had one until
>   `redesign-audit.mjs` failed the page: the obsidian footer sits directly
>   below, so a dark band there always violates §3.1.
> - **Both audits now gate CI**, which `10-landmines.md` §10.8 had flagged as
>   the weak point in relying on them. That entry is resolved.

This guide is written against **the repository**, not a crawl of the deployed
site. Where it disagrees with the uploaded *"Rivya Living Art Studio — Master CMS Spec
v2"*, the disagreement is deliberate and evidenced — see
[`09-spec-reconciliation.md`](09-spec-reconciliation.md).

---

## Read in this order

| | Document | For |
|---|---|---|
| 01 | [Content Inventory](01-content-inventory.md) | Every page, everything on it, where it lives today |
| 02 | [The Copy Layer](02-copy-layer.md) | **Start here to build.** All 1,149 strings, editable in a week |
| 03 | [The Image Layer](03-image-layer.md) | 57 slots that already work, and the six gaps that remain |
| 04 | [The Structure Layer](04-structure-layer.md) | Order, visibility, switches, one editor per page |
| 05 | [Globals & Business Config](05-globals-and-business-config.md) | Nav, footer, commission dropdowns, hours, SEO |
| 06 | [Governance](06-governance.md) | Draft, preview, publish, revisions, roles, audit |
| 07 | [Build Order](07-build-order.md) | Eight phases, all shipped; what "done" meant for each |
| 08 | [Owner Handbook](08-owner-handbook.md) | "I want to change X" → where X is |
| 09 | [Spec Reconciliation](09-spec-reconciliation.md) | What the v2 spec got right, and what has changed since its crawl |
| 10 | [Landmines](10-landmines.md) | Ten verified hazards specific to this repo; §10.8 resolved |

---

## The finding that reshapes the plan

The uploaded spec's central premise is that the content is trapped in code:

> *"~85% of visible words live in `.tsx` files."*

**That is not this repository.** Measured, not assumed:

| | Evidence |
|---|---|
| Every user-facing string goes through next-intl | 1,149 English strings across 29 namespaces in `messages/en.json`; all nine locales carry the same key tree |
| Even alt text is keyed | `About.materials.alt1…4`, `CustomOrder.page.heroImageAlt` |
| Every editorial photograph is a named slot | 57 slots in `src/lib/site-images.ts`, 25 bundled files, already replaceable at `/studio/site-images` |
| No hardcoded image path survives in any component | `grep -rn '"/media/\|src="/' src/app src/components` → no matches outside the slot registry |
| No component authors a raw `<img>` for content | Third-party catalogue URLs are mirrored to Blob by `src/lib/catalog-mirror.ts`; an unmirrored host renders through `next/image` with `unoptimized`, which still emits an `<img>` — that is almost certainly what the crawl read as hotlinking (`src/lib/image-src.ts:24`) |
| Every storefront route is already ISR | `export const revalidate = 300` on fourteen routes |
| Draft-mode preview already exists, ISR-safe | `src/app/api/draft/route.ts` |

So the content is not trapped. It is **already addressed by a stable key** —
`Home.hero.headline` for a word, `home.hero` for a picture. The job is not
extraction. The job is to let the database win over the file.

### What that changes

The spec proposes lifting all copy into 24 section types with Zod schemas and
rewriting the components to be props-driven. Thirty-one days, and the owner's
first editable headline arrives on day fourteen.

This plan instead **extends the pattern the repo already uses for pictures**:

```
                registry in code            overrides in DB           resolver
pictures   site-images.ts (57 slots)   →   SiteImage rows      →   getSiteImages()   ✅ shipped
words      site-copy.ts   (1,149 keys) →   SiteCopy rows       →   getSiteCopy()     ← Phase A
structure  page-sections.ts (~50)      →   PageSection rows    →   getPageSections() ← Phase F
```

One table, one resolver, one merge point in `src/i18n/request.ts`, one studio
screen. `t("Home.hero.headline")` keeps working unchanged — it just resolves
against merged messages. **Every word on the site becomes editable inside a
week, and not one page component is touched.**

---

## The architecture in one picture

```
┌─────────────────────────── /studio ────────────────────────────┐
│                                                                │
│  Pages ──────────► the page editor, one screen per page        │
│    │                joins the three registries below           │
│    ├── Site Copy ──────────► SiteCopy      (key, locale)       │
│    ├── Site Images ────────► SiteImage     (slot key)          │
│    └── Sections ───────────► PageSection   (order, enabled)    │
│                                                                │
│  Catalogue ─► Product · Category · Portfolio · Journal · FAQ   │
│  Globals ───► SiteSettings · NavMenu · FormOption              │
└────────────────────────────────────────────────────────────────┘
                              │
                    tag-scoped revalidation
                    (by tag, not path — see 10 §10.4)
                              ▼
┌──────────────────────── storefront ────────────────────────────┐
│  messages/*.json  ──┐                                          │
│                     ├─► applyCopyOverrides ─► t("…")           │
│  SiteCopy rows    ──┘   (copy-on-write; no overrides = no clone)│
│                                                                │
│  SITE_IMAGE_FALLBACKS ─┐                                       │
│                        ├─► getSiteImages() ─► total map        │
│  SiteImage rows      ──┘                                       │
│                                                                │
│  PAGE_SECTIONS ────────┐                                       │
│                        ├─► getPageSections() ─► render order   │
│  PageSection rows    ──┘                                       │
└────────────────────────────────────────────────────────────────┘
```

Three properties this shape guarantees, each of which is a production incident
avoided:

1. **Defaults live in git, overrides live in the database.** An empty table
   renders today's site byte-for-byte. A database outage degrades to the
   shipped content, never to a blank page — the guarantee
   `getSiteImages()` already provides, extended to words and structure.
2. **Reset is a `DELETE`.** There is no "restore the original" content to
   maintain, because the original never left the repository.
3. **Every migration is additive.** New tables and new nullable columns only.
   No backfill, no down-migration, and a failed deploy rolls back cleanly
   because the previous build simply ignores the new tables.

---

## The governing rule

**Fixed registry, editable content.** Every editable thing is declared once in
code — a copy key with a character budget, an image slot with a ratio, a
section with a whitelisted set of switches. Editors change words, pictures,
order and visibility. They cannot invent layouts.

This is why there is no "Custom HTML" block anywhere in this plan. One such
block and the rule collapses — it is an XSS vector and it guarantees layout rot
within a year. The uploaded spec rejects it for the same reason; this plan
keeps that rejection.

The boundary, stated so it does not erode:

```
EDITABLE                          NOT EDITABLE
words, in 9 languages             component architecture
photographs and their alt text    typography scale and fonts
section order and visibility      colour tokens (beyond the logo)
a whitelist of switches           spacing, breakpoints, easing
catalogue and editorial entities  database schema, auth, routes
nav links, form options           the WhatsApp order construction
announcement, hours, socials      arbitrary HTML / CSS / JS
```

---

## Non-negotiables this plan is built around

From `CLAUDE.md` and REDESIGN.md §1.1, unchanged by anything here:

- **No payment gateway, no cart, no customer accounts.** Every order finalises
  through WhatsApp: Place Order → save an `Inquiry` → open `wa.me/…` with the
  full pre-filled message. Phase C touches the commission form's *option list*
  and nothing else in that path.
- **No AI-invented products.** The catalogue is filled only by the owner.
- **The design system is not the editor's to break.** Max three dark bands and
  never adjacent, one `h1`, two champagne accents per viewport, numbers in
  mono, no raw hex, one `priority` image per page. `scripts/redesign-audit.mjs`
  and `scripts/a11y-audit.mjs` already enforce these in CI; the studio must
  enforce them at save time, because CI does not run when the owner presses
  Publish.
- **Arabic is a shipped locale.** Logical properties everywhere in any new
  markup — an unmirrored RTL is worse than none.

---

## If you only do one thing

Build **Phase 0 then Phase A** ([`07`](07-build-order.md),
[`02`](02-copy-layer.md)). One day of fixes to live defects the CMS would
inherit, then five days for one new table, fifteen lines in
`src/i18n/request.ts`, and one studio screen. It hands the owner every word on
the site in nine languages, it cannot break a page it does not have a row for,
and reverting it is a one-file revert.

Everything after it is an improvement to a site that is already theirs.
