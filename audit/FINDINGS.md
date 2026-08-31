# Part 0 — Full website audit: findings log

Audit of 2026-08-20 against the production build at branch head (post-chrome
restoration), per the "Awwwards-Grade Animation & Modern Design Implementation
Guide" v1.1 Part 0. Ten areas; automated toolkit outputs live beside this file
(`crawl-report.json`, `lh-summary.json`); the seven code-inspection areas ran
as parallel review agents whose claims were re-verified against the live
server/code before any fix landed.

**Sandbox caveats** (all measurements local): the environment proxy blocks
every external image host and the Vercel analytics/speed-insights scripts, so
console-error and failed-request counts on the live crawl are classified, not
zero; Lighthouse **performance** numbers are lower bounds (throttled CPU +
blocked images) — re-measure on the Vercel preview for real values.
Accessibility/SEO/Best-Practices scores are valid as measured.

## Fixed (P0/P1)

| ID | Area | Finding | Fix (commit in PR #86) |
|----|------|---------|------------------------|
| A1-001 | Perf/CWV | Blog pagination overflowed 360–400px viewports (7×44px targets + arrows = 428px) | `flex-wrap justify-center` on the pagination nav |
| A1-002 | Perf/CWV | Blog-post outline skipped h1→h3: authored-h2 documents blanket-demoted | `renderTiptapToHtml` now normalizes (top level → h2, relative structure kept) |
| A3-001 | SEO | **og:image/twitter:image missing on nearly every page** — the `[locale]` layout's `openGraph` config replaced the root file-based card wholesale (verified live: `/`, `/shop`, `/about` shipped none) | Explicit `images: ["/opengraph-image"]` in the shared defaults + explicit Satori-card fallback on media-less product/blog pages |
| A4-001 | Deps | 2 CRITICAL advisories in `@auth/core` ≤0.41.2 (the /studio auth library) | `next-auth` → `5.0.0-beta.32` (`@auth/core` 0.41.3); criticals now 0 |
| A4-002 | Deps | 9 HIGH advisories in `next` 16.2.10 incl. an App Router middleware bypass (the /studio guard is middleware) | `next` → 16.3.1; full build + crawl re-verified |
| A5-001 | Security | `findMediaUsages` exported from a `"use server"` module with no auth and no input cap — anonymous callers could probe media references | Moved to `src/lib/media-usages.ts` (no longer an endpoint); only guarded actions import it |
| A8-001 | Cross-device | Mobile /shop filter drawer rendered from `left:50%`, clipping ~⅓ incl. its close button (logical `start-0` and the dialog base's physical `left-[50%]` live in different tailwind-merge groups) | `left-auto` evicts the base value; drawer verified at `left:0` |
| A10-001 | Motion/WCAG | Home marquee: infinite >5s auto-motion with no user-reachable pause (WCAG 2.2.2 Level A) | Marquee registers the shared MotionPauseToggle chip + honors the shared paused state (verified: click → paused) |

## Fixed (P2)

- **A2-001** Mobile-menu dialog left `main`/`footer`/announcement in the a11y tree — now inert for the dialog's lifetime.
- **A2-003** Contact-form success replaced the form silently and dropped focus — now `role="status"` + focus moves to the card.
- **A2-004/A8-002/A8-003/A8-004** Consent banner: `role="dialog"`→`region` (it never implemented the dialog contract), safe-area-inset margin, 44px buttons, `z-[55]` so it stacks under the modal mobile menu.
- **A2-005** Announcement pause control + labels localized (`Common.pause/resumeAnnouncements` ×9 locales).
- **A2-006** Lightbox arrow keys now direction-aware under RTL; pagination + breadcrumb chevrons mirror (`rtl:-scale-x-100`); locale-switcher/skip-link physical `left/pl/pr` → logical `start/ps/pe`.
- **A2-007** Search zero/empty and portfolio commission WhatsApp CTAs now carry the sr-only "(opens in new tab)" hint like every other external CTA.
- **A3-002** og:url no longer hardcoded to the homepage sitewide (removed from shared defaults; scrapers use the fetched URL).
- **A3-003** og:locale per locale (was `en_IN` on all 9).
- **A3-004** robots.txt no longer crawl-blocks /studio — the X-Robots-Tag noindex header (which a crawl block would make invisible) is now the single, effective de-indexing signal.
- **A3-005** `favicon.ico` added (16/32/48 multi-size, generated from the existing 512px mark) — Safari tabs + legacy /favicon.ico fetches no longer 404.
- **A3-006** Sitemap static routes no longer stamp `lastModified: new Date()` each revalidation (perpetual false freshness devalues the accurate product/blog dates).
- **A4-004** Unused production dep removed: `embla-carousel-react`. (`happy-dom` was ALSO flagged unused — **wrong**: `@tiptap/html`'s server build requires it; restored after the build proved it. Recorded so nobody repeats the removal.)
- **A5-002** `resetPassword` (pre-auth) now rate-limited like the request step (10/10min/IP durable).
- **A5-004** `serverActions.bodySizeLimit` 12mb → 17mb: the media action's own ceiling is 16MB, so valid 12–16MB uploads died at the transport layer.
- **A5-005** CSP-report sink: 32KB body cap (via text(), not unbounded json()) + coarse 60/min throttle.
- **A6-002** About/Process WhatsApp greetings localized (bare `defaultWaGreeting()` sent English to all locales).
- **A6-003** `data-wa-source` added to home hero/closing, search zero/empty, portfolio commission CTAs (tracker's pathname fallback covered them only coarsely).
- **A6-004** Spam-rejected newsletter submissions now return `silent:true` and clients skip `trackLead` — bots no longer inflate the lead metric.
- **A6-008** Orphaned non-functional `storefront/newsletter-form.tsx` deleted; design-lab points at the real `sections/newsletter-form`.
- **A10-002** `text-header-ink` transition referenced `--ease-luxe`, which never existed at runtime (theme-inline only) — now `--dur-micro`/`--ease-out`.
- **A10-003** Dead v7 motion layer removed: `--ease-luxe`, mesh-drift/shine/gradient-pan/float-slow utilities + keyframes (zero consumers).

## Open — scheduled (P2, owner-visible)

| ID | Finding | Why not in this pass |
|----|---------|----------------------|
| ~~S-01~~ | **CLOSED** — translation pass shipped: public actions return locale-free error CODES mapped to `Errors.*` client-side; ShareButtons chrome localized; search zero-results + portfolio commission wa.me prefills and the order-panel attach-count line (frozen WA payload) localized ×9 with ICU plurals (Arabic full category set). The "required marker" claim verified clean — only aria-required attributes exist. Live-verified on /hi and /ar. | — |
| ~~S-02~~ | **Closed in Phase 1**: chrome durations tokenized to A5 (`--dur-micro`/`--dur-enter`); only the JS-coupled 180ms mega exit tail keeps an arbitrary value (in-band, documented). ui/button shine remains with S-04's design-lab cleanup | — |
| ~~S-03~~ | **Closed in Phase 1**: Preloader arms a gate (`src/lib/preloader-signal.ts`) that entrance motion awaits — the hero SplitText now plays through the overlay's exit fade instead of underneath it | — |
| ~~S-04~~ | **CLOSED** — the v7 parallel header (navbar.tsx 237 lines + mega-menu 158 + whatsapp-pill 39) deleted; design-lab drops those mounts and the MOCK_NAV fixture (the live chrome is SiteHeader, exercised on the real site). Full build clean. | — |
| ~~S-05~~ | **CLOSED** — no migration was needed (Inquiry.attribution Json? already existed): the allow-listed attribution schema + Json helper moved to the shared src/lib/attribution-schema.ts, submitContactInquiry persists it, and the contact form sends getAttribution(). Verified end-to-end: a UTM landing → /contact submit persisted {utm_source, utm_campaign, landing} on the CONTACT Inquiry row. | — |
| ~~S-06~~ | **CLOSED** — /api/form-token issues an HMAC-signed timestamp (keyed by AUTH_SECRET, no-store, rate-limited); all five public forms fetch it at mount via useFormToken and the actions verify signature + ≥2.5s age + ≤6h staleness server-side (timing-safe compare). The client clock is gone from the gate. Proven live: a <2.5s submit stored nothing, an aged submit stored; token signature verified against the server key. | — |
| ~~S-07~~ | **CLOSED** — official codemod ran: src/proxy.ts (NextProxy type, renamed export), logic and matcher byte-identical. Verified live: /studio guard 307→login with callback, locale routing intact, deprecation notice gone. | — |
| ~~S-08~~ | **CLOSED (override)** — an npm override pins the chain's root, deepmerge-ts, to the patched 8.0.1 (advisory: <8.0.0 stack exhaustion). Proven compatible: prisma generate, migrate deploy, and the full build all pass with the override active. Production audit: **0 critical, 0 high** for the first time (2 moderates remain in the CLI chain). Drop the override once prisma ships its own bump past deepmerge-ts 8. | — |
| ~~S-09~~ | **CLOSED** — Bulk Import moved off SheetJS onto exceljs with fixture-proven byte-identical parsing output; xlsx removed entirely (its HIGHs gone from the audit). The transitive brace-expansion HIGH exceljs surfaced was cleared via npm audit fix. | — |
| ~~S-10~~ | **CLOSED (remount)** — evidence: the button + action survived intact, env-gated and documented as optional; the mount was lost accidentally in the Phase 4 studio rebuild. Remounted in the scraper job dashboard beside CSV export, fed by the existing sheetSynced column. | — |

## Escalated — owner decisions (P3, no code change made)

| ID | Finding |
|----|---------|
| E-01 | 103 published products have empty descriptions; 19 have no images (cards degrade to the monogram fallback by design). Content can only come from the owner — hard rule: nothing may be AI-invented. |
| E-02 | Catalog images hotlink six external hosts (cdn.shopify.com ×7704, banteybanatey.com ×1028, kanhakreation.com ×405, i0.wp.com ×350, 3dzone.in ×322, resinartsjaipur.com ×89). Fragile + un-optimizable; migrating to owned storage is a data project. |
| E-03 | Testimonial table is empty — the home testimonial band (and its PDP strip) never renders. Needs owner-curated entries. |
| E-04 | Header WhatsApp button is xl-only by documented design (768–1279px keeps the CTA in the hamburger menu; at ≤1090px the row genuinely lacks space). Decision recorded: keep, revisit only with a chrome redesign. |
| E-05 | Faq/Testimonial/Page models have no translations column (English-only rows) — tracked since Phase 7. |

## Verification (after-pass, this environment)

- Crawl (19 routes, mobile, axe WCAG A/AA): **0 violations, 0 real console
  errors, 0 horizontal overflow, exactly one h1 per route**, 404 correct,
  WhatsApp CTAs present on every storefront route.
- og:image now renders on every page class (verified: home/shop/about =
  branded card; media-less PDP = card fallback; photo post = its cover);
  og:locale per locale; og:url absent except detail pages; /favicon.ico 200.
- Shop filter drawer opens at `left:0` (was mid-screen); blog paginates
  without overflow at 393px; marquee pause chip toggles
  `animation-play-state` (WCAG 2.2.2).
- `npm audit --omit=dev`: **0 critical** (was 2), remaining highs documented
  above (S-08/S-09).
- typecheck ✓ lint ✓ production build ✓ · Lighthouse after-pass in
  `lh-summary.json` (see BASELINE.md).

## Phase 1 decisions (recorded per the guide's Part E/I)

- **Motion for React (`motion/react`): NOT adopted.** GSAP + ScrollTrigger +
  SplitText + CSS keyframes already implement every shipped and planned
  pattern; adding a second animation runtime contradicts the guide's own
  "avoid mixing overlapping scroll/animation libraries" rule and DESIGN.md's
  single-motion-system law. Revisit only if a Phase 2+ pattern genuinely
  needs AnimatePresence-style exit orchestration.
- **View Transitions (`experimental.viewTransition`): deferred to Phase 2**
  as the guide schedules it (card → PDP morph), pending owner sign-off on an
  experimental flag in production.
- **Guide Phase 1 checklist vs repo**: motion tokens (A5) ✓ already law ·
  Lenis ✓ shipped · reduced-motion net ✓ shipped · card hover crossfade ✓
  shipped (`hoverImage`, hover-capable devices only) · scroll-aware header ✓
  shipped (morph-to-chip — the owner-chosen restored chrome; the guide's
  hide-on-scroll variant is intentionally not used) · grid stagger → shipped
  in Phase 1 as load-more batch entrances only (Part H forbids animating the
  LCP rows in from opacity 0).

## Phase 2 record

- **View Transitions shipped, with a documented path deviation**: the guide's
  `experimental.viewTransition` flag does not exist in Next 16.3 and React
  19.2 stable ships no `<ViewTransition>`. The supported route is
  `next-view-transitions` (Vercel-authored, ~2KB, MIT): `<ViewTransitions>`
  wraps the locale layout and `MorphLink` drives shop-card clicks through
  `document.startViewTransition`. Paired `view-transition-name`
  (`product-<slug>`) on the card stage and the PDP gallery stage produces the
  card → PDP morph; timing rides A5 tokens; reduced-motion and unsupported
  browsers navigate instantly. Names are enabled ONLY in the shop grid, where
  a product renders at most once per page (duplicates void the transition).
  Verified: exactly one startViewTransition per card click, names matched on
  both ends.
- **Reading progress bar** on blog posts (`src/components/blog/
  reading-progress.tsx`): 2px gold-bronze hairline (A2: royal stays
  interactive-only), transform-only rAF writes, RTL-aware origin, aria-hidden.
  Kept under reduced motion — it maps the reader's own scroll 1:1.
- **Not done, deliberately**: footer marquee (the guide suggests one; the
  owner's restored footer design is law — decision recorded), Embla for the
  PDP gallery (the custom gallery + lightbox already covers the spec).
- **Gate vs baseline: PASS** — a11y 100 on PLP/PDP/post, LCP unchanged, CLS
  ≤ 0.023 (sitewide constant, budget 0.1). The engagement half of the
  Phase 2 → 3 gate (scroll depth + WhatsApp CTA clicks flat-or-up) reads
  from production analytics after deploy.

## Phase 3 record

Owner invoked Phase 3 directly (standing in for the guide's analytics gate —
recorded as an explicit owner decision).

- **Cursor follower** (`src/components/motion/cursor-follower.tsx`): one
  32px trailing ring, mix-blend-difference (legible on navy AND canvas with
  no theme plumbing), swells 1.5x over interactive targets. The native
  cursor is never hidden or replaced. Fine pointers + motion-safe only; the
  rAF loop parks when settled. Verified incl. reduced-motion (ring stays
  hidden).
- **Film grain** (`.sf-grain`): static SVG-turbulence wash at 3% soft-light
  over the storefront (z-25, under the PDP sticky CTA z-30 — re-audit R-007)
  so UI text stays crisp.
  Inline data-URI — no asset, no request; CSP img-src already allows data:.
  Static image, so no reduced-motion surface.
- **360°/WebGL: no code needed** — the mechanism already exists
  (Product.model3dUrl + src/components/product/model-viewer.tsx render 3D in
  the PDP gallery). What's missing is owner-supplied GLB/sequence assets,
  which cannot be invented (hard rule). Decision: owner uploads a model for
  one hero product via /studio whenever ready; no new viewer built.
- **Gate vs baseline: PASS** — a11y 100, LCP unchanged-or-better (PLP
  6.2s best-measured), CLS 0.023/0 unchanged.

## Re-audit (2026-08-21, branch head at PR #94)

Full second pass: measured sweeps + seven delta-aware inspection agents over
everything shipped since the baseline. Measurements held everywhere (crawl:
0 axe / 0 overflow / one h1 per route; Lighthouse: a11y 100 + SEO 100 on all
seven routes, CLS ≤ 0.024). The inspection surfaced 22 findings — 2 P1
regressions introduced by the S-06 work itself, 12 fixable P2s, and the rest
logged. All fixable items were fixed and verified live in the same pass:

**Fixed — P1 (both S-06 regressions):**
- R-001 stale-token dead end: useFormToken now parses the token's embedded
  epoch and refetches past 1h, so a suspended tab can never hold a
  forever-failing token.
- R-002 silent subscriber loss: fake-success is now reserved for the
  honeypot (proof of a bot); token failures return an honest error — proven
  live: fast submit → visible error, retry → success + row stored.

**Fixed — P2:** detail pages regain og:site_name/og:locale via the shared
detailOpenGraph helper (verified hi_IN on /hi PDP) · lint residue purged
(unused useEffect ×5, unused Prisma import) · cloudinary.ts orphan deleted ·
sf-card-enter wrapper made unconditional (load-more no longer remounts
prior batches) · grain z 35→25, under the PDP sticky CTA per its own
contract · consent banner joins the mobile-menu inert set
(data-slot="sf-consent") · cursor-follower honors mid-session
reduced-motion/pointer changes · PDP gallery lightbox arrow keys
direction-aware under RTL · cron mirror-images secret compared
constant-time · breadcrumb landmark label translated ×9 (verified Arabic) ·
Logo uses locale-aware Link + Common.logoHome ×9 (verified /ar) ·
/whatsapp-order pending UI made truly language-free · Arabic dual/few/many
plural branches added to the 10 pre-S-01 count keys.

**Logged, not fixed:**
- R-014 (P2) form-token replay: one aged token validates for any form/IP
  within 6h. Binding the HMAC to the client IP would close it but false-
  rejects mobile CGNAT visitors whose IP rotates between mount and submit —
  deliberately deferred; honeypot + per-action rate limits still gate.
- E-06 (P3, owner/data): 16 of 20 categories have NULL translations, so
  shop category chips fall back to English on non-en locales — same family
  as E-05.
- 404/error boundaries stay English by documented design (boundaries must
  not depend on message loading).
- Design-lab-only aria literals: dev-only surface, not shipped.

## Ported from the archived 2026-07 audit generation (md-sweep)

The pre-v2.0 audit pair now lives at docs/audit-2026-07-*.md (archived,
superseded). Two of its items remain live and move onto this ledger:

- **E-07 (P3, owner action)**: SEC-009 — rotate any provider keys that were
  ever committed/shared during early development (Resend, Blob, DB) from the
  provider dashboards. Not verifiable in-repo.
- **E-08 (P3, owner action)**: delete the leftover scratch websites in the
  owner's Higgsfield dashboard (2026-07 Phase-5 backlog #10).

## md-sweep implementation pass (2026-08-21, third audit)

Third full audit: measurements held the baseline everywhere (crawl 0 axe /
0 overflow; Lighthouse a11y 100 ×7, SEO 100 ×7). The 22-file markdown sweep
plus code inspection produced ~100 verified items; everything classified
pending-implementable was built in this pass:

**Shipped:** E-05 closed (translations columns + studio editors + storefront
localization for Faq/Testimonial/Page, FAQ backfill ×6×8 verified live on
/hi and /ar incl. localized FAQPage JSON-LD; legal-page translation left to
the owner deliberately — binding legal copy needs legal review) · studio
dark mode (DESIGN.md C3; system-scheme driven, all values sourced from the
Appendix A navy scope + the proven dark status-ink set; login QA'd light+
dark; a lightningcss color-scheme:light forcing bug was diagnosed and fixed)
· studio A3 type-scale normalization (12 arbitrary sizes → text-12) · A5
admin elevation tiers e1/e2/e3 tokenized and swapped into six ui/ primitives
· v7 semantic layer re-pointed to royal (--primary/--ring/--sapphire-ink →
--blue-royal; ui/button default variant → semantic primary, v7 shine sweep
retired; studio auth links → semantic ink) · brand-colors fully v2 (OG
cards, email; swatches decoupled as color-meanings; v7 keys deleted) ·
breadcrumb double-prefix P1 fixed across 7 consumers (rendered /hi/hi live)
· form-token staleness measured from a client-side monotonic reference ·
uuid override added — **production npm audit: zero vulnerabilities of any
severity**, S-09 parity re-proven IDENTICAL under it · ~70 doc corrections
+ 2026-07 audit pair archived + residuals ported (E-07/E-08) · docs and
code-comment staleness corrected.

**Open queue (verified pending, next sessions):** /studio/analytics (C1) ·
settings-driven announcement messages (B1) · studio media-picker dialog ·
product-ux benchmark gaps 3/4/7/9 (provenance links, lexical fields, search
ecosystem grouping + synonyms, recipient-framed share link) · ownerTouched
merge-protection on tier re-imports (or correct docs/audit-v7.md:291) ·
source→canonical mapping report · C2 scope-outs (cmdk palette, breadcrumb
topbar, collapsible sidebar, KPI sparklines, saved filters, date-range) ·
full dashboard dark-mode QA behind auth (login surface QA'd; a few
text-blue-royal literals remain in auth-gated dashboard tables) · FAQPage
JSON-LD on /contact: decision recorded — NOT duplicated (Google discourages
same-FAQ markup on two URLs; /faq is canonical) · v2.0-audit-baseline tag
still un-pushable through the env's git proxy (owner one-click on GitHub).

**Owner queue unchanged:** E-01..E-04, E-07, E-08, mold options, Behold id,
UTC-vs-IST, hotlinked-image migration.

## Deploy incident (2026-08-21, post-#96)

P3009 on production: a mid-turn commit shipped the FAQ backfill migration
BEFORE its columns migration existed, so the 12:48 UTC deploy ran the
backfill against a Faq table with no translations column, failed, and left
a failed-migration record that blocks every later deploy. Lesson recorded:
never split a schema+data migration pair across commits.

Fix: the build script self-heals — `prisma migrate resolve --rolled-back
20260821123000_backfill_faq_translations || true` runs before migrate
deploy (inside Vercel, where the prod credentials live). On the broken DB
it clears the failed record so columns→backfill apply in order; on healthy
DBs it exits P3012 and is swallowed. The backfill is NULL-guarded, so even
a re-run is a no-op. The resolve prefix was removed after the green production deploy of the
#97 merge (verified READY) — incident closed.

## External-audit response pass (2026-08-22)

Owner pasted a third-party UX audit; assessment mapped 47 sections → already
shipped / buildable / owner-content / rule-conflicts. Built this pass:

- **N-01 editorial naming** ✅ — `Product.displayName` (translated, studio
  Essentials + Translations); cards + PDP h1 render displayName ?? derived
  short name (`src/lib/product-name.ts`, separator-cut of the owned title,
  never invented). Full title stays canonical for metadata/JSON-LD/wishlist/
  alt/WhatsApp. Verified live: h1 editorial, meta full.
- **IA-01 nav consolidation** ✅ — primary nav = Shop · Custom Order ·
  Portfolio · Studio(/about) · Journal(/blog), Nav.studio/journal ×9; Process/
  Workshops/FAQ/Contact → mobile-menu second register + footer map.
- **IA-02 shop-by-occasion** ✅ — chips in home §4 (inside the canvas band,
  rhythm law intact), one per occasion with ≥1 published piece; self-hidden
  until the owner tags (0 tagged today). Labels ×9.
- **CX-01 commission steps** ✅ — custom-order form framed as numbered steps
  01–04 ×9 locales; fields/validation/WA flow untouched.

Rejected from that audit (recorded): alternative palette hexes (DESIGN.md A
is law), fabricated ★ ratings (no review data — hard-rule adjacent), 1440px
container (1430 rail already shipped). Owner-content gaps it confirms:
original photography system, testimonials, occasion tagging, founder About,
descriptions backlog.

### Studio operations pass (2026-08-22, same day)

- **OPS-01 pipeline statuses** ✅ — InquiryStatus grew DISCUSSION (between
  CONTACTED/QUOTED), IN_PRODUCTION (between CONFIRMED/DELIVERED) and terminal
  LOST (additive enum migration). labels/badges/action schema/analytics
  funnel/converted-definition/pipeline stat grid all updated; verified
  behind auth (seven stage cards render).
- **OPS-02 commission card** ✅ — printable authenticity card at
  /studio/inquiries/[id]/card (outside the dashboard group → chrome-free
  print; proxy auth still applies): RR number, piece (editorial name), client,
  date, material/crafting when present, care (product ?? settings default).
  Linked from the inquiry detail masthead for CONFIRMED/IN_PRODUCTION/
  DELIVERED. Verified via real login (temp local password, invalidated after).
- Next from this slice: studio media library (own step).

### Media library pass (2026-08-22, same day)

- **§32 search** ✅ — /studio/media filename search (GET form, folder-aware,
  insensitive contains).
- **§32 usage locations** ✅ — findMediaUsageDetails() (labeled twin of the
  delete guard's scan) renders a per-file "Used: Product gallery ×3 · …" /
  "Not referenced" line on every library card.
- **media-picker dialog** ✅ (queue item closed) — MediaPicker client dialog
  (staff-only listMediaForPicker action, folder chips + search + cursor
  paging) wired into the product gallery, portfolio gallery and blog cover
  forms as "From library" — reuse without re-upload.
- Verified behind real auth with seeded rows (reverted): usage labels, search
  hit, dialog thumbs. Remaining §32 nice-to-haves (rename, dimensions
  backfill) stay open; alt text already lives on the consuming rows.

### Mobile WhatsApp bar (2026-08-22, same day — closes the audit build list)

- **§37 persistent mobile WA bar** ✅ — MobileWhatsappBar in the (v2) layout:
  fixed bottom below lg (the range with no chrome WA CTA), royal primary
  voice (green stays the PDP Place Order), wa.me/917096036250 via the
  layout's existing waHref, data-wa-source="mobile-bar". Hidden on
  /product/* (PDP sticky bar owns that edge); in-flow spacer keeps the
  footer reachable; safe-area padded; menu-open inerts it via the header's
  chrome selector; motion-pause chip lifted to bottom-20 below lg to clear
  it. Verified at 390px: visibility, PDP exclusion, inert, 15px chip
  clearance, footer clearance.

The external audit's buildable list is now fully executed (naming, nav,
occasions, commission steps, case studies, pipeline+card, media library,
mobile bar). What remains from that audit is owner-content (photography,
testimonials, occasion tagging, founder About, descriptions) and the
long-standing FINDINGS queue.

## Backlog sweep (2026-08-22, one pass — closes the open queue)

- **Gap 7 search** ✅ — src/lib/search-synonyms.ts (hand-curated buyer↔studio
  vocabulary) expands query terms in searchProducts; results group art >
  supplies > print (stable sort on groupForTier). Verified: "epoxy" returns
  resin pieces.
- **Gap 9 drop a hint** ✅ — recipient-framed wa.me share beside the plain
  share in share-buttons (Product.share ×9, analytics channel "hint").
- **Gap 4 lexical fields** ✅ — Product.lexical Json rows; studio Lexical
  section with per-ecosystem suggestion chips (Suited to/Feels like/Pour
  story · Use for/Grade/Coverage · Material/Layer height/Tolerance); rows
  lead the PDP spec sheet. i18n-debt(gap4): values bypass translations.
- **Gap 3 provenance links** ✅ — _ProductProvenance self m2m
  (madeWith/usedIn); studio "Made with" picker (searchProductsForLink staff
  action); PDP renders Made with / What this creates chip-links both
  directions (headings ×9). Verified both directions live.
- **H5 ownerTouched** ✅ — Product.ownerTouched stamped by every studio
  upsert; BOTH import-tiers update paths guard it (touched rows refresh
  inStock/sourceHash only, never content/images). Code-verified; a full
  importer run was not exercised in this pass.
- **B1 announcements** ✅ — settings field is now one-message-per-line
  (textarea); the (v2) layout splits lines into the rotating bar's set.
  Verified with a seeded two-line rotation.
- **Source→canonical report** ✅ — /studio/scraper/mapping: per importSource
  category distribution with proportion bars (13 sources render), linked
  from the scraper masthead.
- **Dark-mode literals** ✅ — all 19 studio files' text-blue-royal →
  text-sapphire-ink (royal on light, gold in the dark scope); zero remain.
- **Bugfix caught en route**: buildUpsertPayload never sent displayName —
  the studio Display-name field silently didn't save (PR #100 regression).
  Fixed here.

Deliberately NOT in this sweep: C2 scope-outs (cmdk palette, breadcrumb
topbar, collapsible sidebar, KPI sparklines, saved filters, date-range) —
they remain scoped out as a distinct studio-UX project; R-014 stays
deferred; UTC-vs-IST + baseline tag remain owner items.

## C2 scope-outs delivered (2026-08-22, same day)

All six formerly-scoped-out studio-UX features shipped in one pass, each
verified behind real auth:

- **⌘K command palette** (cmdk) — role-filtered sidebar destinations (one
  source of truth: sidebar SECTIONS export) + debounced live product jump via
  searchProductsForLink. Verified: Ctrl+K → "Analytics" → navigated.
- **Breadcrumb topbar** — path-derived, labels resolved through the sidebar
  map + static extras; ids render "Detail"; hidden on the dashboard root.
- **Collapsible sidebar** — data-sidebar-collapsed on <html> + CSS arbitrary
  variants (server shell untouched); localStorage persisted, pre-hydration
  restore script. Verified 256→80px + persistence.
- **KPI deltas + sparklines** — StatCard gains vs-previous-window delta
  (status inks, honest zero-window wording) and an inline SVG sparkline fed
  by the chart's own daily series; dashboard converted-count brought to
  parity with analytics (IN_PRODUCTION counts).
- **Saved filter views** — per-device named querystring chips on the
  products list (localStorage, guarded reads/writes).
- **Analytics date-range** — ?from/&to (validated, ≤366d) drives the trend
  chart, funnel/source/product/category/attribution groupings and the
  section notes; empty resets to 90d.

The FINDINGS backlog is now fully closed. Remaining: owner-content queue,
UTC-vs-IST decision, R-014 (deferred by design), baseline tag (owner
one-click).

## Test foundation + Content Gaps (2026-08-22)

- **Vitest unit suite** ✅ — first test infrastructure in the repo:
  vitest.config.mts (@ alias, node env, dummy env for env.ts), `npm run
  test`; 30 tests across product-name (derivation rules), search-synonyms,
  localize (shape-guard/fallback/no-mutation), whatsapp (hard-rule number,
  encoding), form-token (roundtrip, min-fill, tamper, malformed). All green;
  CLAUDE.md updated (was "No test runner configured yet").
- **/studio/content-gaps** ✅ — the owner-content queue as a live worklist:
  missing descriptions (103) · imageless published (19) · needsRewrite (50) ·
  >60-char titles without displayName (307) · untagged occasions (4,373) ·
  bare portfolio case studies (20) · testimonials (0), each with sample
  deep-links into the fixing editor. Sidebar: Overview → Content Gaps.

## Timezone toggle + E2E smoke (2026-08-22)

- **UTC-vs-IST** ✅ resolved as a toggle, not a decision made for the owner:
  SiteSettings.chartTimezone ("UTC" default / "IST"), admin select in Site
  Settings, shared src/lib/day-bucket.ts (fixed +05:30, no DST) driving the
  dashboard + analytics bucketing, "today" boundaries and every chart
  caption. 7 new unit tests incl. the 22:00Z→next-IST-day boundary case.
  Verified live: flipping to IST re-captions all three analytics notes;
  reverted to UTC.
- **E2E smoke** ✅ — scripts/e2e-smoke.mjs (`npm run test:e2e` against a
  running server): 9 checks — five-item nav, announcement bar, shop cards,
  PDP h1 + house-number wiring (hard rule), mobile WA bar present/absent
  rules, /studio login gate. 9/9 against the local build.

## CI gates (2026-08-22)

- **.github/workflows/ci.yml** ✅ — the manual gate loop, enforced: a
  `checks` job (typecheck · lint · vitest) and a `build` job running the real
  `npm run build` (prisma migrate deploy + bootstrap + next build) against a
  throwaway postgres:16 service — the same sequence Vercel runs, so a
  migration that would break the deploy fails in CI first. Concurrency
  cancels superseded runs. E2E smoke stays out (needs a populated catalog).
- De-risked before pushing: the build job was simulated locally against an
  EMPTY database — all 25 migrations replayed from scratch (first full
  from-scratch replay of this session's five), InquiryStatus carries its
  nine values, _ProductProvenance + displayName/lexical/ownerTouched exist,
  chartTimezone defaults UTC, bootstrap seeded 24 categories, build passed.

### CI's first run caught six real lint errors (2026-08-22)

The `checks` job failed on the very PR that added it — correctly. Root cause
of them slipping through: this session's local gate ran
`npm run lint 2>&1 | tail -1`, which prints a BLANK line when eslint fails,
so failures read as clean. Lesson recorded: gate on the exit code, never on
tail output.

Fixed (all in code written this session, no rule suppressed):
- **react-hooks/set-state-in-effect ×4** — `sidebar-collapse` and
  `saved-views` now read their external sources (the `<html>` attribute and
  localStorage) via `useSyncExternalStore` with a stable cached snapshot
  instead of mirroring them into state from a mount effect; the command
  palette derives visible results from `{q, items}` (which also kills stale
  results flashing under a newer query) instead of clearing state in an
  effect; the media picker drops its effect entirely and fetches from the
  events that change what should be shown (dialog open, folder chip, search,
  load more), with the folder passed explicitly — removing a latent
  stale-closure bug where a chip click would have fetched the previous
  folder.
- **react/no-unescaped-entities ×2** — apostrophes in the picker's empty
  state and the portfolio "Client's words" label.
- Both eslint warnings (unused disable directive, missing dep) disappeared
  with the picker effect.

Re-verified behaviourally behind real auth after the refactor: collapse
256→80px with aria-pressed + persistence across reload, palette results for
"resin", picker fetching per folder (products → blog → All), saved-view chip
surviving reload, zero page errors.
