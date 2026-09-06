# Transformation roadmap

Companion to `docs/transformation-audit.md` (Phase 0). This is the plan for the master prompt's Phases 1–17, re-sequenced to what the repository had at `HEAD f1cfd95` (three phases have merged since; see the status line below). Read the audit first; this document assumes its vocabulary, its decision numbers (D7–D28) and its risk register.

**Status (2026-09-04): every phase below is built on PR #42 (`claude/rivya-website-redesign-dc3jz0`),
after Phase 0 (PR #29), Phase 1a (PR #30), Phase 1b's ungated half (PR #31) and the testimonial schema
(PR #41). The remaining gates were answered on 2026-09-03 — D9/D26 commission framing for furniture and
rooms, D10/D20 Part 14 as the ceiling with the 18-pattern shortlist, D7/D8/D14 additive migrations with an
`isDemo` marker and demo content public only behind `SiteSettings.demoContentPublic` or off production,
D25 ten process steps ending in Delivery — and the batches landed in this order: B0 (schema and gates),
A1, B, G, C1, D, F1, E, A3, A2, A4, C2, F2. `CHANGELOG.md` carries one entry per batch with its merge
hash and the gates run on the merged head; `PROJECT_STATE.md`'s checkpoint block is the summary. Two
things stay owner-machine work: generating the planned Higgsfield sets recorded in
`docs/media-v3-manifest.json` (the CDN refuses the sandbox; `node scripts/media-v3-fetch.mjs --planned`
prints the queue and the generate → promote → cull → fetch sequence, since a planned entry has no
candidates for the fetch to find until `--promote` records them) and replacing the generated maker
portrait with a photograph.**

---

## 1. Rules this roadmap carries, verbatim

From `AGENTS.md` HARD RULES 1–5 and `CLAUDE.md`:

1. No payment gateway, online checkout or cart payment. Not behind a flag. Not "for later".
2. No customer login, membership or accounts. The only login is the staff studio at `/studio`.
3. No AI-invented products, ever. Never write a product, a price, a review, a testimonial or a portfolio item the owner did not supply. If a page needs content that does not exist, render nothing and say so.
4. Every order finalises through WhatsApp: Place Order → order summary → `Inquiry` via Server Action → `wa.me/917096036250` with the complete pre-filled message. Covered by `npm run test:e2e`.
5. The redesign changes the visual layer only. Product data, filtering, search, customization fields, uploads, Server Actions, auth, Studio/CMS behaviour, URLs and routes are off-limits to design work. A data change is its own change with its own justification.

From `PROJECT_STATE.md` DECISIONS (settled; do not re-litigate): **D1** WhatsApp only · **D2** keep and extend the bespoke Studio; new surfaces follow registry → overrides → total resolver · **D3** new imagery for the new domain; `resinriva/` paths untouched · **D4** CI: local verification, results reported explicitly (its premise, that Actions cannot allocate a runner, was disproved on 2026-09-02 by run #71 on PR #29; the evidence habit stays for what CI cannot reach, see D27) · **D5** commission-led positioning because the catalogue contains no furniture · **D6** supplies separated from the art storefront.

Culture: never fabricate (assets, rows, competitor data, scraper results, test results); reproduce the failure before fixing it; if you say it works, you have run it; every claim opened in the file it names; do not trust a green PR.

Design ceiling: REDESIGN.md v3 "Liquid Luxury" and `docs/redesign-contract.md`. Never invent colours, spacing or animation values. Part 14 is the motion ceiling. `MeniscusImage` is the only image reveal. Blur in one place. No storefront shadows but two. Champagne never a fill, max two per viewport. Dark bands max three per page, never adjacent. Motion JS ≤ 45 KB gzipped. Nothing moves the LCP.

Policy adopted from the audit §14: **install none of the inspiration libraries.** Port patterns by hand into `src/components/motion/` (GSAP behind the guards) or `storefront/` / `globals.css` (CSS), tokens only, logical properties, next-intl for strings.

---

## 2. Decision gates

The owner answers these before the phase that depends on them starts. Recorded answers go into `PROJECT_STATE.md` DECISIONS as D7…; this table says which phase each unblocks.

| Decision | Question (short form; full text in audit §15) | Blocks |
|---|---|---|
| D28 ✅ **YES (2026-09-03)** — the rewind stands; current `main` is authoritative and a discarded change is recovered only as its own reviewed PR | Does the rewind of `main` to `f1cfd95` stand? Twelve merged PRs (#15–#20, #22–#27: LQIP wiring, `.env.example`, doc corrections, uploads hardening, CSP enforcement, the four Phase 2e answers, slot counts, `mirror-images.yml` retirement) are reachable only at `refs/pull/<n>/head`; PR #28 was closed unmerged. If it stands, Phase 1a re-opens them one at a time with review; if not, `main` is restored to `950d9ac` and this branch rebased | 1a, and everything after |
| D7 | May schema changes proceed as their own additive PRs under this transformation? | 9, 11, 12, 13, 14 |
| D8 | Demo data: guarded non-production fixtures + additive `isDemo` marker, never in the production database? Is a Neon branch acceptable as the Content Lab environment? | 15, the "Demo products" tile in 10 |
| D9 | Furniture: commission-capability framing with bench/formwork concept imagery only? Are chairs and benches in scope at all? | 3 (§9 band), 4 (§21.3–8), SET A/F imagery |
| D10 | Motion: Part 14 stays the ceiling; adopt the 18-pattern shortlist; no cursor/magnetic/tilt/spotlight/trail? | 1, 2, 3 |
| D11 | Wishlist: amend REDESIGN §0 row 4 to permit it, or remove it? | 5 |
| D12 | Language selector stays in drawer/footer? | 2 |
| D13 | Deploy-time tier fill keeps publishing Tier 2–4 rows (D6) despite §36/§37? | 13, 14 |
| D14 | `ContentStatus` gains REVIEW and ARCHIVED for all four entities, or only the new Testimonial enum? Faq gets a `published` flag? | 9, 11 |
| D15 | Which blocks join the six-type catalogue, one at a time? | 11 |
| D16 | Process and Materials stay fixed-arity slots, or become registry-pattern entities? | 8, 11 |
| D17 | Design lab: rebuild small or retire? | 10 |
| D18 ✅ **YES (2026-09-03)** — by exact path, only the proven-unreferenced ones | Delete the dormant v2 files? | 1 |
| D19 | Re-skin OG cards, manifest and email to the v3 palette via `brand-colors.ts`? | 2 |
| D20 | Hero motion: text and video layer only, poster still? | 3 |
| D21 | Project `materials`, `dimensions`, `videoUrl` into `ShopProductItem` for the card? | 5 |
| D22 ✅ **YES (2026-09-03)** — keep the seed behind TWO barriers: an explicit opt-in flag AND an empty-data refusal | Portfolio seed provenance confirmed; gate the seed on an empty table? | 1 (hygiene) |
| D23 ✅ **YES (2026-09-03)** — remove it, with a regression test proving MANUAL + DONE writes nothing | Remove the legacy un-gated `syncSourceToSheet`? | 1 (hygiene), 13 |
| D24 ✅ **YES (2026-09-03)** — housekeeping approved; `.env.example` stays a separate owner change, its current state verified not assumed | Housekeeping: delete six workflows, tracked `.playwright-mcp/`, `audit/crawl-report.json`; archive superseded docs; owner edits `.env.example`? | 1 (hygiene) |
| D25 | Which of the ten process steps does the studio actually perform? | 8 |
| D26 | Room context: real delivered-piece photography, captioned concept rooms, or not at all? | 3, 12 |
| D27 | Retire D4's "CI cannot run" premise: Actions executes (run #71 on PR #29); make CI the gate of record and keep local runs for detail routes, E2E and extra widths; correct `AGENTS.md:188-190` and `PROJECT_STATE.md` | every phase's evidence |
| 2e-1…5 | `/shop?q=` descriptions; "Show all N pieces"; breadcrumbs; canonicals; old bookmarks | 5 |
| 2b | Swap hero primary/secondary CTA under commission-led positioning? | 3 |

Phases with no open gate can start as soon as Phase 0 is merged and D28 is answered: **1 (hygiene half), 2 (all but D12/D19 items), 10, 16 (all but CSP).** D28 is answered first because five of Phase 1a's items already exist as reviewed code in the discarded PRs.

---

## 3. Phase plan

Each phase is one branch off `origin/main` (the local `main` in a fresh session can be the stale "Initial commit"; always branch from `origin/main`) and one draft PR (the repository's convention, `AGENTS.md:194-197`; this session's assigned branch is `claude/session-6h1a70`, and subsequent phases use the same feature-branch → draft PR → owner-merges flow rather than the prompt's `redesign/*` names). Effort is engineering time on this codebase, not calendar time. "Touches" is the file set a reviewer should expect.

### Phase 1 — Design system: hygiene and motion primitives (REFINE, not rebuild)

The v3 system is implemented; Phase 1 cannot re-derive it (`CLAUDE.md:7-8`). It is two half-phases.

**1a · Gates and hygiene (no design change, start immediately after D28)**
- Under D28, re-open from `refs/pull/<n>/head` with fresh review rather than rewriting: #16 (LQIP wiring, keyed on the resolved URL — check that caveat before merging), #17 (`.env.example`), #18 and #26 (doc corrections and `mirror-images.yml` retirement), #19 (uploads hardening + test), #20/#27 (CSP enforcement), #22–#25 (the Phase 2e answers, if the owner's answers are unchanged). Each is one PR; none is cherry-picked as a block.
- Add a stale-translation mode to `scripts/i18n-missing.mjs` (diff `en.json` against `git HEAD`, or a stored English hash per key) and mount it in `ci.yml`. This is the prerequisite for every copy-bearing phase.
- Unify the audit scripts on one `BASE_URL` default (`:3000`); rewire or delete `verify-phase4..7.mjs`, `verify-chrome.mjs`, `screenshot-lab.mjs`; salvage the order-submit path from `verify-phase2/3.mjs` into `scripts/e2e-smoke.mjs`. **Done (F2, 2026-09-04):** the eight scripts are deleted; the order path (size, swatch, engraving, finish, contact, the spam gate, the wa.me popup and the /whatsapp-order fallback) lives in the smoke on `/product/demo-product-001`.
- D23: delete `syncSourceToSheet` and its call in `src/actions/scraper-jobs.ts`; add a vitest asserting MANUAL + DONE → zero sheet writes; correct `docs/google-sheets.md`.
- Wire `ScrapeSource.requestDelayMs` through `resolveDelayMs` into the adapter sleeps; correct `docs/scraper.md:79`; correct `docs/source-adapters.md:61`.
- Extract the descending-index planner from `sheets.ts:313` into a pure function with a test.
- D22: gate `seed-portfolio-cases.ts` on an empty `case-*` set (or owner-touched rows) once provenance is confirmed.
- D18/D24: delete the dormant files and workflows by exact path; move superseded docs under `docs/archive/`; fix `README.md` title and build-phase narrative; fix counts in `CLAUDE.md`, `AGENTS.md`, `docs/studio-cms/*`; ARCHIVED banner on `docs/audit-uiux.md`; fix `media-grid.tsx:94-100` comment.
- Add computed-style rules to `scripts/redesign-audit.mjs`: `backdrop-filter` outside `[data-slot=sf-site-header]`, `box-shadow` outside the two exceptions, hover transforms on buttons, non-token durations; make the champagne count a failing rule.
- Add a motion-bundle size check (gzipped bytes of the GSAP/Lenis chunks) with the 45 KB budget.
- Make the three build-time reads total: `privacy/page.tsx:55`, `terms/page.tsx:55` (fall back to the seeded legal stub) and `sitemap.ts:60-82` (fall back to the static routes), following `readCopyRows` in `site-copy-server.ts:57`; ask the owner to point the Vercel runtime `DATABASE_URL` at the pooled endpoint and keep the direct URL in `DATABASE_URL_UNPOOLED` (seen failing on this PR's preview with `P2037` for role `prisma_migration`).

**1b · Tokens and primitives**
- `--z-*` ladder (rail · header · scrim · drawer · overlay · toast · skip) and `--breakpoint-*` tokens in `tokens.css`, bridged in `globals.css`; migrate the 15 z values and two raw media queries.
- Retire the legacy motion aliases (`--ease-out`, `--dur-micro`, `--dur-enter`, raw `duration-200/450`) onto the Part 3.8 tokens (≈ 40 sites).
- Register GSAP `CustomEase` from the house curve in `src/lib/gsap.ts`; measure the chunk.
- `Reveal`: broaden to below-the-fold text blocks (never a `MeniscusImage`, never the hero); hero `sf-hero-rise` keyframe; poster `sf-hero-drift` on the wrapper (D20).
- Contract sweep: `dialog.tsx` (drop the scrim blur, retoken), `rating-stars.tsx` (mono numeral or single accent, label from caller), `consent-gate.tsx`, `wishlist-button.tsx`, `share-buttons.tsx`, `use-motion-paused.tsx`, `page-transition.tsx`; `hero-parallax.tsx` refit to a px cap.
- `ModelViewer`: i18n key, reduced-motion gate on auto-rotate, `ErrorState` with retry, poster.
- D19 if approved: v3 hexes in `brand-colors.ts`; re-skin the four `opengraph-image.tsx` routes, `manifest.ts`, `global-error.tsx`, `email.ts`.

Touches: `src/styles/tokens.css`, `src/app/globals.css`, `src/lib/gsap.ts`, `src/components/motion/*`, ~10 storefront files, `scripts/*.mjs`, `ci.yml`, docs. Effort: 1a M · 1b M. Gates: D18, D19, D20, D22, D23, D24 (each item can wait on its own decision; the rest proceeds).

### Phase 2 — Global chrome

- Header adaptive contrast: either a contrast rule in `redesign-audit.mjs` that samples the hero region under the bar on transparent routes, or an IntersectionObserver-driven ink that watches `[data-theme]` sections (M). Keep the seven-route allowlist either way.
- RTL residue: `slide-in-from-right rtl:slide-in-from-left` on the header drawer (`site-header.tsx:610`) and the shop filter drawer (`shop-explorer.tsx:561`, which has no `rtl:` variant at all); `origin-left rtl:origin-right` at `site-header.tsx:352` and `cure-line.tsx:237`; logical padding in `ui/select.tsx:111,116`; `ease-(--ease-settle)`; 40 ms stagger on the mega-menu category links (S).
- Hardcoded English in mounted chrome: `cure-line.tsx:160` and `rating-stars.tsx:27` `aria-label`s through next-intl (S).
- D12: language selector stays where REDESIGN §5.1 put it unless the owner says otherwise.
- Preserve the E2E DOM contracts (`sf-announcement-bar`, `sf-bottom-bar` × 5, `sf-wa-fab`, nav count 4) or update the smoke in the same PR.
- Page transitions already exist (`template.tsx` + `MorphLink`); retoken only. No cursor system (D10).

Touches: `site-header.tsx`, `footer.tsx`, `mobile-bottom-bar.tsx`, `scripts/redesign-audit.mjs`, `scripts/e2e-smoke.mjs`. Effort: M. Gates: D10, D12.

### Phase 3 — Homepage

Part 6 stays the structure; the manifest grows by at most two sections and the band rhythm is checked at save time and in the audit.
- New `large-format` `SectionDef` (§10): light band, three or four `MeniscusImage` tiles from `largeFormat.k1–k4` plus a mono index line and a link to `/large-resin-art`; copy prefix `Home.largeFormat.*` in nine locales via `i18n-merge.mjs`; `cureLabelKey` + `Home.cure.*`; registry regenerated. Position after "featured pieces" so no two dark bands touch.
- Collections band re-laid as a bento (shortlist 6) using `CollectionCard`'s `ratio` prop; the six slugs stay a code constant.
- Manifesto scroll-brightening (shortlist 10); `Reveal` on band text; bespoke band parallax capped at 30 px (shortlist 9); testimonial rail below `md` (shortlist 12); hero rise/drift from Phase 1.
- §15's brief attributes (dimensions, resin colour, wood, finish, shape, edge treatment, artwork direction, installation) do not exist as fields on `/custom-order`; adding them changes a form under HARD RULE 5, so they are proposed to the owner alongside D21 rather than built in this phase.
- Headline, lead and CTA labels are owner slots (`Home.hero.*`); the prompt's "Art, Cast Into Living Spaces." is entered by the owner in `/studio/site-copy` in nine locales, not hardcoded. The CTA swap (2b) is the owner's call.
- §9 furniture band and §14 room-context band only after D9/D26, framed as commission capability with concept-captioned imagery from SET A/C.

Touches: `src/app/[locale]/(v2)/page.tsx`, `src/lib/page-sections.ts`, `messages/*.json` ×9, `src/lib/site-copy.generated.ts`, `collection-card.tsx`. Effort: M (L with §9/§14). Gates: D9, D10, D20, D26, 2b.

### Phase 4 — Large-format experience

`/large-resin-art` is the flagship; it stays the only large-format route (no microsite lander).
- Add conditional `SectionDef`s: `philosophy` (light, copy only), `materials` (reuse the four-card block reading `Process.materials.*` and `process.material1-4`), `work` (PUBLISHED portfolio rows, the `custom-order` pattern), `words` (testimonials, after Phase 9 for product/project links), `faq` (db.faq + `Accordion`; Faq has no category, so the owner orders rows). Each renders nothing when empty. Band rhythm: the page has two dark bands; the ceiling is three.
- Imagery: SET A1 un-shares `largeFormat.hero` from `contact.hero`; A2 → `k1`; B7 → `k2`; B9 → `portfolio.hero`. Fetch runs on the owner's machine.
- Decision: widen `LARGE_FORMAT_CATEGORY_SLUGS` to include `art-craft-pieces` so wall art appears in the gallery (one line; changes what the page claims).
- Furniture sections 21.3–21.8 and 21.11 stay out until D9 and real content.

Touches: `large-resin-art/page.tsx`, `page-sections.ts`, `large-format.ts`, `messages/*.json` ×9, `docs/media-v3-manifest.json`. Effort: M. Gates: D9, Phase 9 for the words band.

### Phase 5 — Shop and collections

- Quick view as a storefront `Dialog` reusing `ShopProductItem` with a WhatsApp CTA; trigger is a ghost line outside the stretched `MorphLink` (REDESIGN §4.6); revive the four `Shop.quickView*` keys (M).
- D21: one dedicated commit projecting `materials`, `dimensions` (and `videoUrl` if approved) into `CARD_SELECT` / `toShopProductItem`; extend `localize()`; line-clamp one mono line; vitest that the accessible name never contains an ellipsis.
- Card: scale 1.03 where no second image (shortlist 8); optional "Ask on WhatsApp" ghost line with `data-wa-source`; hover video only for fine pointers, `preload="none"`, never the first row.
- Native scroll-snap rails for the collection strip and related rail (shortlist 5).
- D11 wishlist; 2e questions for `/search` and `/shop`.
- Search coverage beyond products (§68) is a behaviour change: propose, do not ship, until decided.

Touches: `shop-explorer.tsx`, `catalog-product-card.tsx`, new `quick-view.tsx`, `src/lib/shop.ts` (one commit), `messages/*.json`. Effort: M. Gates: D11, D21, 2e.

### Phase 6 — Product detail

- Lightbox FLIP (shortlist 4) in `gallery.tsx` and `lightbox-gallery.tsx`; extract a shared `Lightbox` when touching both.
- `ModelViewer` refinements land in Phase 1; here: `poster` on the gallery `<video>`.
- Testimonial mode F (product-linked) after Phase 9.
- Visual dimensions / scale visualizer / room context need numeric dimensions and `ProductImage.role` (D7); propose the migration, build nothing until decided.

Touches: `src/components/product/*`, `product/[slug]/page.tsx`. Effort: M. Gates: D7, Phase 9.

### Phase 7 — Secondary product experiences

Each category page is already an editorial mini-landing (Part 8). Work is a visual pass with the Phase 1 primitives, the snap rail, and the homepage print band's link; no new routes. Effort: S.

### Phase 8 — About · Process · Portfolio · Journal

- Process: D25 first; then four `Process.timeline` keys ×9, four `process.step` slots, SET D imagery; optional pinned stack (shortlist 18, L) inside the sanctioned second pin.
- Materials: accordion gallery (shortlist 7) on `/process` and `/about`.
- Journal: related collections needs `BlogPost↔Category` (D7); category set to ten is a content task in `/studio/blog` (footer slugs in `constants.ts:110-115` must survive).
- Portfolio: "installation context" needs no column — the owner fills `location`, `process` and `resultsMeta`, which the case page already renders; `BeforeAfter` renders the moment the owner fills `beforeImageUrl`.
- About: owner uploads the maker photograph (§15.2); copy is editable in nine locales already.

Touches: `process/page.tsx`, `about/page.tsx`, `blog/*`, `portfolio/*`, `page-sections.ts`, `messages/*.json`. Effort: M. Gates: D7, D16, D25.

### Phase 9 — Testimonial system

The one phase that is mostly engineering.
1. Migration (audit §12.3): `TestimonialStatus` enum; `status` (existing rows back-filled to PUBLISHED so the live site is unchanged), `featured`, `isDemo`, `designation`, `category`, `givenAt`, `language`, `productId`/`portfolioId` (`SetNull`), `imageUrl`, `videoUrl`, `notes`, consent/verification fields, timestamps, index. Shape copied from `20260822162000_product_owner_touched`.
2. `getTestimonials()` gains `status = PUBLISHED AND isDemo = false` plus `productId` / `featured` filters and a `try/catch` so it is total like the CMS resolvers; `media-usages.ts` walks every new URL column; `tests/db/media-usages.test.ts` extends; a `tests/db` case proves the gate. `revalidatePublic("testimonial")` widens from `/` alone (`helpers.ts:137-139`) to the PDP and `/custom-order` tags.
3. Studio: the modal becomes a page; status and featured columns, status filter, product/project pickers (reuse the provenance product search), notes, permission and verification fields, a Review lane; `actions/testimonials.ts` grows; the CSV/Sheets importer defaults new rows to DRAFT; bulk status. Publish refuses unless `permissionStatus = GRANTED`. PDP fallback policy (category rows, global rows, or hide) is decided before mode F ships.
4. `Testimonials` i18n namespace ×9; registry regenerated.
5. Components: `TestimonialCard` variants `editorial` (A), `linked` (B, beside `CatalogProductCard` imagery), `video` (C, `HeroMedia` idiom), a CSS-columns `TestimonialWall` (D), `FeaturedTestimonial` (E), PDP band filtered by `productId` (F). No carousel. `RatingStars` refined in Phase 1.
6. Review/AggregateRating JSON-LD only from PUBLISHED, non-demo rows with the consent field set.
7. Fixtures (30–50 "Demo Customer NNN") under D8, loaded only by `seed:demo`.

Touches: `prisma/schema.prisma`, one migration, `src/lib/testimonials.ts`, `src/actions/testimonials.ts`, `src/components/studio/testimonials/*`, `src/components/storefront/testimonial-*.tsx`, `src/lib/media-usages.ts`, `tests/db/*`, `messages/*.json`, `src/lib/import/templates.ts`. Effort: L. Gates: D7, D8, D14.

### Phase 10 — Studio shell

- ~~Tablet sidebar (collapsible rail between 640 and 1024 px); command-palette verbs; `⌘K` hint and flat loading row (shortlist 17)~~ **DONE 2026-09-03** — 80 px rail from 640, full panel from 1024; a `Do` group of seven verbs that navigate rather than execute (running a scrape from a fuzzy keystroke is a side effect); the palette no longer claims "Nothing matches" while its debounced search is still in flight. The `⌘K` hint was already in the topbar.
- ~~Studio `error.tsx` with a reference code; `not-found.tsx` in v3 vocabulary; the shared `loading.tsx` flat, no shimmer~~ **DONE 2026-09-03** — all three retokened and driven against a production build (the audit sweeps 30 routes and none of them is an error). **Per-route skeletons DONE 2026-09-03** — twelve of them, composed from a new `studio/skeleton.tsx` (header footprint, filter bar, table at real row height, media grid), flat and at final dimensions. **Auth-tree boundary DONE 2026-09-03** — `src/app/studio/error.tsx` now covers login/signup/forgot-password/reset-password, which sit outside `(dashboard)` and so were still falling through to the public dark error page.
- ~~Sonner styled by tokens; badge semantic tones; a `Tabs` primitive; sticky header row and pinned first column on wide tables (shortlist 16)~~ **DONE 2026-09-03**. Sticky headers were already there and are verified working (products `<thead>` pins at 64 px at 1440); only 2 of 21 tables carry a `min-w`, and the other 19 sit in `overflow-x-auto` wrappers where sticky would be a silent no-op. Pinned first columns now cover products and commissions below `xl`, after making `StudioRow`'s tints opaque — translucent ones let the scrolled-under columns show through a pinned cell. **Row-enter for appended activity rows (shortlist 15) is NOT APPLICABLE as written, and is closed rather than built.** `ActivityPanel` is a pure server component — no state, no effect, no polling, no stream — and the only client component anywhere near `/studio/activity` is its filter. No row is ever *appended*; the panel re-renders whole on navigation or revalidation. An entrance animation would therefore have no trigger to attach to and would instead replay over the entire list on every visit to the dashboard, which is precisely the decorative motion Part 14 rejects. It becomes real only if the panel ever gains live updates.
- ~~Dashboard tiles for testimonials, portfolio, media, scraper records, import jobs~~ **DONE 2026-09-03** — five tiles in a CONTENT & PIPELINE strip, each deep-linking to its screen. "Demo products" still reads the D8 marker and is **not** built; `—` when unknown applies to it.
- ~~Drift sweep: `shadow-sm` → `shadow-e1`, `rounded-xl/2xl` → `rounded-card`, `form-section.tsx`~~ **DONE 2026-09-03** — 108 substitutions across 42 files. Measured rather than grepped: off-token radii went 51 (16px) + 24 (8px) → 0 across 30 routes, non-`e1` shadows 69 → 4 (all `shadow-e2` on the sanctioned sticky action bar). Floating surfaces (`dropdown-menu`, `select`, `dialog`) went to `rounded-modal`, the same 8px they already rendered, which also leaves the storefront's `order-panel` select untouched.
- **Dark scheme: every dropdown was invisible — FIXED 2026-09-05 (seventh batch).** The semantic popover pair was the one still routed through palette names (`--mineral`/`--ink`), and in the Studio's dark block both resolve to `#f4f1e9`: cream on cream at 1.00:1, on every Select, menu and the palette. Re-pointed to `--surface`/`--text` like card; `accent-foreground` and the Check/Circle indicators to `--sapphire-ink` (1.49 → 5.48 in dark, identical on light). Swept 46 routes × 2 schemes on the branch rebased onto #49: 167 surfaces each (95 menus, 41 Selects, 30 native selects, the palette) plus 47 behind dialogs, fixtures and the block editor — nothing below 4.5:1. Three `text-primary` links on `/studio/inquiries/[id]` share the defect and are recorded in the CHANGELOG, not fixed.
- D17 design lab.

Touches: `src/app/studio/(dashboard)/layout.tsx`, `loading.tsx`, `error.tsx`, `sidebar.tsx`, `topbar.tsx`, `command-palette.tsx`, `studio-table-head.tsx`, `studio-row.tsx`, `ui/badge.tsx`, `globals.css` (`.studio-v2`), `design-lab/*`. Effort: M. Gates: D17 (the rest is open).

### Phase 11 — Studio content management

- ~~Unified per-page editor `/studio/pages/<key>` composing words, pictures and order from the registries (UI composition, no data change)~~ **DONE 2026-09-03 — on `/studio/site-copy`, not the named route**: `/studio/pages` is already the `Page` model editor keyed by cuid, so a `<key>` route beside `[id]` collides. Words · Pictures · Order tabs under one surface picker; the surface↔page join is derived from public paths rather than a hand map; five manifest-less surfaces get no Order tab. Standalone Site Images and Page Sections remain and share the lifted builders; ~~revision list per surface with restore-to-draft~~ **DONE 2026-09-03** — `restoreRevision` had shipped with publishing and was unreachable (nothing listed revisions, so no owner could hold a revision id); `listSurfaceRevisions` + a `RevisionHistory` dialog in the page header close it. Not in `PublishBar`, which hides itself when nothing is staged — exactly when history is wanted.
- Product form: ~~tabs (General · Images · Customization · Details · SEO)~~ **DONE 2026-09-03** — every panel `forceMount`ed so no field, upload or editor instance unmounts on a tab change, and each tab declares its fields so a refused submit lands on the tab holding the error rather than nowhere. ~~two columns with the draft preview~~ **DONE 2026-09-06** — `EditorSplit` docks `DraftPreviewPanel` (the phone frame, 1:1, keyed on the save count so each save reloads it; Tablet and Desktop open the dialog) beside the product and journal forms when the CONTENT AREA is 64rem or wider — a container query, so it follows the sidebar's collapse rather than picking a viewport width that is wrong for one of its two states; narrower, the footer button and the dialog carry on; the frame is `loading="lazy"` so the hidden aside never fetches the page. §12.5's unsaved-changes indicator sits in both footers. ~~`FieldError` everywhere, helper text~~ **DONE 2026-09-05** — a `FieldHint` primitive and `describedBy()`; the five `useState` forms (site copy, navigation, research, add-sources, review editor) judge each field in the browser with the rule the action holds (`describeCopyProblem` and a new shared `describeLabelProblem` where a validator exists; the schema's limits mirrored where not), `aria-invalid` + `aria-describedby` on every control, focus on the first refused field. Blog and portfolio editors likewise; ~~in-app navigation interception in `useUnsavedChangesGuard`~~ **DONE 2026-09-03** (it was `beforeunload` only, so seven forms discarded edits on any sidebar click — measured: clean form navigates, dirty form is held, both answers behave); ~~guard on dialog CRUD~~ **DONE 2026-09-03** (they guarded only `while busy` — the save round trip — so a stray Escape before it discarded the typing; `useDismissGuard` covers the dirty case and blocks rather than stacking a dialog on a dialog); ~~`window.prompt` → `Dialog` + `Input`~~ **DONE 2026-09-03** (all three sites; no native prompt fires); ~~`MediaPicker` wired into the editor image button~~ **DONE 2026-09-03** — the picker sits beside the URL button (different jobs: the library, or an image that lives elsewhere); `MediaPicker` gained an optional `trigger` and its five existing consumers are unchanged. Picker gains video: still open.
- Autosave only as local-draft persistence unless a per-row draft column is decided.
- D15 blocks, one per commit: Collection Grid, Portfolio Grid, Journal Grid, Testimonial (after Phase 9); then Video Hero / Video Story / galleries after the picker supports video and `media-usages.ts` walks them; `custom-blocks.test.ts:25` updated deliberately each time.
- ~~Device-frame preview (`<iframe>` on `/api/draft?redirect`)~~ **DONE 2026-09-03** — `DraftPreview` at 390/768/1280 on the product and journal forms, unscaled on purpose (a shrunk preview hides the crowding it exists to reveal). Framing stays narrow: the storefront is `SAMEORIGIN`, `/studio/*` remains `DENY`.
- D7 items: Category `seoTitle/seoDescription/visible`; D16 Process/Materials if promoted (registry pattern, D2); D14 statuses; `BlogPost.publishedAt` as a visibility gate (decision).

Touches: `src/components/studio/{pages,products,blog,portfolio,custom-pages,publish}/*`, `src/lib/custom-blocks.ts`, `custom-page-blocks.tsx`, `src/hooks/use-unsaved-changes-guard.ts`, `rich-text-editor.tsx`, `media-picker.tsx`, `prisma/` (per decision). Effort: L. Gates: D7, D14, D15, D16.

### Phase 12 — Media system

- ~~Library: cursor pagination past 200, sort, date/size/orientation filters, detail drawer (metadata, usages with deep links, replace file), drag-and-drop upload, move between folders, bulk alt edit, grid/list toggle~~ **DONE 2026-09-04 by the content series** (Wave 2/3 batches — `media-grid.tsx`, `media-detail-drawer.tsx`, `upload-zone.tsx`, `move-to-folder-dialog.tsx`, `bulk-alt-dialog.tsx`; verified against HEAD 2026-09-05). Video poster at ingest stays a decision (ffmpeg is not a dependency) or a client-captured frame.
- ~~D7 columns: `tags String[]`, `caption`, `favourite`, `duration`~~ **DONE 2026-09-04** (`20260904105000`); none stores a URL.
- ~~Wire `media-v3-blur.json` and `Media.blurDataUrl` into `SlotImage` and `MeniscusImage`~~ **DONE** — `slot-image.tsx` forwards `blurDataUrl`, `MeniscusImage` accepts it, `HeroMedia` reads it off the `SiteImageRef`.
- ~~`Media` rows for cron-mirrored catalog images~~ **DONE** — `catalog-mirror.ts` upserts a `Media` row per mirrored file.
- ~~Give `HeroMedia` and the `getSiteImage()` call sites a `SiteImageRef` path~~ **DONE** — `hero-media.tsx` takes `poster: SiteImageRef` so `home.hero`, `process.heroPoster`, the three `shop.group.*` banners and `studio.login` can carry `mobileUrl` and a focal point (today only six slots render them through `SlotImage`); wire `MeniscusImage`'s unused `focal` prop where product and portfolio imagery gains one.
- Execute the generation plan (audit §10.3) in value order on the owner's machine: SET D, A1/A2/B7, E22 (needs a `mobileFallback` registry field and the `HeroMedia` change above), F34, B8/B9; C and F35–38 only after D9/D26. Append REDESIGN's "no faces" clause to the manifest's `promptSuffix` first. Manifest entries recorded from the session; fetch outside.
- D24 cleanup of legacy media and scripts.

Touches: `src/app/studio/(dashboard)/media/*`, `src/components/studio/media/*`, `src/actions/media.ts`, `src/lib/media-ingest.ts`, `slot-image.tsx`, `meniscus-image.tsx`, `site-images.ts`, `docs/media-v3-manifest.json`, `public/media/v3/`. Effort: L. Gates: D7, D9, D26, D24.

### Phase 13 — Scraper and research

- Stage rail on `/studio/scraper` showing the nine stages over existing data; the runner loop moved into a shared hook at a stable layout level; stale-RUNNING window; breaker independent of `sourceId`.
- Discovery: scope selection (whole source · category · single URL) and a `ScrapeCategory` model if the owner wants category discovery (decision).
- Normalisation: material/colour/unit alias tables; URL canonicaliser.
- Research library: `ScrapedProduct.notes` (D7); a non-product research record is a new table (decision).
- Bulk Import wizard product path consults `decideMerge` or warns "will overwrite N owner-edited products".
- `category-map.ts` test asserting every keyword slug exists in `CANONICAL_CATEGORIES`.
- `/studio/scraper/mapping` either becomes editable or is renamed to what it is.
- D13 stays as documented; the exception is written into `docs/scraper.md`.

Touches: `src/actions/scraper-*.ts`, `src/components/studio/scraper/*`, `src/lib/scraper/*`, `prisma/` (per decision), docs. Effort: L. Gates: D7, D13.

### Phase 14 — Google Sheets

- Tier fill: Preview and Run-now controls on `/studio/sheet-import` using `decideFillRun('PREVIEW' | 'MANUAL')`; per-row reasons for dropped rows; optional live read through the service account instead of the committed snapshot (decision).
- Conflict detection: compare the incoming row against `studioEditedAt` / `sourceHash`; record conflicts (new `SheetConflict` table or `ImportRun.meta`), surface them for resolution (keep mine / take sheet / skip).
- `SheetSyncRun` history for the push direction; spreadsheet and tab ids in `SiteSettings` (one place; `fetch-tiers.yml` reads variables).
- Keep key-based row addressing; do not store row indexes.

Touches: `src/app/studio/(dashboard)/sheet-import/*`, `src/actions/import.ts`, `src/actions/scraper-sheets.ts`, `src/lib/scraper/sheets.ts`, `prisma/import-tiers.ts`, `prisma/` (per decision). Effort: L. Gates: D7, D13.

### Phase 15 — Content Lab (non-production)

Only under D8.
- Additive `isDemo Boolean @default(false)` on Product, BlogPost, Portfolio, Testimonial (already in Phase 9), Faq, CustomPage, Media; every public read adds `isDemo: false`; the DEMO title-prefix convention and its two tests retire in the same change if no such rows exist in production.
- `prisma/fixtures/demo/*.json` with edge cases by construction; `npm run seed:demo` (idempotent on `importSource='demo'` + `importRef`, `slug`, id prefix) and `seed:demo -- --remove`; the loader refuses `NODE_ENV=production`, `VERCEL_ENV=production` and any non-allow-listed database host; never referenced by `bootstrap.ts`; a `tests/db` case for idempotency and removal.
- Studio: demo badge and filter on every list, a Content Lab page with loader state and counts, the dashboard tile.
- Environment: a Neon branch behind a Vercel preview is the lab; CI's `rivya_ci` can seed it for the E2E suite.
- Furniture-topic products and articles are labelled concept content (D5).

Touches: `prisma/schema.prisma`, one migration, `prisma/fixtures/demo/`, `scripts/seed-demo.ts`, `package.json`, ~55 read sites, `src/components/studio/*` lists, `tests/db/`. Effort: XL. Gates: D8.

### Phase 16 — SEO, accessibility, performance

- Localised JSON-LD breadcrumb names; Twitter block per detail page; localised `og:url`; Review schema after Phase 9.
- CI widths 360 / 768 / 1024 / 1280 for the design and a11y sweeps; a touch-target rule in both audit scripts; keyboard-path checks for drawer, search, mega menu and lightbox.
- Bundle check for the motion budget; refreshed Lighthouse baseline against live slugs on a preview.
- CSP: its own PR, owner decision (nonce for `script-src`, drain `img-src https:` behind the image mirror).

Effort: M. Gates: CSP only.

### Phase 17 — Final QA

- Full local gate run against a real Postgres: typecheck · lint · copy:check · i18n-missing (+ stale mode) · test · test:db · build · redesign-audit ×4 · a11y-audit ×3 · studio-audit ×2 · lighthouse · E2E; results pasted in the PR body.
- Run `scripts/e2e-smoke.mjs` in CI's build job: the CI database already holds the tier catalogue and the portfolio cases because `bootstrap.ts` imports the tracked `data/tiers/*.csv.gz` there (the "no catalogue" comments in `ci.yml:88-91` and `CLAUDE.md:217` are stale), so the smoke and the detail routes (`/product`, `/blog`, `/portfolio`, `/p`) can join `AUDIT_ROUTES` with deterministic slugs. Then expand E2E toward §78's 16 asks (search, filters, customisation submit, Studio product/content/testimonial CRUD, media upload, scraper run, sheet import preview, page builder, draft/publish, language switching); never remove an existing check.
- Screenshot sweep at 1440 / 1280 / 1024 / 390 / 360 on every major route, LTR and RTL; owner sign-off.
- Documentation refresh: `PROJECT_STATE.md` checkpoint, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `ADMIN_GUIDE.md`, `docs/studio-cms/08-owner-handbook.md`.

Effort: L.

---

## 4. Dependency order

```
0 audit ─┬─ 1a hygiene + gates ──┬─ 1b tokens/primitives ── 2 chrome ── 3 homepage ── 4 large-format ── 5 shop ── 6 PDP ── 7 secondary ── 8 editorial
         │                       │
         │                       └─ 10 studio shell ── 11 studio content ── 12 media ── 13 scraper ── 14 sheets
         │
         └─ 9 testimonials (after D7/D8/D14) ─── feeds 3, 4, 6, 11, 15
                                                        │
                                          15 content lab (after D8, after 9) ── 16 SEO/a11y/perf ── 17 final QA
```

Hard orderings: 1a's stale-translation gate before any of 3, 4, 8; Phase 9's schema before any testimonial mode B/C/E/F, the PDP band and the large-format words band; the media picker's video support (11/12) before video blocks; `site-images.ts` and `page-sections.ts` entries before any room-context imagery; D21 before card metadata.

---

## 5. Definition of done, per phase

The repository's definition (`AGENTS.md` "Definition of done") applies to every phase, unchanged:

typecheck ✓ · lint ✓ · tests ✓ · build ✓ (against a real Postgres) · `copy:check` ✓ · 0 missing translations (and, from 1a, 0 stale) · works at 360 px and 1280 px · keyboard reachable · reduced-motion checked · `redesign-audit` and `a11y-audit` clean at 1440 and 390 (and RTL for layout changes) · `studio-audit` clean for Studio phases · HARD RULES respected · the order flow still opens `wa.me/917096036250` with the correct pre-filled message · **if you say it works, you have run it** · CI green on the PR head, plus local results pasted in the PR body for what CI does not sweep yet (detail routes, E2E, widths beyond 1440/390 — until Phases 16–17 add them).

Phase-specific additions: every new section declares `dark`, `cureLabelKey`, copy prefix and joins `KNOWN_ROUTES` if it is a route; every new media-URL column joins `media-usages.ts` and its DB test in the same commit; every copy change is a nine-file edit plus `copy:registry`; every new pattern from §14 has a reduced-motion branch and is measured against the motion budget; every schema change is additive and reuses a migration precedent; `PROJECT_STATE.md`'s checkpoint block and `CHANGELOG.md` are updated in the same PR.

---

## 6. Migration plan (additive only)

In dependency order; each is its own migration file and its own justification. None drops, renames or alters a column. Each copies the shape of an existing precedent.

| # | Migration | Phase | Precedent | Notes |
|---|---|---|---|---|
| M1 | `TestimonialStatus` enum + Testimonial columns | 9 | `product_owner_touched` (defaulted column), `inquiry_pipeline_statuses` (enum) | Back-fill existing rows to PUBLISHED in the same migration |
| M2 | `isDemo` on Product, BlogPost, Portfolio, Faq, CustomPage, Media | 15 | `product_owner_touched` | Metadata-only default on the 4,385-row table; brief ACCESS EXCLUSIVE lock — deploy off-peak |
| M3 | `ContentStatus` + REVIEW, ARCHIVED | 11 | `inquiry_pipeline_statuses` | Audit `order-visibility.ts`, products list tabs and dashboard counts for two-state assumptions first |
| M4 | `Category.seoTitle/seoDescription/visible` | 11 | additive nullable columns | `visible` default true |
| M5 | `Media.tags String[]`, `caption`, `favourite`, `duration` | 12 | additive | No URL stored; no `media-usages` change |
| M6 | `ScrapedProduct.notes` | 13 | additive | |
| M7 | `SheetConflict` / `SheetSyncRun` tables; `SiteSettings.sheetId/sheetTabIds` | 14 | new tables, no URLs | |
| M8 | `Portfolio.productId`, `BlogPost` ↔ `Category` join | 8, 11 | `SetNull` relations | Only if D7 approves each |
| M9 | `ProductImage.role`, numeric `Product.widthMm/depthMm/heightMm` | 6 | additive nullable | Only if D7 approves; free-text `dimensions` stays canonical |
| M10 | `Material`, `ProcessStep`, `Collection` tables | 8, 11 | registry-pattern surfaces (D2) | Only under D16; a `Collection` table starts empty (D5) |

Every migration is exercised locally by `prisma migrate deploy` + `npm run test:db` against a throwaway Postgres before push, and the result is recorded in the PR body.

---

## 7. Demo-data isolation (summary)

Design 3 from the audit §13: non-production fixtures loaded by a guarded `seed:demo`, plus an additive `isDemo` marker used for badging, removal and defence in depth. Two gates between any demo row and a visitor (`status = PUBLISHED` and `isDemo = false`) and a loader that refuses production hosts. The Content Lab is a database (local, CI, Neon branch), not a Studio route; the Studio surface is badges, filters and a status page. Nothing is wired into `prisma/bootstrap.ts`. Fabricated testimonials never enter the production Neon database, DRAFT or otherwise.

---

## 8. Checkpoint protocol (§81)

`PROJECT_STATE.md` now opens with a fenced `SESSION CHECKPOINT` block carrying the fifteen §81 keys. Every phase PR updates it: Current Phase, Phase Status, Completed, In Progress, Next Exact Task, Files Created, Files Modified, Database Changes, Content Changes, Demo Data, Assets Added, Tests Run, Tests Passing, Known Issues, Next Session Instruction. The narrative below the block stays as history. "Tests Run" lists commands actually executed; "Tests Passing" reports what they printed; a gate that could not run says so.

---

## 9. Estimated files affected

| Phase | New | Modified | Notes |
|---|---|---|---|
| 1a | ~3 (tests, one script mode) | ~25 (scripts, docs, one action, workflows deleted) | plus ~20 deletions under D18/D24 |
| 1b | ~2 | ~45 (tokens, globals, motion, storefront sweep, OG cards) | |
| 2 | 0 | ~6 | |
| 3 | 1 section | ~14 (page, manifest, 9 locales, registry, cards) | |
| 4 | 0 | ~14 | |
| 5 | 1 (quick view) | ~10 | |
| 6 | 1 (lightbox) | ~5 | |
| 7 | 0 | ~6 | |
| 8 | 1 (accordion gallery) | ~16 | |
| 9 | ~6 (migration, variants, fixtures) | ~15 | |
| 10 | ~5 (skeletons, tabs) | ~30 | |
| 11 | ~4 (blocks, editor, revisions) | ~35 | |
| 12 | ~3 | ~20 + assets | |
| 13 | ~3 | ~15 | |
| 14 | ~3 | ~10 | |
| 15 | ~10 (fixtures, loader, tests) | ~60 (read sites, lists) | |
| 16 | ~2 | ~15 | |
| 17 | ~5 (E2E checks) | ~10 (docs) | |

Roughly 45 new files and 350 modifications across the transformation, against ~92 k lines of source. The catalogue, the order flow, the auth, the routes and the CMS pattern are not among them.
