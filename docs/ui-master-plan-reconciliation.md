# `RESINRIVA_2.0_UI_MASTER_PLAN.md` — reconciliation

**Verdict: 9.4% of the plan is work. The rest is already built, factually wrong
about this repo, or forbidden by the spec it claims to serve.**

The plan (26 Aug 2026) merges four earlier blueprints and carries a `⚠ VERIFY`
on nearly every entry plus twelve open questions in its Appendix F. This
document is that verification, run against `HEAD`: 213 deduplicated entries,
each opened in the file it names.

| Verdict | Count |
|---|---|
| Already built | 96 |
| Contradicts REDESIGN.md / the contract | 27 |
| Would break the build or the app | 25 |
| Moot — the premise does not exist here | 24 |
| Wrong tokens (right idea, unusable vocabulary) | 15 |
| Wrong path | 6 |
| **Genuinely actionable** | **20** |

Twelve of the twenty actionable items are shipped (§3). The rest are listed in
§6 with what blocks each.

---

## 1 · Why the plan does not apply as written

**1. Every storefront path is wrong.** Routes are `src/app/[locale]/(v2)/…`,
not `src/app/(public)/…`. The header is `src/components/storefront/site-header.tsx`,
not `components/layout/dynamic-header.tsx`; `src/components/layout/` holds two
files. `GradientMesh`, `CollectionsRail`, `TestimonialCarousel`,
`VelocityMarquee`, `InstagramFeed`, `ScrollReveal`, `SITE_IMAGES`,
`OFFSET_CLASSES` and `<Section tone>` do not exist anywhere in this repo.

**2. The design vocabulary is superseded.** The plan speaks v2.0 "Midnight
Gild" / v6 / v7: `--gold #d4af37`, `void`, `porcelain`, `electric`, `azure`,
`shadow-luxe-*`, Playfair Display, Manrope, `rounded-sm`. `CLAUDE.md:9-11`
marks those documents **superseded, history only**. The live system is
REDESIGN.md v3 "Liquid Luxury" (`src/styles/tokens.css`): obsidian ·
deep-ocean · sapphire `#164e6b` · mineral · sand · champagne `#b89b63` · ink ·
graphite · mist, Instrument Serif / Inter / JetBrains Mono, shadows `e1|e2|e3`.
Zero repo-wide hits for `gold`, `void`, `porcelain`, `electric`, `Playfair`.
`rounded-sm` is **0px** here (`globals.css:133`).

**3. `motion` is not installed — and its absence is a recorded decision.**
No `motion`, no `framer-motion`, no `embla-carousel-react`, no
`@radix-ui/react-icons`, no `next-themes`. §5.2.2's "already present — no
action: motion@12 … embla" is false, which makes 21 of 24 Appendix A install
lines unrunnable and every Magic UI / React Bits / SmoothUI component
unbuildable. `src/components/motion/page-transition.tsx:8-14` records why:
*"a simple enter needs no animation runtime."* The budget is
`docs/redesign-contract.md:134` — **Motion JS ≤45KB gzipped**, already spent on
GSAP + ScrollTrigger + Lenis.

**4. `§5.2.4` would reintroduce a documented site-wide bug.** The plan's
replacement `src/lib/utils.ts` drops all six registered `classGroups` and the
exported `nullIfEmpty` / `monogram` / `formatINR` / `formatPriceBand` (30+
importers) — an instant typecheck failure. The comment at `utils.ts:27-31`
records that dropping the `12…76` step scale makes twMerge read `text-16` as a
*colour*, *"which broke every storefront Button's variant ink."*

**5. The register it closes is not this repo's register.** The plan's
`RR-01…RR-15` series exists nowhere here; `QA/03-MASTER-ISSUE-REGISTER.md`
holds a five-item security register `RR-001…RR-005`. Of the ~35 IDs in its
Appendix C, 22 are already closed **with the ID written into the source
comment** — UIUX-604 (`inquiries/[id]/page.tsx:90-96`), UIUX-610 (`CLOSED`
*and* `LOST` in the enum, `schema.prisma:196-197`), UIUX-608, RR-10
(`shop.ts:491-492`), DS-704, ENG-803, ENG-805, MKT-208/209/210. The plan read
the unticked boxes of `docs/audit-2026-07-implementation-plan.md` — whose first
line is an **ARCHIVED** banner saying every task shipped — as open work.

**6. The spec already did the restructure RS-01 proposes.** RS-01 wants 13
homepage folds collapsed to 9. REDESIGN.md Part 6 *prescribes thirteen* and
already deletes the duplicates RS-01 targets ("the current page renders 'From
liquid to light' twice — delete the duplicate"). The live homepage matches it:
13 sections, 2 dark bands, never adjacent, light final band. RS-01's fold 9 is
dark and would run straight into the obsidian footer — which
`scripts/redesign-audit.mjs:363-364` has a dedicated FAIL for.

---

## 2 · The head-on collisions with `docs/redesign-contract.md`

Each of these is a rule the plan's own components violate:

| Contract rule | Plan entries it kills |
|---|---|
| "No image fades in. Every image reveal goes through `MeniscusImage`." | PUB-04, PUB-13, PUB-24, `AppA/blur-fade` |
| "Blur in exactly one place: the sticky header." | PUB-01 (`ProgressiveBlur`), PUB-21 |
| "**No drop shadows on the storefront.** Two exceptions only." | PUB-07, PUB-09, PUB-11 (`shadow-luxe-*`) |
| Buttons: "120–180ms colour and underline only. **No scale, no lift, no glow.**" | PUB-10 (`ShimmerButton`), PUB-09/11 (`SpotlightCard`) |
| "No scroll-jacking beyond the single material-story pin and the process steps." | PUB-02 (`h-[140vh]` pin), `AppA/text-reveal` (`h-[200vh]`) |
| "Loading — flat `sand` skeletons at exact final dimensions. **No shimmer.**" | PUB-12 (SmoothUI skeleton) |
| Champagne: "Never a fill. Never a button background. **Max two per viewport.**" | PUB-06, PUB-08 (`Badge variant="gold"`), STU-18b |
| §3.7 "**Never an icon per benefit**" | PUB-07 (`BentoCard`'s required `Icon`) |
| §1.1 "If a redesign appears to need a data change, **stop and report it**" | PUB-08, STU-10, STU-35, PUB-30a |

Two plan "guards" instruct **deleting** spec-mandated behaviour:
`scaleOnHover={false}` (REDESIGN.md:695 *prescribes* the 1.03 image hover) and
"do not add a maps iframe" (§11.7 *mandates* the click-to-activate map, already
shipped and consent-gated).

---

## 3 · What shipped from this pass

Twelve items, restated in real paths and v3 tokens. No new dependency, no
schema change, no new i18n key except one paged title.

| # | Change | Origin |
|---|---|---|
| A1 | `catalog-product-card.tsx` renders its primary image through `MeniscusImage` | PUB-04, restated |
| A2 | `/studio/site-images` reads the staged row, badges it, and can publish it | **found by verification — not in the plan** |
| A3 | The announcement bar uses `SiteSettings.announcementHref` | PUB-38 |
| A4 | Dead `behold.so` origins removed from the CSP | PUB-21 |
| A5 | Four public files moved to logical properties | PUB-35a |
| A6 | `ReadingProgress` mounted on `/portfolio/[slug]` | PUB-28c |
| A7 | Shop filter transition renders skeletons, not a dimmed stale grid | PUB-12 |
| A8 | `ShareButtons` takes `kind` — blog shares stop counting as product shares | PUB-29d |
| A9 | `order_submit_failed` / `custom_order_submit_failed` now fire | MKT-007 |
| A10 | Wishlist WhatsApp hand-off carries `data-wa-source` | PUB-37 |
| A11 | `sku` in Product JSON-LD | RR-09 |
| A12 | `/shop?page=N` self-canonicalises | RR-05 |
| A14 | `cn()` registers the three real `animate-*` utilities | §5.2.4, salvaged |

**A1 is the one that mattered.** `src/app/[locale]/(v2)/page.tsx:384-391`
already *claimed* this card gets "the meniscus reveal every other card gets".
It did not — it was a plain `<Image>`, the single place the storefront
contradicted its own contract, across every shop tile, related rail and the
homepage hero piece. One file, using the idiom from `collection-card.tsx:68-76`.

**A2 was a live bug the plan never mentions.** Every write on
`/studio/site-images` stages into `draft` (`actions/site-images.ts:80-86`,
`130-141`, `178-183`), but the board selected only the published columns. The
owner set a focal point, got a success toast, and watched the crosshair snap
back to centre. Two image groups — `Navigation` and `Studio` — have no Site
Copy page at all (`site-copy/page.tsx:64` silently falls back to the first
group), so their staged changes could never be published from anywhere.

**A11 note.** The plan proposes `sku: importRef ?? slug`. `importRef` is a
*scraper dedupe key* (`schema.prisma:96-100`) holding the source site's own
reference; publishing it would put a supplier's internal identifier into public
structured data. The slug is used instead.

### Verification run

Every gate in the definition of done, against a real Postgres 16 and a real
`next build` (4,373 products, 20 portfolio cases bootstrapped):

```
typecheck ✓   lint ✓   test 322/322 ✓   copy:check ✓   i18n-missing 0 ✓   build ✓
redesign-audit  12 CI routes         @1440 ✓  @390 ✓
a11y-audit      12 CI routes         @1440 ✓  @390 ✓
redesign+a11y   /product /portfolio /blog /shop/wishlist /search   @1440 ✓  @390 ✓
redesign+a11y   /ar /ar/shop /ar/about /ar/contact /ar/blog /ar/privacy  @1440 ✓  @390 ✓
studio-audit    30 studio routes     @1440 ✓  @390 ✓
lighthouse      home 98/100/96/100 · plp 97/100/96/100 · LCP 1.0s/1.2s · CLS 0 ✓
```

A1 was additionally proved in-browser: 23 armed frames on `/shop`, **0 left
masked shut**, 20 revealed, 3 already-visible frames untouched (the "never a
flash" rule), **0 masked under `prefers-reduced-motion`**, **0 priority images
masked** (the LCP is never revealed), and no LCP regression. A2 was proved by a
full staged→published round-trip on `Navigation`, which wrote a
`ContentRevision`.

---

## 4 · Do not do — and do not rebuild

### Already built (do not rebuild)
`PUB-05` `PUB-11` `PUB-12` `PUB-14` `PUB-17` `PUB-18b/c` `PUB-22` `PUB-23`
`PUB-24` `PUB-25a` `PUB-26` `PUB-27` `PUB-28` `PUB-29a/b/c` `PUB-30a` `PUB-31`
`PUB-32` `PUB-33` `PUB-34` `PUB-36` `PUB-37` `PUB-38` `RS-02` `RS-04` `RS-06`
`STU-01…04` `STU-07…11` `STU-13` `STU-15` `STU-17…24` `STU-29` `STU-31c`
`STU-32` `STU-33`.

Notably: the mega menu, the search overlay + `/search` + ⌘K, the commission
Kanban, `/studio/subscribers` with formula-injection-guarded CSV export, the
product form split across 17 files, `useUnsavedChangesGuard` in seven forms,
`StudioTableHead` across 19 tables, the six-type block registry, and the
PDP pan-zoom magnifier (`gallery.tsx:125-139`) the plan wants to add.

### Would break the build
- **`§5.2.4`** replacing `utils.ts` — typecheck failure + the Button-ink regression.
- **`§5.2.3`** redefining `--success`/`--warning` — silently replaces
  contrast-audited values (`#2c6b5b` 5.5:1, `#8a6a1e`) already consumed at 12 sites.
- **`§5.2.3`** a bare `.dark {}` — reaches neither scope; the storefront uses
  `[data-theme="navy"]`, the Studio `@media (prefers-color-scheme:dark) .studio-v2`.
- **Letting the shadcn CLI write `globals.css`** — Magic UI's `marquee` writes
  `--animate-marquee` + `@keyframes marquee` into the same `@theme` layer where
  `globals.css:144-151` already defines them. The later wins **silently**,
  retiming every existing marquee.
- **Any Magic UI / React Bits / SmoothUI install** — all require `motion`.
- **`@gsap/react`** — needs a static `import { gsap }`, defeating the
  type-only + post-guard dynamic import in all 8 files of `components/motion/`.
- **`PUB-10`** edits `components/ui/button.tsx` — the `.studio-v2`-scoped
  shadcn button, 73 importers, **zero** under `(v2)`. Invisible on the storefront.
- **`PUB-22` code** — fetches `/api/search`, a route that never existed.
- **`PUB-36`/`STU-21`** the seven-type block table —
  `custom-blocks.test.ts:25` asserts exactly six, and `npm run test` gates every PR.
- **`RS-01`** — merging folds deletes registry keys that `PageSection` rows,
  `ContentRevision` history and cure ticks all reference.
- **Appendix A's "never install `three`"** — `three` is
  `@google/model-viewer`'s declared peer, added *after* the plan's claimed
  deletion date; removing it breaks the PDP GLB viewer. 3D-as-product is live.

### Moot — the premise does not exist
`PUB-03` (no marquee band — REDESIGN.md:531 deleted it) · `PUB-08` homepage
testimonials (carousel retired in Phase 7) · `PUB-18a` header-ink machinery
(`data-header-theme|data-ink` = 0 hits) · `PUB-19` footer `href="#"` (0 hits)
· `PUB-21` Instagram band (Behold removed) · `STU-12` (`text-electric` = 0
hits) · `DS-705` (`--electric` gone) · `R3` (`-webkit-backdrop-filter` = 0
hits) · `RR-11` (the contact action awaits `db.inquiry.create` before
returning) · `Risk-11`/`§11` (there is **no Playwright suite and no
`studio.js`** — `studio-audit.mjs` runs on every PR).

---

## 5 · Appendix F answered

1. **Tiptap or Lexical?** Tiptap (`@tiptap/*` in `package.json`).
2. **Gold or champagne?** Champagne `#b89b63`, plus `champagne-ink #75602f` for
   text on light. No `--gold` anywhere.
3. **next-intl `[locale]`?** Yes, v4.13.2, `localePrefix: "as-needed"`,
   `alternateLinks: false` deliberately (SEO-510). `src/proxy.ts` branches
   `/studio/**` to the NextAuth edge guard.
4. **Does `SearchOverlay` mount in the header?** Yes —
   `(v2)/layout.tsx:170`, opened from the header and the mobile bottom bar.
   UIUX-608 closed.
5. **Does the palette index entities?** Yes, `command-palette.tsx` with cmdk.
6. **Dashboard subscriber tile?** Yes. MKT-208 closed.
7. **`ArticleToc` / `ReadingProgress`?** Both exist, sticky, `aria-hidden`,
   scroll-mapped — no reduced-motion branch needed. Now on `/portfolio/[slug]` too.
8. **`focalX`/`focalY` on the slot?** Yes, `schema.prisma:794-795`, plus
   `mobileUrl` and `draft`. (The board could not *show* them — fixed, A2.)
9. **`resultsMeta` on case pages?** Yes, rendered as the spec strip.
10. **`Article` JSON-LD?** Yes, with `BreadcrumbList`.
11. **CSP report-only?** Yes (`next.config.ts:59`), sequenced behind the E-02
    image drain by `QA/03-MASTER-ISSUE-REGISTER.md`. Not a UI task.
12. **Studio password rotated?** Not traceable to anything in this repo.

**What gates a PR** (the plan's §11 checklist is wrong): typecheck · lint ·
copy:check · i18n-missing · vitest · a real `npm run build` against Postgres ·
`redesign-audit.mjs` + `a11y-audit.mjs` over 12 routes at 1440 **and** 390 ·
an authenticated `studio-audit.mjs` over 30 studio routes at both widths ·
`lighthouse-audit.mjs` (perf ≥85, a11y ≥95). The a11y gate is **0
critical/serious**, not "0 violations".

---

## 6 · What genuinely remains

Real, unmet, and not shipped here — each needs a decision or a batch this pass
deliberately did not open.

**Ready to build (no blocker, just scope):**
- `STU-06` — row treatment diverges across 19 tables: sticky header on 2, two
  different hover classes, no zebra. A `StudioRow` primitive plus a migration.
- `STU-30` — `/studio/activity` is the studio's last v3 holdout (`text-xs`,
  `rounded-2xl`, `shadow-sm`); wants date-group headers and a per-actor filter.
- `STU-31` — no SERP preview or length feedback anywhere in SEO editing.
  `CharCounter` exists; its signature is `{ length, max, className }`, **not**
  the plan's `{ value, label }`.
- `STU-18d` — the focal control is mouse-only (`onClick` on a bare `<div>`).
  Needs `tabIndex`, arrow-key nudge, an `sr-only` readout.
- `PUB-35c` — **nothing in CI ever loads an RTL route.** `AUDIT_ROUTES` is
  English-only, while the repo carries 29 `rtl:` variants and 4 JS direction
  inversions. Adding `/ar,…` costs two CI steps and no new script. *(Verified
  clean by hand in this pass — but nothing keeps it that way.)*
- `MKT-006` — `Testimonial.avatarUrl` **already exists** and is never rendered.
  The plan's "(includes a Prisma migration)" is wrong for the photo itself.

**Blocked on an owner or spec decision:**
- `verified` / `productId` on `Testimonial`, `Inquiry` priority, workshop
  session dates, a PDP price-tier matrix — all schema changes. §1.1: stop and report.
- `STU-34` WhatsApp quick-reply templates — genuinely absent, but *where they
  live* is undecided; a new `SiteSettings` column is a migration.
- `RR-08` broken-media detection — persisting results needs a column.
- `STU-28` — the printable card is a **customer-facing authenticity card**; the
  plan's phone number + QR-to-`/studio` would leak staff data to the recipient.
  A bench slip is a second view, and the QR needs a dependency.
- `RR-005` CSP enforcement — sequenced behind the image drain; `script-src`
  still needs `'unsafe-inline'` for Next hydration, so it is not a rename.
- `src/lib/brand-colors.ts` is the **last live Midnight Gild surface**,
  correctly serving Satori OG cards, `manifest.ts` and `global-error.tsx` —
  layers CSS variables cannot reach. Those OG cards are the only images that
  reach a WhatsApp share preview. Nobody has decided whether that is acceptable.

**Keep from the plan:** the adapter *principle* (§2) — never let a library
component own business state — is sound and already how this repo is built.
Drop the `ui/animated/` + `adapters/` folders: `CLAUDE.md` names one shape and
says adding a surface means following it, "not inventing a ninth shape".
