> **ARCHIVED (2026-08-19).** This is the v7 "Sapphire Atelier" system, superseded by
> the owner's v2.0 master document **`/DESIGN.md`** ("Liquid Light × Midnight Gild",
> Claude Code Edition). `/DESIGN.md` Part 0 wins all conflicts. Kept for reference —
> existing code comments citing `design.md` refer to THIS file. Do not build new work
> from it.

# Design — ResinRiva (v7 · Sapphire Atelier — Grand Collection)

> **v4 amendment (2026-08-12, owner brief):** *"dark blue is my primary
> color … dark and light combine theme … Animation fill … gold is only for
> accent color, don't use too much gold … creative, modern and luxury …
> add creative 3d object relatable to resin."* Amended per the multi-page
> rule (§ amend, never override): the canvas moves from near-black to a
> **deep sapphire night**, every page must weave in **light porcelain
> bands** (combined theme), **sapphire replaces gold as the primary CTA
> fill** (gold survives only as hairline accents), the motion budget opens
> up to an orchestrated animation layer, and a real-time **3D resin form**
> (Three.js/R3F, `src/components/three/`) joins the system. Logo, products,
> type (Playfair + Manrope), chrome archetypes and families are unchanged.

A locked design system for this app, produced by `hallmark redesign` (multi-page
flow) + the ui-ux-pro-max generated system (2026-08-12, owner brief: "completely
redesign my full website … just don't change logo and product … modern and
latest design"). Every page redesign reads this file before emitting code. Do
not regenerate per page — extend or amend this file when the system needs to
grow.

Owner-fixed points: the ResinRiva script wordmark (`src/components/layout/logo.tsx`,
currentColor SVG — never edit), all product/portfolio/blog/testimonial DB
content, the WhatsApp-first ordering model (wa.me/917096036250 — never a
cart/checkout), routes and i18n architecture (9 locales, RTL).

**Adjusted** (per the repo's constraint-labelling rule): the master prompt's
"both themes first-class" and the v2 "light porcelain canvas" are superseded by
the owner's 2026-08-12 instruction — one fixed dark-led design. Hallmark's
OKLCH-token rule is Adjusted too: the brand token layer pre-dates the skill,
is owner-locked hex, and stays (values below are those hex tokens).

## Genre

Editorial — luxury register, **sapphire-led combined**. The canvas is the
deep-blue dark system (`.dark` token block, AA-tuned); light is a first-class
citizen: porcelain **paper** bands and sheets are woven through every page —
**each public page must carry at least one light band** so the dark/light
alternation reads site-wide. Deep blue leads, light breathes, gold is a
hairline.

## Macrostructure families

- **Marketing** (`/`, `/custom-order`, `/workshops`, `/whatsapp-order`,
  `/contact`): **Photographic family** — the generated imagery leads; full-bleed
  dark folds; text as annotation; ≤1 glass surface per page; each page varies
  hero archetype + fold rhythm, never theme/type.
- **Catalogue** (`/shop`, `/shop/[category]`, `/product/[slug]`, `/portfolio`,
  `/portfolio/[slug]`, `/search`): **Catalogue family** — the grid is the
  design; compact masthead over a hairline rule (`border-foreground/12`);
  uniform cards, no glow; captions as annotations.
- **Content** (`/about`, `/process`, `/faq`, `/blog`, `/blog/[slug]`,
  `/privacy`, `/terms`): **Paper-document family** — the reading column sits on
  a `paper` band (porcelain sheet, `tone="paper"`); the dark canvas frames it
  above and below. `/process` keeps its Narrative Workflow spine on the dark
  canvas with **sapphire ghost numerals** (v4 gold demotion), broken by the
  porcelain materials/timelines study band.

## Theme (token values — the locked brand palette, applied dark-led)

Semantic tokens live in `src/app/globals.css`; pages reference tokens/utilities
only — raw hex in a page file is a defect.

- Canvas (`--background` under `.dark`): `#061224` deep sapphire night
- Panel (`--card` dark): `#0f2440` navy · Void band: `#050b18` blue-black ·
  Paper band: `#f8f9fa` porcelain
- Ink (`--foreground`): porcelain on canvas, midnight `#0a1a2f` on paper
- `--sapphire #0f52ba` PRIMARY — CTA fill, links, focus, gradients ·
  `--azure #3b82f6` its dark-canvas text form (via `--sapphire-ink`)
- `--gold #d4af37` ACCENT ONLY — thin rules, star fills, one hairline moment
  per surface at most; never a button fill, never large areas
- Focus ring: `--ring` (azure `#5b9dff` on canvas, sapphire on paper)

## Typography

- Display: **Playfair Display** (`--font-display`), weights 500–700, roman
  only — italic headers are banned. Tracking −0.01em at display sizes.
- Body: **Manrope** (`--font-sans`), weights 400–600.
- Non-Latin scripts: **Noto Sans** Devanagari / Gujarati / Arabic / JP / SC via
  `--font-script` (body + display fallback), `preload: false`.
- Scale: existing `text-display` / `text-display-sm` clamp scale (anchor
  `clamp(3rem, 9vw, 11rem)`); body 1rem/1.7.
- 2+1 rule: two faces total; no third face.

## Spacing

Tailwind 4-pt scale (project standard). Section rhythm: `py-20 md:py-28`
default; paper sheets get interior `py-16 md:py-24`. Use utilities, never raw
values.

## Motion (v4: "Animation fill" — orchestrated, never ambient slop)

- Easing: `--ease-luxe` cubic-bezier(0.22, 1, 0.36, 1); UI transitions
  200 ms; never `transition-all`.
- Budget: **1–2 orchestrated moments per fold** (was ≤1) — a KineticHeading
  on hero/section heads plus one ScrollReveal group is fine; motion should
  feel alive, not decorative confetti.
- Animated surfaces: `gradient-dopamine` bands take `animate-gradient-pan`;
  `GradientMesh` allowed on the hero and one CTA band per page;
  `animate-float-slow` for hero ornaments; `VelocityMarquee` welcome.
- The 3D resin form (below) is the richest motion moment — one mount per
  page maximum, home hero is the primary mount.
- All color in motion stays in the blue family (mesh blobs, gradients,
  glows); gold never animates.
- Reduced motion: global collapse (already in globals.css) + `AmbientVideo`
  poster fallback + the 3D form renders a static frame.
- Image hover: opacity/duotone shift — never `scale-105`.

## 3D — product-only (v7; decorative 3D RETIRED)

The owner's master prompt (2026-08-13) draws a hard line: **3D as PRODUCT
= yes · 3D as DECORATIVE WEBSITE DESIGN = no.** The v4 `ResinForm` WebGL
hero object and the three/@react-three dependencies are removed; the hero
now leads with the filmed pour (`AmbientVideo`, poster-first,
reduced-motion safe) under a canvas scrim. What REMAINS, permanently:
`model3dUrl` product viewers (@google/model-viewer) on product pages, 3D
print product data (materials/filament, dimensions, print/production
time), the tier-4 catalog and its admin section. No decorative 3D objects,
backgrounds, or animations may return; resin materiality is expressed with
2D photography, film, gradients and light.

## Microinteractions stance

Silent success; hover transitions 150–300 ms; hover tooltip delay 800 ms /
focus 0 ms; `:focus-visible` ring always visible, never animated; cursor
feedback on all clickables. All 8 states on interactive components.

## CTA voice

- **Primary** (one per page, the highest-intent WhatsApp/order action):
  **sapphire solid**, `rounded-sm`, porcelain ink, shine sweep
  (reduced-motion hidden). Gold is never a button fill.
- **Secondary**: hairline outline in the local ink
  (`border-foreground/25 text-foreground`), `rounded-sm`.
- **Tertiary**: typographic underline link (`--sapphire-ink`).
- Pill silhouette exists only on the floating WhatsApp button (brand-functional).

## Chrome (every page shares)

- **Nav: N10 scroll-morph** — transparent full-width over the fold, morphs to a
  compact floating glass chip on scroll. Light ink always (canvas is dark).
- **Footer: Ft5 Statement** — oversized display statement + wordmark, then slim
  hairline link rows (keeps all current features: link sets, newsletter,
  locale switcher, WhatsApp, legal row).
- Announcement bar, floating WhatsApp button, breadcrumbs: re-skinned to
  canvas, features unchanged.

## Eyebrow / labels

`.eyebrow` = uppercase 0.75rem, weight 500, tracking 0.22em,
`--sapphire-ink` (scope-resolved, AA in both). **≤1 per page — the hero
only.** Data labels use the quiet micro-label register (`text-xs font-medium
tracking-[0.14em] uppercase text-sapphire-ink`). No numbered section tags
except `/process`.

## Paper-band mechanics (engineering)

`<html>` in the `[locale]` tree carries `class="dark"` — the whole public tree
(portals included) resolves the dark token set. `tone="paper"` on `Section`
applies the `paper` scope class, which re-declares the semantic tokens to the
light set + `color-scheme: light`. Never hand-roll a light area with literal
utilities; always the `paper` scope. Literal-utility rules: porcelain/azure ink
only on canvas/dark bands; midnight/ink literals only inside `paper`.

## What pages MUST share

Wordmark; the palette and gold discipline; Playfair + Manrope; CTA voice;
chrome (N10 nav, Ft5 footer); section rhythm; the paper-sheet treatment for
long-form reading.

## What pages MAY differ on

Macrostructure within their family; hero archetype; where the single paper
sheet or glass surface sits; grid density. Never theme, type, or CTA voice.

## Luxury commerce strategy (v5 addendum)

The site follows the top-10 luxury e-commerce playbook recorded in
`docs/luxury-ecom-strategy.md`: WhatsApp-first IS the clienteling model;
editorial commerce on paper sheets; SSENSE-quiet catalogue grids; "the
product is the demo" (the 3D resin form + ambient loops); scarcity only
when TRUE (made-to-order, one-of-one — never countdowns or fake stock);
trust signals AT the decision moment (PDP: provenance pillars, reply-time
promise, one-of-one line). Any new commerce surface must keep these rules.

## v6 — Grand Collection (2026-08-13, owner brief)

The owner's full redesign + data brief upgrades the Sapphire Atelier from a
marketing site into a four-tier catalog house. Everything above stays locked
(palette, Playfair+Manrope, CTA voice, gold ≤5%, band mechanics, N10/Ft5
chrome). What v6 adds:

**Catalog scale.** ~4,400 products across four tiers (owner · resin goods ·
supplies · 3D print) imported by `prisma/import-tiers.ts` from the owner's
sheet; taxonomy in `src/lib/catalog-taxonomy.ts` (8 new categories, three
ecosystem groups: art / supplies / print). Tier 1 carries the merchandising
weight (featured picks, home placements); supplies and 3D print present as
their own ecosystems, never mixed into the art shelves.

**Light-band rhythm.** The brief asks for first-class dark/light alternation.
Rule: marketing pages alternate canvas ↔ paper bands intentionally — at least
one generous paper band per marketing page, and the transition always lands on
a section boundary (`Section tone="paper"`, never hand-rolled). Catalogue
pages stay canvas-dark with paper reserved for the PDP reading sheet.

**Catalogue voice at scale.** Product cards carry availability, tier-aware
badges ("Studio original" for tier 1, "Atelier pick" for curated), hover image
swap (second image, opacity crossfade — never scale), and price bands.
Category pages open with a collection hero (v6 media band + intro copy +
featured row) before the grid — never a bare grid dump.

**Discovery.** Server-driven filters (ecosystem, category, price band,
availability, occasion) + sorts (featured/newest/price) with cursor
pagination and a total count; search gets pagination and relevance-ordered
sections. All state lives in the URL.

**Media.** `scripts/v6-media.json` → `public/media/v6/*.webp` (Cinema Studio
2.5, one art direction: deep sapphire night · porcelain daylight · antique
gold). Hero/atelier/collection/portfolio banners come from this set; ambient
v3 loops stay.

**Portfolio archive.** 20 seeded case studies (`prisma/seed-portfolio-cases.ts`)
with resultsMeta.technique/complexity/tags rendered as a spec strip on the
case page; archive page groups by category with editorial tiles.

## v7 — Master-prompt program (2026-08-13, second owner brief)

The owner's staged master prompt (data → research → audit → strategy →
phased implementation → admin → QA) extends v6. Records:

**Data governance.** Tier volumes are exact: 373 (all Tier-1 rows — the
sheet holds 373, not the brief's 374) / 1,000 / 2,500 / 500, selected in
THE SHEET'S OWN ORDER (no ranking column exists; the brief's rule for that
case). De-selected rows demote to DRAFT, never delete. Studio deletions of
imported rows write `DeletedImport` tombstones the importer honors —
deletions never resurrect. Foreign-currency sources (atomic-filament,
coex3d, apex-resin, resinpro) import with prices hidden ("Enquire") —
honest over wrong; external-store gift cards are excluded (the owner's own
Tier-1 gift card stays). Every import run persists a summary to
ActivityLog for the studio's Sheet Import Center.

**Research.** docs/product-ux-benchmark.md (20 sites, five clusters)
extends docs/luxury-ecom-strategy.md. Adopted this cycle: the light-play
gallery loop (product film autoplays muted on its slide), the
pour-variance note on art PDPs, ecosystem-gated PDP voice (commission
copy on art; functional voice on supplies/print), honest out-of-stock
flow (restock enquiry, never a fake order). Roadmap (owner decisions):
cross-tier "Made with / What this creates" provenance linking, Aesop-style
lexical spec fields per ecosystem, the /gifts occasion pathway.

**Audit.** docs/audit-v7.md (five lenses, adversarially verified: 4
Critical · 12 High · 27 Medium · 19 Low). All Criticals and Highs are in
the v7 fix program; Mediums/Lows are the maintenance backlog.

**Bottom-aligned fold heads (M-S6 ruling).** The home "Featured pieces" /
"Recent commissions" heads stay visually bottom-aligned — the lookbook
"look first, read after" close is a v4 signature, not an accident. The
a11y half is fixed structurally: the `h2` is FIRST in DOM (flex `order-*`
carries the visual position), so screen readers and `aria-labelledby` get
heading-before-content while sighted scanning keeps the editorial close.
Do not "fix" this by moving the visible head above the grid.

**Admin system (Phases 9-13).** The studio manages the full catalog:
server-paginated product table (count → clamp → skip/take, scoped select)
with tier/availability filters and columns; editor surfaces tier, stock,
read-only import provenance with honest overwrite semantics, and a tier-4
"3D printing" section; dashboard carries the per-tier catalog strip; the
Sheet Import Center (/studio/sheet-import) is the pipeline's single pane
of truth; the scraper center reconciles against the live sheet-fed
catalog and its approval path can no longer create cross-pipeline
duplicates. Studio remains English-only, light-themed (`:root` block).

## Verification bar (every phase)

`tsc --noEmit` · `eslint --max-warnings=0` · `npm run build` · band-audit v3
(0 flags: light-ink-on-paper / dark-ink-on-canvas) · ≤1 eyebrow per page body ·
no `transition-all` / `scale-105` / invented metrics · 375/768/1024/1440 sane ·
hreflang + 404 smoke · /hi + /ar spot-render.

## Exports

The Tailwind v4 `@theme inline` block in `src/app/globals.css` **is** the token
export for this project; `design.md` intentionally carries no duplicate token
file (single source of truth).
