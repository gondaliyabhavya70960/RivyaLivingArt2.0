> **ARCHIVED (v7 audit — program closed).** This audited the v7 Sapphire
> Atelier tree, since rebuilt as v2.0 (/DESIGN.md, Phase 7 commit b1cf3e6).
> All C/H items and nearly all M/L items closed — see Backlog disposition.
> Still open at archive time: H5's owner-edit field-merge (tombstone half
> shipped only) and M-A4's source→canonical mapping report. File paths
> describe the retired tree — re-verify before actioning anything here.

# ResinRiva 2.0 — Step-3 Audit Report (v7)

## Provenance

- **Date:** 2026-08-13
- **Tree audited:** HEAD `8797151` (clean) — one commit after `8ae1685` "Admin Phases 9-13 + no-decorative-3D storefront rule (v7)"
- **Method:** Rendered audit in headless Chromium/Playwright at 1440×900 (desktop), 768/834/900/1024 (tablet spot-checks) and 375×812 (mobile), across five lenses: Storefront UI/UX, Admin (/studio), Mobile, Accessibility (WCAG 2.1 AA), Performance. Cross-checked against source at HEAD, the live Postgres catalog (7,944 products; 4,373 PUBLISHED; 34,645 ProductImage rows), response headers from the running `next start` server, and locale renders (/hi, /ar incl. RTL).
- **Adversarial verification:** Every Critical/High finding was independently re-reproduced (or refuted) against the real system — live DOM measurement, authenticated studio sessions, DB queries, import-pipeline re-runs, curl header checks. Medium/Low findings are rendered-audit + code-verified but did not receive the adversarial pass.
- **Verification environment caveat:** the long-running server on `:3000` serves a **stale `.next` build (10:58 UTC) predating commit `8ae1685` (12:54)**. Three High findings against the admin were artifacts of that stale build and are **refuted** (see Appendix). The stale build itself is an ops defect: rebuild + restart is part of the fix plan.

**Confirmed totals: 4 Critical · 12 High · 27 Medium · 19 Low (62 findings). 3 refuted (appendix).**

---

## Critical

### C1. Header "Start on WhatsApp" CTA renders off-canvas at tablet widths (~768–1090px)

- **Problem:** The header's primary CTA renders past the viewport edge: at 768px its right edge measures x=928; at 1024px, x=1082. The fixed header's `pointer-events-none` wrapper means fixed elements never extend `scrollWidth` (measured 1014 at a 1024 viewport), so no horizontal scrollbar appears and `window.scrollTo(500,0)` leaves `scrollX=0` — a real Playwright click times out. Both chrome modes clip (transparent top row and scrolled glass chip). "Custom Order" wraps to two lines in the same band. Verified off-canvas band: ~768–1090px (fits at 1100px — the originally claimed "to ~1250px" was overstated).
- **Why it matters:** WhatsApp is the site's only checkout; the header CTA is the highest-intent conversion affordance and it is structurally untappable on every tablet and small laptop, on every route.
- **UX/Conversion impact:** Invisible/unreachable primary conversion action for an entire device class; screenshot at 1024px shows "Start on Wh…" cut at the edge.
- **Recommended solution:** Gate the header Button behind `hidden xl:inline-flex` (tablets keep the design.md-sanctioned floating WhatsApp FAB and the mobile-menu CTA); tighten `desktopLinkVisibility` below `lg`; add `min-w-0`/`shrink` to the nav cluster so nothing can push past the container. No design.md conflict — the N10 scroll-morph and sapphire CTA voice are untouched.
- **Priority:** P0
- **Where:** `src/components/layout/dynamic-header.tsx` (rows ~236–368; Button line 344; `desktopLinkVisibility` line 31)

### C2. Declared ISR is silently dead on every catalog route

- **Problem:** /product/[slug], /shop, /shop/[category], /blog, /portfolio all export `revalidate = 300` yet respond `Cache-Control: private, no-cache, no-store` (curl-verified against the production `next start` server; the five routes are absent from `.next/prerender-manifest.json` while /, /about, /faq, /contact correctly return `s-maxage=300` + `x-nextjs-cache: HIT`). Sole cause: each page unconditionally `await searchParams` — the PDP only to read the staff `?preview=1` flag (page.tsx:163-169), blog/portfolio only for `?page`. Repeat PDP curls take ~55–65ms of full SSR (~8 DB queries) vs ~6–10ms cached.
- **Why it matters:** 4,373 products × 9 locales — mostly crawler traffic — hit full per-request SSR against Neon; DB load scales linearly with bot traffic. The in-code "ISR: catalog edits reach the page within 5 minutes" comments are false in practice.
- **UX/Conversion impact:** Production TTFB on every browse→product click multiplies the local 40–70ms figure; compounds with C-adjacent finding H11 (no pending UI) into dead-feeling navigation.
- **Recommended solution:** PDP: replace `?preview=1` with `draftMode()` enabled via a signed studio route handler so the public render never touches searchParams. Blog/portfolio: move `?page` behind a Suspense/client boundary or statically render page 1. /shop and /shop/[category] read filters from searchParams, so their fix is data-layer caching (see M-P4/M-P5). Re-verify with `curl -I` that `s-maxage` returns.
- **Priority:** P0
- **Where:** `src/app/[locale]/product/[slug]/page.tsx` (lines 63–68, 163–176); `src/app/[locale]/blog/page.tsx`; `src/app/[locale]/portfolio/page.tsx`

### C3. 99% of catalog imagery bypasses the image optimizer

- **Problem:** 34,304 of 34,645 ProductImage rows (DB-exact) point at hosts outside `images.remotePatterns` — cdn.shopify.com=31,247, resinpro.eu=1,097, banteybanatey.com=1,028, i0.wp.com=350, 3dzone.in=322, etc. — so `isOptimizableImageSrc()` returns false and ProductCard/ProductGallery render raw `<img>`: original-resolution files, no srcset, no AVIF/WebP, no width capping. Live-verified: /en/shop ships zero `/_next/image` URLs; a PDP hero renders an eager full-size Etsy original. Only 171 of 31,247 Shopify URLs carry any width param. (One mitigation confirmed: hover images are not fetched on touch devices per PERF-306.)
- **Why it matters:** This is the single largest real-world payload and LCP cost on the site, and it grows with every imported tier. The card slot is capped at 25vw–100vw (`CARD_SIZES`) while originals ship.
- **UX/Conversion impact:** The shop grid can pull tens of MB per scroll on mobile; the PDP LCP element is a full-res eager original.
- **Recommended solution:** Prefer **mirroring over allowlisting**: the exclusion of Shopify et al. from remotePatterns is a deliberate, documented quota decision (31k+ unique source images is exactly Vercel's billed dimension), and `mirrorProductImage` (`src/actions/import.ts:385`) is the codebase's own intended remedy. Finish the mirror path (fetch → Vercel Blob → rewrite ProductImage.url), starting with tier-1/2 published products; use Shopify's `?width=` param as a stopgap on the raw-`<img>` fallback.
- **Priority:** P0
- **Where:** `src/lib/image-src.ts`; `next.config.ts` images.remotePatterns; `src/actions/import.ts:385`; consumers `src/components/shop/product-card.tsx:98`, `src/components/product/gallery.tsx:105`

### C4. /studio/products crashes at HEAD — client-module constant imported into a server query *(discovered during adversarial verification)*

- **Problem:** `src/app/studio/(dashboard)/products/page.tsx` (line 9) imports `PAGE_SIZE` from the `"use client"` module `src/components/studio/pagination.tsx`. In the RSC graph that resolves to a client-reference proxy function, so `findMany({ take: PAGE_SIZE })` throws Prisma `Invalid value for argument take: could not serialize [object Function]` (`take:[object Function]` / `skip:NaN`). Verified live, authenticated, against the real 7,944-row DB: the admin gets the "This page didn't load" error boundary and zero products. Masked in casual testing because `:3000` still serves the pre-fix 10:58 build.
- **Why it matters:** The new server-side-paginated product list (the fix that refuted two audit findings — see Appendix) is dead on arrival; the admin's core screen errors while the editor route still works.
- **UX/Conversion impact:** Owner cannot list, filter, bulk-act on, or reach products from the table at HEAD.
- **Recommended solution:** One-liner: define a local `const PAGE_SIZE = 50` in page.tsx (the pattern inquiries/activity/scraper-review already use) or move the constant to a server-safe shared module. Then **rebuild and restart the stale `:3000` server** so the deployed build matches HEAD.
- **Priority:** P0 (hotfix)
- **Where:** `src/app/studio/(dashboard)/products/page.tsx:9,68–72`; `src/components/studio/pagination.tsx`

---

## High

### H1. Tier-4 / supplies PDPs reuse the resin-commission template wholesale

- **Problem:** On /product/m3-x-6-mm-button-head-cap-screw (pack of 10 machine screws; DB: tier 4, category print-hardware → group "print" via `groupForCategorySlug`), the page server-renders "Poured, cured & finished by hand in our studio", "₹199 · no two pieces alike", the reference-image uploader ("Names to embed, colours you love, the story behind it…"), Handcrafted/Bespoke/Heirloom-quality pillars, and resin FAQs (FAQs are `db.faq.findMany({take:3})`, unfiltered). The trust bullets (page.tsx:521-535) and uniqueLabel (:507-509) are ungated while line 513 already gates the pour-variance note on the same helper — the gating pattern exists in the same block.
- **Why it matters:** Violates locked design.md rules — "scarcity only when TRUE" (v5) and "supplies and 3D print present as their own ecosystems" (v6). Gating this copy *enforces* the design system.
- **UX/Conversion impact:** False one-of-one claims on mass-produced hardware corrode the credibility of the same claims on genuine one-of-one resin work.
- **Recommended solution:** Gate craft bullets, uniqueLabel, provenance pillars, reference-uploader copy and FAQ set on `groupForCategorySlug(product.category.slug)`: art keeps the commission voice; supplies/print get a functional voice (specs, compatibility, pack size, ship time) with a plain WhatsApp order panel.
- **Priority:** P1
- **Where:** `src/app/[locale]/product/[slug]/page.tsx` (507–535, FAQ query :255); `src/lib/catalog-taxonomy.ts:315-323`

### H2. Out-of-stock products present a fully active "Place order" flow — and the order action never checks stock

- **Problem:** The screw PDP shows an OUT OF STOCK badge, "Currently out of stock" spec row, and `schema.org/OutOfStock` JSON-LD, yet renders an active sapphire "Place order" submit (no `disabled`) and a stock-silent live order summary. `OrderPanelProduct` has no `inStock` field. Verification went further: `submitProductOrder` (`src/actions/order.ts:217-228`) never selects or checks `inStock`, so an out-of-stock order completes end-to-end (Inquiry row + WhatsApp deep link). DB: exactly 214 of 500 published tier-4 products are OOS; "From the same shelf" on this page renders 4/4 OOS cards, each still offering "Customize" (related query orders by `createdAt desc` only).
- **Why it matters:** Contradicts the locked "scarcity only when TRUE — never fake stock" and "trust signals at the decision moment" rules at the decision moment itself.
- **UX/Conversion impact:** Customers WhatsApp-order items that cannot ship — avoidable support conversations, eroded trust.
- **Recommended solution:** Pass `inStock` into the order panel; for OOS reframe the CTA ("Ask about restock on WhatsApp" — still a sapphire WhatsApp primary, design-consistent) and prefill the message accordingly; add an `inStock` guard in `submitProductOrder`; order related-product queries by `inStock desc`.
- **Priority:** P1
- **Where:** `src/components/product/order-panel.tsx`; `src/app/[locale]/product/[slug]/page.tsx` (:215-223 related query); `src/actions/order.ts:217-228`

### H3. Catalog browse: 12 items per fetch against 4,373 products, depth not in the URL

- **Problem:** /shop first paint: "Showing 12 of 4,373 pieces" (12 cards, 4-across at 1440px); `take = 12` (`src/lib/shop.ts:247`, no caller overrides). IntersectionObserver sentinel (600px rootMargin) auto-appends 12 at a time; six bottom-scrolls grew the grid 12→96 and document height 4,139px→17,060px, footer permanently escaping. Cursor lives in `useState` only — URL never changes; reload collapsed 108 loaded cards to ~36. Molds, Tools & Kits (1,842 items, DB-confirmed) is effectively unbrowseable. (A manual "Load more" button exists at shop-explorer.tsx:430-441 but the sentinel auto-fires before it can be reached — it is a network-failure fallback only.)
- **Why it matters:** design.md itself mandates cursor pagination "with a total count" and "all state lives in the URL" — the current depth-in-React-state behavior is the deviation, not the fix.
- **UX/Conversion impact:** Most of the catalog is practically unreachable; footer (newsletter, locale switcher, legal) unusable mid-browse; depth not shareable or back-button-safe.
- **Recommended solution:** Raise fetch size to 24–48; switch to an explicit "Load more (n of N)" button after the second auto-load; mirror cursor/offset into the URL.
- **Priority:** P1
- **Where:** `src/lib/shop.ts:247`; `src/components/shop/shop-explorer.tsx` (sentinel :200-211, apply())

### H4. USD-denominated imports render with ₹ formatting

- **Problem:** The screw PDP's "You may also like" shelf server-renders "Gift Card $100" at ₹100, "AMS Compatible Spool--Empty" at ₹4, "Bed Bond 3D Print Bed Adhesive" at ₹15 (screenshot-verified; "Gift Card $50" shows ₹50 on /shop and its own PDP). DB: all PUBLISHED, tier 4, `importSource=sheet:atomic-filament`, priceMin holding raw USD numerals scraped from US stores (atomicfilament.com, coex3d.com). Root cause nuance from verification: the sheet has a `currency` column but it **falsely labels these rows "INR"** — the importer trusted it; `formatPriceBand` (`src/lib/utils.ts:55-60`) then formats everything as INR via Intl.
- **Why it matters:** Site-wide INR display is the intended design; the data is wrong. A ₹4 spool and a ₹100 "$100" gift card destroy price credibility across the 3D-print ecosystem.
- **UX/Conversion impact:** Visibly absurd prices on a luxury storefront; invites WhatsApp orders at impossible prices.
- **Recommended solution:** Audit tier-4 imports for USD sources in `prisma/import-tiers.ts`; distrust the sheet's `currency` column for foreign sourceKeys; convert or flag (`showPrice=false` → "Enquire", a mechanism formatPriceBand already supports and the shelf already renders); unpublish foreign currency artifacts (gift cards) that don't belong in this store.
- **Priority:** P1 (data pass can ship same-day)
- **Where:** `prisma/import-tiers.ts` (~:191 `intOrNull(raw.pricemin)`); `data/tiers/Tier4_3DPrint.csv.gz`; `src/lib/utils.ts:55-60`

### H5. Sheet import clobbers owner edits on hash change; deleted sheet products resurrect *(downgraded from Critical by verification)*

- **Problem:** Reproduced live: after simulated owner edits on a sheet product (title, careNotes, seoTitle, status→DRAFT, an uploaded image), a forced sourceHash mismatch + import run reverted every field, forced status back to PUBLISHED, reassigned featured, and `images.deleteMany`+create wiped the owner image. `upsertProduct` sets no dirty flag and never touches sourceHash. Hard-deleting a sheet product and re-running the import re-created it PUBLISHED under a new id — no tombstone. The import runs on every deploy (`prisma/bootstrap.ts`). **Verification corrections:** the "zero indication" claim is stale — `provenance-section.tsx` (shipped in `8ae1685`) renders a read-only Provenance panel on every imported product naming source/ref/tier and warning that sheet-owned fields "survive only until" the sheet row changes; and unchanged rows are hash-skipped, so owner edits DO survive until that row's sheet content changes (or a NORMALIZER_VERSION bump). Only deletion reverses unconditionally.
- **Why it matters:** Sheet-as-source-of-truth is the documented owner-brief design and is now disclosed in the editor — but silent resurrection of deletes and whole-row clobber on any sheet change still make owner curation disposable without warning of *when*.
- **UX/Conversion impact:** Unpublish/delete decisions reverse themselves at deploy time; owner-uploaded imagery is destroyed.
- **Recommended solution:** (a) `deletedImportRefs` tombstone table honored by import-tiers.ts; (b) `ownerTouched`/per-field dirty flag set by `upsertProduct`/`deleteProducts`, with the importer field-merging rather than overwriting touched rows.
- **Priority:** P1
- **Where:** `prisma/import-tiers.ts` (upsert ~404–443); `src/actions/products.ts`

### H6. Product Scraper "command center" contradicts the live catalog — and its key scheme enables double-imports

- **Problem:** Rendered live (authenticated): /studio/scraper shows WEBSITES 115 (114 enabled), SCRAPED 0, NOT RUN 114, PRODUCTS STAGED 0, PENDING REVIEW 0 — every source "Not run / 0 products" — while the DB holds 7,944 products, all `importSource='sheet:<key>'`, and 47 of the 115 registry keys have live products under the matching key (leoberry-gifts=210, brownwoods4art=1,689, exactly as claimed). The page counts only `ScrapedProduct` staging rows (page.tsx:49); `Product` is never queried. Verification sharpened the risk: scraper approval (`src/actions/scraper-review.ts:237`) writes `importSource=row.sourceKey` (bare key) while the sheet import writes `'sheet:'+key`, so the `@@unique([importSource,importRef])` dedupe **cannot collide across the two pipelines** — approving re-scraped rows for an already-imported source creates duplicate live products (gated only by the needs-rewrite guard). Batch buttons mirror the sheet tiers with the same sourceKeys.
- **Why it matters:** Two parallel ingestion systems with identical taxonomy and source keys but disjoint counters produce wrong operator decisions; the header's "research reference only" note softens but does not cure it.
- **UX/Conversion impact:** Owner-facing: the one page naming all sources says the catalog doesn't exist; risk of duplicate live products.
- **Recommended solution:** Join `Product.importSource` against the registry to add a "Live products" column per source; add a banner explaining the sheet-pipeline relationship linking to /studio/sheet-import; normalize importSource keys (or dedupe across both prefixes) before any scraper approval can go live.
- **Priority:** P1
- **Where:** `src/app/studio/(dashboard)/scraper/page.tsx:49-61`; `src/actions/scraper-review.ts:237`; `src/lib/scraper/health.ts`

### H7. Mobile /shop buries the grid under an 828px chip wall

- **Problem:** Pixel-exact reproduction at 375×812: the collection chip group ("Filter by collection", `mt-6 flex flex-wrap gap-2`) measures top y=394 → bottom y=1222 (828px); the first product card starts at y=1478 — ~1.8 viewports of filter chrome before the first of 4,373 pieces. Long labels ("Resin Home Decor & Accessories 664") wrap ~1 per row. (Minor correction: 21 chips render, not 25 — "All collections" + 20 non-empty categories.)
- **Why it matters:** design.md locks "the grid is the design" for the Catalogue family and requires 375px sanity; page.tsx's own comment says "the grid owns the fold". The current mobile render contradicts the locked intent.
- **UX/Conversion impact:** Product discovery — the page's purpose — starts two scrolls down on the device class where most shoppers arrive; high abandonment risk.
- **Recommended solution:** Below `md`, collapse the collection index into a horizontal snap-scroll rail (`overflow-x-auto`, no wrap, edge fade) or a "Collections" disclosure/bottom-sheet; keep the wrapped grid at `md+`. Tabs row + toolbar stay.
- **Priority:** P1
- **Where:** `src/components/shop/shop-explorer.tsx:271-305`

### H8. Mobile sticky PDP bar hardcodes English "Customize" in all 9 locales

- **Problem:** `sticky-mobile-cta.tsx:77` hardcodes the literal "Customize" in the `lg:hidden` sticky bar. Live: /hi/product/5-inch-resin-photo-frame renders exactly one English ">Customize<" (the sticky-bar CTA) while the same page renders "कस्टमाइज़ करें" 19 times elsewhere; /ar likewise. `Shop.card.customize` exists translated in all 9 catalogs.
- **Why it matters:** Breaks the locked 9-locale/RTL i18n architecture on the highest-intent product-page action — and only mobile users see it.
- **UX/Conversion impact:** Untranslated primary CTA for all 8 non-English locales, including RTL Arabic.
- **Recommended solution:** `const t = useTranslations('Shop'); …{t('card.customize')}` — or a dedicated `Product.stickyCustomize` key in all 9 catalogs. One-line fix.
- **Priority:** P1 (quick win — ship with the P0 batch)
- **Where:** `src/components/product/sticky-mobile-cta.tsx:77`

### H9. Shop mega-menu is keyboard-inoperable

- **Problem:** `onFocus={isShopMega ? openMega : scheduleMegaClose}` is attached to every nav link (dynamic-header.tsx:281-282), so focusing any non-Shop link arms the 160ms close timer (:97-100); the panel cancels it only on `onMouseEnter`, never on focus. Playwright: in a full 22-tab walk at 250ms/Tab, focus never enters `#shop-mega` — the panel unmounts one Tab after opening and the tab order jumps past all 16 panel links. In an exact-timing race, focus lands inside the panel, the pending timer unmounts it, and `activeElement` drops to `<body>`. No Enter/ArrowDown path into the panel; `aria-controls` is null in the live DOM. Mouse path fully works. WCAG 2.1.1 / 2.4.3 failures (categories remain reachable via /shop, but the announced popup is unreachable).
- **Why it matters:** design.md wants 0ms focus response and always-visible focus rings; nothing mandates close-on-focus. Keyboard/switch users get strictly less than mouse users; dropped-to-body focus strands screen-reader users.
- **UX/Conversion impact:** Category/ecosystem links and the portfolio doorway are mouse-only.
- **Recommended solution:** Stop calling `scheduleMegaClose` from `onFocus` of non-Shop links; close via a `focusout` handler checking `relatedTarget` against trigger + `#shop-mega` (keep the 160ms delay for `mouseleave` only); keep the panel open while focus is inside; Escape returns focus to the trigger.
- **Priority:** P1
- **Where:** `src/components/layout/dynamic-header.tsx` (93–100, 281–282, 374–460)

### H10. The entire conversion surface is hardcoded English on the 8 non-English locales

- **Problem:** On /ar the document is `lang="ar" dir="rtl"` with genuinely Arabic chrome, yet the SSR HTML contains the full English ordering flow: "Name (required)", "Phone", "Additional notes (optional)", "Reference images", "Drag & drop", "Place order", "live order summary", "Poured, cured & finished by hand…", "Care & keeping", "Notify me", "Enquire", "Price on WhatsApp". Client-side confirmed: empty-form submit on /ar produces English `role=alert` errors ("Please tell us your name.", "Please enter a valid phone number."); lightbox aria-labels are "Previous image"/"Next image"/"Close". The ONLY `lang` attribute in the entire /ar document is the root — zero `lang="en"` overrides (WCAG 3.1.2). All strings source-verified across order-panel.tsx (validation :218-230, summary :508-549), page.tsx (:498, :502, :523-525), gallery, reference-uploader, sticky bar, FloatingWhatsApp, breadcrumbs, dialog/sheet, newsletter, carousels, consent gate.
- **Why it matters:** design.md line 25 locks the 9-locale/RTL i18n architecture; `messages/ar.json` already carries a translated Product namespace and the same components already use `useTranslations` for adjacent keys — these are translation gaps, not intent.
- **UX/Conversion impact:** The site's only checkout is barely intelligible to non-English screen-reader users (English text spoken with the page-language voice) and an untranslated wall for sighted users at the exact conversion moment.
- **Recommended solution:** Move all listed strings into the existing `messages/*.json` namespaces (the architecture and fallback pattern already exist — page.tsx:200-203); until translated, wrap English passages in `lang="en"` as a stopgap.
- **Priority:** P1
- **Where:** `src/components/product/order-panel.tsx`, `gallery.tsx`, `reference-uploader.tsx`, `sticky-mobile-cta.tsx`, `src/components/layout/floating-whatsapp.tsx`, `breadcrumbs.tsx`, `src/components/ui/dialog.tsx`, `sheet.tsx`, `src/components/sections/newsletter-form.tsx`, `testimonial-carousel.tsx`, `collections-rail.tsx`, `src/components/analytics/consent-gate.tsx`, `src/app/[locale]/product/[slug]/page.tsx`

### H11. Zero loading.tsx in the public tree — no pending UI on any catalog navigation

- **Problem:** The only loading.tsx in the repo is `src/app/studio/(dashboard)/loading.tsx`; none exists under `src/app/[locale]/`. All public catalog routes serve `no-store` headers at runtime (see C2), so every navigation is a full server round trip. Live browser repro with a delayed RSC response: after clicking the hero CTA, a 20ms-resolution logger recorded zero DOM changes and zero pending indicators (no aria-busy/progressbar/skeleton/spinner) for the entire wait; the shop page then mounted at opacity 0 and faded in over ~450ms (`template.tsx`, measured 0.40 at +23ms → 0.98 at +244ms). No nprogress/useLinkStatus/global progress bar exists; ShopExplorer's `isPending` opacity covers only intra-shop filter changes.
- **Why it matters:** The "did my tap register?" failure lands exactly on the highest-intent paths (browse → product) at production Neon latency.
- **UX/Conversion impact:** Dead-then-sluggish navigation on every catalog click; compounded by the 450ms enter fade.
- **Recommended solution:** Add loading.tsx skeletons (dark-canvas card/grid placeholders per design.md — no new chrome; design.md has no loading-state rules to conflict with) for /shop, /shop/[category], /product/[slug], /search, /blog, /portfolio, /whatsapp-order. Also lets the router paint the static shell instantly while RSC streams.
- **Priority:** P1
- **Where:** `src/app/[locale]/{shop,shop/[category],product/[slug],search,blog,portfolio,whatsapp-order}/` (loading.tsx absent); `src/app/[locale]/template.tsx`

### H12. KineticHeading statically imports GSAP, shipping ~47KB gz on 16 of 18 public routes

- **Problem:** `kinetic-heading.tsx:6` statically imports `{ gsap, ScrollTrigger, SplitText }` from `@/lib/gsap`; the GSAP chunk `3h32g6s466s00.js` (120,745 B raw / 46,885 B gz, size-verified) ships as first-load `<script async>` on every route rendering KineticHeading (confirmed in /, /shop, /about, /faq) — for an effect that is post-mount, reduced-motion-guarded, and font-wait-capped, with SSR already emitting the plain element. This defeats SmoothScrollProvider's PERF-301 guarded dynamic import of the same modules. **Verification corrections:** /privacy and /terms do NOT ship the chunk (16 of 18 routes, not all); the second cited chunk is a shared provider chunk, not GSAP — real added cost is ~47KB gz, not ~58KB; and the home page also statically imports StatCounter/VelocityMarquee (plus scroll-scene/pinned-story import `@/lib/gsap`), so home keeps the chunk unless those convert in the same pass.
- **Why it matters:** ~47KB gz parsed before hydration on every entry page for zero above-the-fold benefit, for a WhatsApp-first mid-range-mobile audience.
- **UX/Conversion impact:** Slower TTI on every entry page.
- **Recommended solution:** Mirror smooth-scroll-provider.tsx: dynamic-import `@/lib/gsap` inside the effect after the reduced-motion/splittable guards, rendering the plain heading immediately; convert home's other static GSAP importers in the same pass. Animation behavior preserved — no design.md conflict.
- **Priority:** P1
- **Where:** `src/components/motion/kinetic-heading.tsx:6`; `src/components/sections/home-hero.tsx`; stat-counter, velocity-marquee, scroll-scene, pinned-story

---

## Medium

*(Rendered-audit + code-verified; not adversarially re-verified.)*

### Storefront

**M-S1. Mega-menu picks links by raw product count, burying flagship categories** — `src/lib/catalog-nav.ts` (sort by `_count`, slice(0,6)). Problem: Resin Art column lists bulk-scraped categories (Resin Home Decor 664, Festive & Pooja 240…) while Varmala Preservation (11 pieces, the flagship craft anchoring the home hero) plus Gift Collections/Trays/Furniture are invisible. Why it matters: inverts v6's merchandising weight for tier-1 crafts. Impact: highest-margin categories crowded out of primary nav. Fix: order by curated taxonomy order / explicit merchandising weight in `catalog-taxonomy.ts`; count as tiebreaker; always include flagships. Priority: P2.

**M-S2. /faq hero collides with overlay chrome at 1440px** — `src/app/[locale]/faq/page.tsx` (~:71). Problem: first Section uses `py-16 md:py-20`, not clearing the ~130px transparent nav + announcement bar; eyebrow renders under/through the wordmark. Why: sibling pages clear correctly (about `pt-36 md:pt-44`, search `pt-28 md:pt-32`). Impact: text-on-text collision on load of a core page. Fix: `pt-32 md:pt-40`. Priority: P2.

**M-S3. Category pages duplicate their featured products immediately** — `src/app/[locale]/shop/[category]/page.tsx` (~:284 + ShopExplorer initialItems). Problem: /shop/varmala-preservation shows the same 4 cards in "Featured from this collection" and at the top of the 11-piece grid — 15 cards for 11 pieces, pairs simultaneously visible. Impact: reads as a rendering bug in small curated collections (most art categories are 2–54 pieces). Fix: exclude featured IDs from the grid's first page, or suppress the featured row under ~16 pieces. Priority: P2.

**M-S4. Duplicate catalog rows render as identical adjacent cards** — data via `prisma/import-tiers.ts`, rendered by product-card.tsx. Problem: same-title pairs side-by-side on /shop p.1; "Kanku – Chawal," (comma-truncated) ×4 in the 11-piece varmala collection; DB: 34 duplicated titles ("Resin Pooja Thali" ×17, "Customise Gold Ganesh" ×9). Impact: reads as pagination bug; wastes premium grid slots; truncated titles look like data corruption. Fix: merge into variant chips (card already supports `variantChips`) or disambiguate; repair truncated titles; uniqueness pass in import. Priority: P2.

**M-S5. Card titles unclamped raw SEO strings** — `product-card.tsx` (h3 ~:179) + home spotlight in page.tsx. Problem: 25–35-word scraped titles run 8–9 lines in Playfair next to one-line neighbours; home "One piece, up close" sets the same raw title as a six-line display headline. Impact: breaks the Catalogue "uniform cards" rhythm; price pushed out of the eye line. Fix: `line-clamp-2` + `title` attr on cards; `shortTagline`/curated display name for the spotlight. Priority: P2.

**M-S6. Home section headings render after their content** — `src/app/[locale]/page.tsx` (462–476 + recent-commissions fold). Problem: "Featured pieces" and "Recent commissions" appear below the grids they label; scanning top-down each trailing heading visually attaches to the *next* section. Impact: two of three product-bearing home folds are anonymous to scanners (see also M-A5 for the SR consequence). Fix: leading micro-label above each collage, or move the h2 above the grid. Priority: P2.

### Admin

**M-A1. /studio/products opens on a wall of auto-demoted drafts** — products/page.tsx (orderBy updatedAt desc) + product-list.tsx. Problem: the deploy import touches all 3,571 demoted drafts, floating them above every published product; they're indistinguishable from intentional owner drafts. Impact: first impression is junk; unsafe to clean. Fix: Published-first status tabs with counts; badge sheet-demoted rows ("out of tier cap") using importSource + tier. Priority: P2.

**M-A2. Import stamps resin-art care notes on every imported product** — `prisma/import-tiers.ts:413` + /studio/settings. Problem: `careNotes: DEFAULT_CARE_NOTES` unconditionally — an M3 screw carries "Wipe clean with a soft, dry cloth…"; also permanently defeats the SiteSettings default-care-notes fallback (all 7,944 rows have own notes, so the setting is a no-op that the settings screen misrepresents). Fix: null on import (let fallback apply) or tier-aware defaults. Priority: P2.

**M-A3. Product editor is resin-only for 3D-print products** — product-form/pricing-specs-section.tsx + import-tiers.ts. Problem: tier-4 items get "e.g. Epoxy resin, dried florals" placeholders and resin occasion chips; no print fields. Data: materials populated on 0 of 7,565 imported rows, dimensions on 9, model3dUrl on 0 of 500 published tier-4. Impact: a named brand pillar has structurally empty product pages and an editor that fights manual fixes. Fix: tier-aware "3D printing" section (material/filament, dimensions, pack size, print notes); map sheet spec columns on import. Priority: P2.

**M-A4. Sheet category mapping misfiles with no review path** — product-list.tsx (BulkBar) + catalog-taxonomy.ts. Problem: "Baby Bandana Bibs" / "Sleep Bag - Farmstead" / "The Declutter Devotional" auto-bucketed into Printer Parts & Tools; no mapping report; bulk bar lacks "Change category". Impact: nonsense taxonomy leaks to public category pages; hand cleanup at 4.4k scale impossible. Fix: bulk change-category action + mapping report grouped by source→canonical, sorted by confidence. Priority: P2.

**M-A5. Media Library is blind to 100% of catalog imagery** — media/page.tsx + import-tiers.ts. Problem: reports "No files yet" while the site serves ~8,000 product images hot-linked from scraped third-party hosts (Media model tracks only studio uploads). Impact: the catalog's visual layer depends entirely on competitor/supplier hosts with zero visibility; no broken-image audit. Fix: read-only "external images" tab with host-health audit + the C3 mirroring job. Priority: P2 (partially absorbed by C3).

**M-A6. Studio auth guard fails open and can brick login off-Vercel** — `src/middleware.ts:36-47`. Problem: when Auth.js errors in middleware (verified: UntrustedHost without AUTH_TRUST_HOST), `req.auth` is truthy for anonymous requests — /studio/* passes the middleware layer un-authenticated (only the layout's `requireStaffPage` catches it) and /studio/login|signup bounce signed-out visitors to /studio → ERR_TOO_MANY_REDIRECTS lockout. Impact: any non-Vercel deploy loses the middleware auth layer and the admin entirely (the stale-:3000 login loop seen during verification is this bug). Fix: fail closed (only bounce when `req.auth?.user` exists); never redirect the login page into a guarded path; require AUTH_TRUST_HOST in `src/lib/env.ts` validation. Priority: P2 (security posture — consider P1 if self-hosting is planned).

### Mobile

**M-M1. Mobile-nav Collections quick-links are 19px-tall targets** — dynamic-header.tsx (606–636). Problem: plain `text-sm` links on a 36px pitch (two links sharing a row) while primary items above get `min-h-11`. Fix: `inline-flex min-h-11 items-center` + wider `gap-y`. Priority: P2.

**M-M2. All filter chips are 36px with no hit extension** — shop-explorer.tsx:46 (CHIP_BASE), portfolio/page.tsx:271, shop/[category]. Problem: `min-h-9` chips across /shop, /portfolio, category pages; unlike card overlay buttons they get no `after:-inset-1` extension. Fix: `min-h-11` or the existing inset pattern. Priority: P2.

**M-M3. PDP h1 renders 10-line, 378px headlines at 375px** — product page.tsx:464. Problem: `text-4xl` Playfair on long SEO titles; half a viewport before price/order panel. Fix: step down for titles >~60 chars or `line-clamp-4` with full name in the spec sheet. Priority: P2.

**M-M4. Shop grid is 1-column below 640px (~1.3 products per screen)** — shop-explorer.tsx:411-415 + product-card.tsx. Problem: `aspect-[4/5]` + meta ≈ 560px per card against a 4,373-piece catalog. Fix: `grid-cols-2 gap-3` compact tier below `sm` (uniform hairline cards preserved — extends, not fights, the Catalogue register). Priority: P2.

### Accessibility

**M-A11y1. Mega-menu ARIA contract violation** — dynamic-header.tsx:279-280, 398. Problem: trigger declares `aria-haspopup="menu"` but opens a `role="region"` grid of links; `aria-expanded` with no `aria-controls` (verified null in live DOM — see H9). Fix: disclosure pattern — drop the menu promise, add `aria-controls="shop-mega"`. Priority: P2 (fix with H9).

**M-A11y2. `text-foreground/45` micro-copy fails AA on dark surfaces** — product-card.tsx:192, shop-explorer.tsx:298, blog/page.tsx:281, blog/[slug]/page.tsx:423. Problem: ~4.09:1 on card `#0f2440`, ~4.33:1 on canvas `#061224` at 12px (<4.5:1). Fix: floor muted ink at /55–/60 or a `text-muted` utility mapped to `--muted-foreground`. Priority: P2.

**M-A11y3. `--sapphire-ink` (#3b82f6) is 4.24:1 on the card panel** — globals.css:114 + product-card.tsx:175,196. Problem: AA-tuned against the canvas (5.10:1) but sub-AA for the category label and "Customize" line on every card. Fix: card-scoped token (`--sapphire-ink-card` ≈ #5b9dff, ~6.4:1), token-driven per design.md. Priority: P2.

**M-A11y4. Auto-playing motion has no in-page pause (WCAG 2.2.2, Level A)** — ambient-video.tsx, velocity-marquee.tsx (/, /process, /custom-order, /404). Problem: infinite muted loops + marquee start automatically; the working prefers-reduced-motion collapse doesn't satisfy 2.2.2's in-page mechanism requirement. Fix: persistent pause/play control driving a shared "motion paused" state, persisted in localStorage. Priority: P2.

**M-A11y5. Home "Featured pieces" heading order is h1 → h3×6 → h2** — page.tsx:385-469. Problem: the bottom-aligned h2 follows all its content in DOM; `aria-labelledby` points at a trailing heading. Fix: emit h2 first, keep visual bottom alignment via CSS order — or sr-only h2 + `aria-hidden` visible row. Priority: P2 (pairs with M-S6).

### Performance

**M-P1. Two full animation runtimes in the critical path** — scroll-reveal/preloader/template.tsx (motion/react, ~44KB gz) + GSAP (H12). Problem: / = 1.11MB raw / 362KB gz over 23 chunks; the two runtimes ≈ 28% of homepage JS. Fix: consolidate on one (GSAP covers the design.md motion vocabulary) or keep motion + lazy GSAP per H12. Priority: P2.

**M-P2. `db.product.count` runs on every infinite-scroll batch and is discarded** — shop.ts:257-266, shop-explorer.tsx:171-196, actions/shop.ts:37-57. Problem: loadMore() consumes only items+nextCursor; with a text filter the count is a full ILIKE scan per 12-item page. Fix: skip count when `cursor` present (one-line). Priority: P2.

**M-P3. /search: up to 7 queries with unanchored ILIKE scans, no text index** — search/page.tsx:89-183; schema.prisma (no GIN/tsvector). Problem: 155–195ms/request locally vs 6–9ms ISR home; combined-OR count repeats the most expensive scan. Fix: pg_trgm GIN on title/shortTagline (or tsvector column); drop the standalone count; loading.tsx per H11. Priority: P2.

**M-P4. Layout chrome data uncached across requests** — catalog-nav.ts:14-46, site-settings.ts, layout.tsx:145-148. Problem: per-category `_count` over 4,373 rows + settings re-read on every no-store request site-wide. Fix: `unstable_cache`/'use cache' ~300s with tags invalidated from studio actions. Priority: P2.

**M-P5. Base /shop entry pays 4 uncached queries per hit** — shop/page.tsx:85-96, shop.ts:243-277. Problem: card fetch + full count + category list + `groupBy(categoryId)` over all published products, 55–107ms, every hit, per-visitor-identical. Fix: cache the unfiltered first page/chips per locale+sort (300s, tag-invalidated); filtered requests keep hitting the DB. Priority: P2.

**M-P6. ISR TTL mis-sized for a 39k-URL long tail** — product page.tsx:63; actions/*. Problem: even after C2, revalidate=300 with no generateStaticParams gives a near-zero hit ratio on long-tail PDPs (crawler visits < 1 per 5 min). Fix: revalidate=86400 + on-demand `revalidatePath` on product save (pattern already established in actions). Priority: P2 (sequence after C2).

---

## Low

**L-S1. "Customize →" is the universal card CTA for all 4,373 products** — product-card.tsx:197 + `Shop.card.customize`. Wrong verb on ~2,000 supplies/print SKUs dilutes it where true. Fix: group-aware CTA keys ("View details"/"Order"). P3.

**L-S2. "STUDIO ORIGINAL" badge saturates the default catalogue view** — product-card.tsx:77,136-148. 12/12 badged on first paint (featured sort is tier-1-only); zero on supplies. A differentiator on everything differentiates nothing. Fix: suppress in single-tier result sets. P3.

**L-S3. Scraped third-party copy verbatim on PDPs** — product page.tsx "About this piece". Competitor branding ("At Kanha Kreation, we transform…"), emoji, and mashed fields ("3-5 days to ship Pack of 10") in the premium reading sheet; `needsRewrite` flag exists. Fix: sweep for foreign brands/URLs → set needsRewrite; fall back to shortTagline + specs when flagged. P3.

**L-S4. Two product-card grammars (home mosaic vs catalogue)** — page.tsx:433-455 vs product-card.tsx:174-197. Price changes position/register between surfaces. Fix: one card anatomy with a "mosaic" variant (aspect/size only). P3.

**L-S5. Breadcrumb treatment inconsistent** — PDP uppercase tracked trail incl. full product title vs sentence-case elsewhere vs none on /search /faq /about. Fix: standardise on the catalogue component; truncate PDP current segment (~40 chars); add to /search. P3.

**L-S6. Blog index: ~150-item hashtag cloud (~500px) before the first article** — /blog. Fix: category row + top ~12 tags with "All tags" disclosure, or move below the grid. P3.

**L-AD1. Bulk selection capped at the visible page** — product-list.tsx + use-selection.ts + actions/products.ts. Cleaning 3,571 demoted drafts = 72+ passes. Fix: "Select all N matching" (Gmail pattern) executing against the where-filter. P3.

**L-AD2. Bulk Import wizard incompatible with the real catalog sheet** — import/templates.ts + import-wizard.tsx. Template lacks tier/in_stock; wizard output lands tier-NULL (second-class in /shop ordering). Fix: add columns or a "Tier sheet" content type reusing import-tiers parsing. P3.

**L-AD3. Dashboard lacks catalog composition** — studio page.tsx. No per-tier counts, no OOS count (569 published), stat-card label truncates. Fix: tier-breakdown card ([tier,status] index exists), OOS stat linking to a filtered list, fix truncation. P3. *(Note: partially addressed by the 8ae1685 tier count strip — re-scope against HEAD before building.)*

**L-AD4. 768px products table clips row actions with no scroll affordance** — product-list.tsx overflow wrapper. Fix: scroll shadow/fade + row-level tap target below 1024px. P3.

**L-M1. Announcement bar truncates its message at 375px** — announcement-bar.tsx:41-44. The truncated tail ("finalized personally on WhatsApp") is the part that matters. Fix: shorter mobile string or two-line wrap below `sm`. P3.

**L-M2. Locale switcher is 38px tall in fixed mobile chrome** — locale-switcher.tsx:51. Fix: `min-h-11` or the header's inset hit-extension. P3.

**L-M3. Wishlist/quick-view effective hit boxes touch with 0px separation** — product-card.tsx:209, wishlist-button.tsx:41, quick-view.tsx:71. Opposite-intent adjacent actions. Fix: `gap-3` or reduce extension to `-inset-0.5` on the stacked pair. P3.

**L-A11y1. Lightbox image changes are silent to SR** — gallery.tsx:234-237,252-274. Fix: `role="status"` aria-live counter including image alt ("Image 2 of 6: …"). P3.

**L-A11y2. Newsletter input's only focus indicator is a 1px hairline color shift** — newsletter-form.tsx:85-108 (`outline-none`). Fix: 2px underline + ring color, or keep the global outline. P3.

**L-A11y3. /search result counts are `aria-hidden` with no accessible equivalent** — search/page.tsx:193. Fix: count in the accessible heading or sr-only span. P3.

**L-A11y4. Directional icons don't mirror under RTL** — product-card.tsx:198, gallery.tsx:256-274, blog pagination. Fix: `rtl:-scale-x-100` on direction-semantic icons. P3.

**L-P1. KineticHeading hides then replays the already-read hero H1** — kinetic-heading.tsx:68 (autoAlpha 0), 156-167. Fix: bail out of splitting when the heading has been visible >~1s or fonts aren't synchronously loaded. P3 (fold into H12's refactor).

**L-P2. Stale design.md 3D docs + dead @google/model-viewer weight** — design.md (ResinForm section); model-viewer.tsx:40-55; home-hero.tsx:13-19. Homepage verified three-free; 0 of 4,373 products have model3dUrl, so ~1.6MB of lazy chunks can never trigger. Fix: record the ResinForm retirement in design.md; drop the dep until 3D SKUs exist (keep the lazy pattern). P3.

---

## Appendix — Investigated and refuted

All three refutations trace to the same root: the audit's "live verification" ran against the **stale 10:58 build still served on `:3000`**, which predates commit `8ae1685` (12:54, "Admin Phases 9-13"). The v7 admin phases had already shipped the claimed fixes. Ops action: rebuild + restart (bundled into C4).

1. **"/studio/products has no server-side pagination" (was High)** — REFUTED. HEAD already implements the finding's own fix: `count` → page clamp → `skip/take` (PAGE_SIZE=50) driven by `?page=` alongside q/status/category, with a row-scoped select (page.tsx:60-92); product-list.tsx paginates via the URL, no `usePagination`. The 3.53MB/7,944-row payload reproduces only on the stale build (old row shape proves it). **However**, verification found the current page crashes outright — carried forward as confirmed finding **C4**.
2. **"Tier and stock invisible/uneditable in the admin" (was High)** — REFUTED. `8ae1685` shipped Tier + Stock columns and filters in product-list.tsx (:218-247), `inStock`/`tier` in the form schema (:111-112), the Tier select + In-stock toggle in pricing-specs (:102-139), persisted via actions/products.ts (:49-50, :139-140). Verified in a live authenticated editor session (Tier 4 select + unchecked In-stock on a real OOS product). Also: zero NULL-tier products currently exist (385/1,988/4,592/979 across tiers 1–4), so the "studio products sort last" impact is presently hypothetical. The 569 published-OOS figure is real — actionable via the shipped editor once C4 lands.
3. **"The sheet pipeline has no admin surface" (was High)** — REFUTED on every load-bearing claim. import-tiers.ts writes a `sheet-import` ActivityLog row with per-tier detected/selected/created/updated/unchanged/failed/demoted counts (:687-700; two real rows in the DB, 13:46 today). `/studio/sheet-import` exists and renders (verified authenticated, HTTP 200): last-run card, per-tier table with caps (all/1,000/2,500/500), detected rows (373/34,930/21,508/7,685), published/draft/missing-image columns, demotion stats, pipeline explainer, sheet link. The dashboard banner the finding quoted does not exist — the real banner names the Sheet Import and links to it. Residual wishlist (caps/FEATURED_TIER1 not SiteSettings-editable; no dry-run diff; no expandable per-row failed/demoted lists) is a P3 enhancement note at most.

---

## Backlog disposition (2026-08-14 pass)

All 4 Criticals and 12 Highs were fixed in the v7 program. Two backlog
passes then landed: **26 of 27 Mediums and 18 of 19 Lows fixed** (band
audit, tsc, eslint, full build re-verified after each integration).

**Fixed — Mediums:** M-S1 (curated mega-menu order, count as tiebreaker),
M-S2, M-S3 (featured row suppressed <16 pieces; grid first page excludes
featured ids, cursor math corrected), M-S5, M-S6 (a11y half: heads first in
DOM via flex order; the visual bottom-alignment is ruled a deliberate v4
signature — see design.md), M-A1, M-A2 (n4 normalizer + one-time cleanup of
3,573 stale stamps), M-A3, M-A4 (bulk change-category; the source→canonical
mapping report is still open), M-A6 (fail-closed guard + AUTH_TRUST_HOST
boot check), M-M1–M-M4, M-A11y1–M-A11y5, M-P2–M-P6 (trgm indexes: search OR
count 6.0ms → 0.9ms; chrome + /shop first page cached 300s with tag
invalidation wired through category/settings/product actions; PDP
revalidate 86400 + on-demand revalidation on save).

**Fixed — Lows:** L-S1 (group-aware CTA via categorySlug, tier fallback
verified 1:1 on all 4,373 rows), L-S2, L-S5 *partial* (current-segment
truncation at 40 chars in the shared component; shop/[category] and blog
converted — hand-rolled trails remain on /shop, /shop/wishlist, /portfolio,
/portfolio/[slug]; /search still has none), L-S6, L-AD1–L-AD4, L-M1–L-M3,
L-A11y1–L-A11y4.

**Second pass (same day) closed most of the deferrals:**
- **M-P1 / L-P1 — FIXED.** `motion` removed entirely; GSAP (lazy, H12
  pattern) is the sole runtime. Every public route's first load dropped
  **−45.9KB gz (−14.6%)**; header/mega-menu a11y behavior preserved;
  KineticHeading no longer hides-and-replays an already-read heading.
- **L-S3 — FIXED** (mechanism): the importer flags source-store
  branding/URLs/emoji copy as `needsRewrite` (563/4,373 rows,
  deterministic, reaches production via the deploy import); the PDP falls
  back to tagline + specs for flagged rows. The editorial rewrite itself
  remains owner-voiced work, surfaced by the flag.
- **M-S4 — half fixed:** trailing comma/space title artifacts trimmed (n5
  normalizer, 0 published stragglers). The variant-merge half still needs
  an owner call on merge vs disambiguate for the 34 same-title groups.
- **L-S5 — FIXED:** every hand-rolled trail (/shop, /shop/wishlist,
  /portfolio, /portfolio/[slug]) now uses the shared component; /search
  gained its missing trail.

**Third pass (owner items, executed on delegation) closed the rest:**
- **C3 (full) + M-A5 — DONE.** Batched mirroring pipeline: nightly Vercel
  cron + studio "Mirror next batch" button copy the ~9.4k external images
  on published products to owned storage under deterministic
  `catalog/<sha1(sourceUrl)>` pathnames (Shopify sources pre-sized at
  1600px; failures leave rows untouched; runs resume automatically and log
  to ActivityLog). Mirrored files deliberately render unoptimized so they
  can't burn the image-optimization quota. The import center's new
  "External imagery" card shows backlog/mirrored/host breakdown (M-A5).
  Sheet updates preserve mirrored URLs (importer recognizes the
  deterministic pathname offline). The mirror itself drains nightly in
  production — no further action needed.
- **M-S4 (display resolution) — DONE.** Duplicate titles collapse per page
  with an "N options" chip; the PDP shows a "More versions of this piece"
  rail so every duplicate stays reachable; same-title siblings excluded
  from the other rails. Cursor semantics verified against an uncollapsed
  control (21/21). Chosen over row-merging: no data destruction, no URL
  changes, reversible.
- **L-S3 (editorial) — DONE.** 560 of the 563 flagged descriptions
  rewritten as fact-preserving transforms (facts only from each row's own
  source; store branding/URLs/emoji/logistics stripped; safety caveats
  kept; self-audited per batch with corrections). Shipped as
  `data/rewrites/*.json`, applied by the importer with per-row hash
  salting — local proof run: exactly 560 updated / 3,813 unchanged,
  idempotent on re-run; flagged count 563 → 3 (those three had nothing
  factual beyond the title and keep the tagline+specs fallback).

**Remaining by design:**
- **L-S4** (two card grammars) — the home mosaic is bespoke editorial
  markup, not ProductCard; unifying is a design decision, not a defect.
- **L-P2** — resolved in spirit: decorative-3D retirement documented;
  `@google/model-viewer` (+`three`) stays because product-3D management is
  a mandated admin feature awaiting model3dUrl data.

---

## Fix plan

Confirmed Critical/High only, in implementation order. Refuted items require no work beyond the Batch 0 redeploy (v7 Admin Phases 9-13 already absorbed them).

### Batch 0 — Hotfix + ops (same day)
1. **C4** `PAGE_SIZE` client-import crash: local const in products/page.tsx; **rebuild + restart the stale `:3000` build** (also clears the login-loop symptom; do M-A6's fail-closed middleware here if self-hosting is in scope).
2. **H8** Sticky-bar i18n: one-line `t('card.customize')`.
3. **H4** Currency data pass: flag/convert USD tier-4 rows (`showPrice=false` → "Enquire"), unpublish foreign gift cards; importer stops trusting the sheet `currency` column for foreign sourceKeys.

### Batch A — Storefront ecosystems & catalog (v7 storefront phases absorb H1/H2/H3; C1 is new scope)
4. **H1** Gate PDP commission copy/uploader/pillars/FAQs on `groupForCategorySlug` — direct enforcement of the v6 ecosystem rule; the v7 ecosystem-PDP phase should absorb this wholesale.
5. **H2** `inStock` → order panel + CTA reframe + `submitProductOrder` guard + related-query ordering (same PDP phase).
6. **H3** take=24–48, explicit Load-more, cursor in URL — this *implements* the already-locked v6 "state lives in the URL" rule (catalogue phase).
7. **C1** Header CTA tablet gating (`hidden xl:inline-flex` + link-visibility tightening) — small, standalone, ship early.

### Batch B — Admin & pipeline integrity (extends v7 Admin Phases 9-13)
8. **H5** `deletedImportRefs` tombstone + `ownerTouched` field-merge in import-tiers.ts — completes the provenance story Phase 9-13 started with the editor banner.
9. **H6** Scraper page: live-products join + sheet-pipeline banner + **importSource key normalization** (bare key vs `sheet:` prefix) before any scraper approval path is used in anger.

### Batch C — A11y & performance (cross-cutting; no v7 phase currently owns these — schedule as its own phase)
10. **C2** Restore ISR: draftMode() on PDP, Suspense/static page-1 on blog/portfolio; verify headers. Then **M-P6** (TTL 86400 + on-demand revalidate) as follow-through.
11. **C3** Image mirroring to Vercel Blob (tier-1/2 published first) — prefer mirroring over allowlisting per the documented quota decision; `?width=` stopgap meanwhile.
12. **H11** loading.tsx skeletons for the seven public routes (multiplies the perceived win of C2).
13. **H12** Lazy-load GSAP in KineticHeading + convert home's other static GSAP importers (fold in L-P1's replay guard).
14. **H9** Mega-menu focusout/relatedTarget close logic (fold in M-A11y1's aria-controls) — keyboard parity.
15. **H10** Extract the conversion surface into messages/*.json for all 9 locales (`lang="en"` stopgap immediately; translation pass follows).

**Sequencing note:** Batch 0 is prerequisite to all admin work (the products table is down at HEAD). C2 and H11 ship together for compounding effect; C3 is the largest single real-user win and can proceed in parallel as a data/infra job.
