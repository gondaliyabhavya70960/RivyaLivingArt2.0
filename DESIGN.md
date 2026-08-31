# ResinRiva 2.0 — Master Design & Build Document
### Claude Code Edition · v2.0 · "Liquid Light × Midnight Gild"
**How to use this document:** Save this file as `DESIGN.md` in the root of the ResinRiva2.0 repo. Your `CLAUDE.md` (Part E, ready to paste) points Claude Code at it, so every session starts with the full design system, page blueprints, and motion rules in reach. Build phase-by-phase using the prompt playbook in Part E.6.
**North stars:** Apple Store (structure, product-as-hero scroll choreography, whitespace discipline) × Unsaid.com (emotional luxury storytelling, memory-driven copy, dark-canvas drama) × current Awwwards winners (GSAP + Lenis + ScrollTrigger motion craft). Applied to handmade resin art, where the material itself — translucency, light refraction, embedded flowers, gold flake — becomes the visual language.
---
# PART 0 — BUSINESS MODEL: HARD RULES (VERBATIM — NEVER VIOLATE, NEVER EDIT)
> This section is fixed by the owner, word for word. Every other part of this document, and everything Claude Code builds, must conform to it. If any later section appears to conflict with Part 0, **Part 0 wins.**
Business Model — Hard Rules (never violate)
* NO payment gateway, online checkout, or cart payment (no Stripe / Razorpay / PayPal)
* NO customer login, membership, or customer accounts — the only login is the staff-only studio (admin/editor roles) at `/studio`
* NO AI-invented products, ever. The catalog is filled ONLY by the owner via: (a) Product Scraper review + approval, (b) Bulk Import (Google Sheets/CSV), (c) manual adds in `/studio`
* Every order is finalized through WhatsApp
Customer Journey
1. Customer visits the website and views products
2. Customer customizes a product using its per-product customization form
3. Customer submits requirements (name, phone, optional email, selections, reference images, notes)
4. Customer clicks Place Order → the site generates an order summary AND saves it to the database (Inquiry record) via a Server Action
5. Redirect to WhatsApp with the complete order message pre-filled (`wa.me/917096036250`)
6. Price, payment, and delivery are handled manually in WhatsApp
---
# PART A — BRAND & DESIGN SYSTEM
## A1. Art direction — "Liquid Light × Midnight Gild"
Resin's magic is what light does *inside* it. Every decision exploits translucency, refraction, caustics, embedded botanicals and metallic flake. The palette is deep-water blue with restrained gold — which is not just a brand choice: ocean-wave resin and gold-leaf geode pieces are the most iconic resin aesthetics, so the palette and the product literally match. Tone blends Apple's disciplined whitespace with Unsaid's emotional, memory-first copy ("Hold the moment. Forever."). One signature element carries the boldness: the scroll-driven **pour → cure** hero sequence. Everything around it stays quiet and precise.
## A2. Color system (FINAL — blue primary, dark, gold accents)
### Primary — blue family
| Token | Hex | Use |
|---|---|---|
| `blue-ice` | `#EAF1FB` | Tinted section backgrounds, chips, selected rows |
| `blue-powder` | `#C7D9F3` | Borders on blue surfaces, disabled-primary tint |
| `blue-steel` | `#7FA1DB` | Secondary illustration tone, hover on dark |
| `blue-royal` **(PRIMARY)** | `#1E4FD8` | CTAs, links, active nav, focus (light), admin primary, main chart series |
| `blue-sapphire` | `#142F86` | Hover/pressed states of primary |
| `navy-midnight` | `#0A1A2F` | Dark storytelling bands, footer, Studio dark mode |
### Dark & neutrals
| Token | Hex | Use |
|---|---|---|
| `ink` | `#0B1220` | Body text on light |
| `slate` | `#55627A` | Secondary text |
| `mist` | `#D7DCE4` | Hairline borders, dividers |
| `canvas` | `#FAF9F5` | Page background (warm ivory bridges the gold) |
| `card` | `#FFFFFF` | Cards, product tiles |
### Gold accents — the garnish (~5–8% of any screen, never more)
| Token | Hex | Use |
|---|---|---|
| `gold-champagne` | `#F0E3BC` | Soft gold tint, badge fills on light |
| `gold` | `#D4AF37` | Icons/rules/headline flourishes **on navy only**, star ratings, preloader shimmer |
| `gold-antique` | `#B8912C` | Mid gold for gradients, borders on champagne fills |
| `gold-bronze` | `#8C6A1D` | The ONLY gold allowed as text/small icons on light backgrounds (AA-safe) |
### Semantic (shared storefront + admin)
Success `#2F8F5B` · Warning `#D97706` (shifted orange so it never reads as brand gold) · Danger `#D64545` · Info `#0E9BD8`
### Gradients (only where specified)
- **Depth** (hero, dark bands): `#0A1A2F → #1E4FD8`
- **Gold shimmer** (preloader fill, loading bars, hover underlines): `#8C6A1D → #D4AF37 → #F0E3BC`
### Usage rules
1. **60-30-10:** ~60% ivory/white, ~30% blues (navy bands + royal CTAs), ~5–8% gold. Product photography carries the rest of the color.
2. **One interactive color.** Royal blue is the only color that means "clickable." Gold never labels an action.
3. **Gold contrast law:** `#D4AF37` on white ≈ 2:1 → FAILS. Gold text/small icons on light surfaces must use bronze `#8C6A1D` (≈ 5.0:1, AA). True gold lives on midnight navy (≈ 8.3:1) — the Unsaid-style dark-luxury pairing. White on navy ≈ 17.5:1; royal blue ↔ white ≈ 6.5:1 both directions (AA for all text).
4. **Focus rings:** 2px `#1E4FD8` on light surfaces, 2px `#D4AF37` on navy surfaces, always with 2px offset.
5. Badges: Bestseller = champagne fill + deep-bronze text `#7A5C19` (light — plain bronze `#8C6A1D` is only 3.9:1 on champagne; deep bronze measures 4.87:1) / gold outline (navy). New = blue-ice fill + royal text. Star ratings = gold `#D4AF37`.
6. Section rhythm the Apple way: alternate canvas-ivory ↔ white ↔ midnight-navy full-bleed bands. Color change IS the section divider — no border lines between sections.
## A3. Typography
- **Display / editorial:** **Fraunces** (Google Fonts, free; optical sizing on, use the soft high-contrast display cuts). Paid upgrade path later: Canela or Freight Display. Used for hero headlines, collection titles, pull quotes, PDP product names.
- **UI / body:** **Inter** (free). `letter-spacing: -0.01em` on display sizes, `font-feature-settings: "ss03"` — the SF Pro feel without the license problem (SF Pro is Apple-platform-only).
- **Accent mono:** **IBM Plex Mono** (free) for SKU, price microcopy, "lab-note" captions.
- **Weights (few, Apple discipline):** Inter 400 / 500 / 600. Fraunces 300–400 for large display, 500 for subheads. Never stack four weights on one screen.
- **Scale (1.25 major third, 16px base):** 12 / 14 / 16 / 20 / 25 / 31 / 39 / 49 / 61 / 76 px. Hero display may break scale to 96–120px desktop.
- Text colors: `ink` on light, `#F5F2EC`-white on navy; secondary = `slate`; gold headline flourishes on navy only.
## A4. Iconography & imagery
- **Icons:** Lucide (free), 1.5px stroke, rounded joins, stroke weight matched to type weight. Small custom brand set: resin drop, mold, pressed flower — drawn in the same 1.5px language.
- **Photography:** (a) macro backlit material shots showing translucency and suspended gold flake; (b) editorial lifestyle — product held in hands, warm homes, the "memory" angle; (c) process/craft — the pour, the artisan. Moody, cooler lighting; **navy backdrops**; hero imagery leans into ocean-wave and gold-leaf geode pieces. One signature drop-shadow reserved for floating product renders — never on UI.
- **AI-generated images & video — Higgsfield (https://higgsfield.ai):** whenever the website needs an image or video, generate it with Higgsfield. It covers all brand/ambient media: the hero pour→cure video loop, pinned-showcase frame sequences, collection banners, navy storytelling-band visuals, lifestyle scenes, journal art, empty states. Full pipeline, prompt style guide, and delivery specs live in **E4.1**. One hard exception: the actual PDP listing photos of a specific physical item a customer is buying must be real photographs — AI media dresses the brand, never misrepresents the product.
## A5. Design tokens — spacing, grid, radii, shadows, motion
- **Spacing (8pt base, 4pt subdivisions):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128. Storefront section padding 80–128px desktop; card padding 24px; admin density 12–16px.
- **Grid:** 12-col, max 1280–1440px, gutters 20–24px; storefront allows full-bleed breakout bands (Apple edge-to-edge). Admin: fluid 12-col inside content area.
- **Breakpoints:** 360 / 640 / 768 / 1024 / 1280 / 1536. Mobile-first; test hard at 360–414 (India-heavy traffic).
- **Radii:** 6px inputs/chips · 12px cards/buttons · 20px modals/feature tiles · full for pills/avatars. Storefront slightly softer, admin slightly tighter.
- **Shadows:** storefront = elevation via surface color, not boxes (single product shadow only). Admin 3 tiers: e1 `0 1px 2px rgba(10,26,47,.06)` · e2 `0 4px 12px rgba(10,26,47,.08)` · e3 `0 12px 32px rgba(10,26,47,.12)`.
- **Motion tokens:** micro 150–250ms · entrances 400–800ms · scrub tied to scroll distance. Entrance ease `cubic-bezier(0.22,1,0.36,1)` (expo-out); hovers `power2.out`; UI micro-interactions ride CSS transitions/GSAP on these same tokens — Framer springs not adopted (audit/FINDINGS.md Phase 1 decisions: "Motion for React: NOT adopted"). ONE motion vocabulary site-wide.
- **Dark/light:** semantic CSS variables so the storefront (light default + navy bands) and the Studio (full dark mode) all derive from one token file (Appendix A).
- **Accessibility floor:** WCAG AA — 4.5:1 body, 3:1 large/UI; visible focus rings per A2; never color-only status; 44px min tap targets; keyboard-navigable menus/drawers/tables; `prefers-reduced-motion` honored globally.
---
# PART B — CUSTOMER WEBSITE STRUCTURE
## B1. Sitemap / information architecture
Home · Shop (all products; filters: category — coasters, trays, clocks, keychains, jewelry, wall art, memory/varmala preservation — color, price, occasion) · Collections landings (editorial — shipped as `/shop/[category]` category landings) · Product Detail Page **with per-product customization form → Place Order → WhatsApp** (the entire conversion path; no cart, no checkout — Part 0) · **Customize / Memory Preservation** (bespoke flow: upload photo/flowers → choose mold → submit requirements → same Inquiry + WhatsApp pipeline — the brand's biggest differentiator) · Our Story / Craft · Process · Portfolio (+ case slugs) · Workshops · Journal (phase 2, SEO + care guides) · Contact · Policies (shipped as discrete `/privacy` and `/terms` routes; shipping/returns + care ride content pages) · FAQ (its own page) · Search · Wishlist (`/shop/wishlist` — device-local `localStorage`, see below) · `/whatsapp-order` (claim-token order fallback, ENG-811) · 404 · `/studio` + `/studio/login` (staff-only panel — the ONLY login on the entire site, Part C).
**Explicitly absent, by Hard Rules:** cart, checkout, payment pages, customer login/signup, customer accounts, order-tracking dashboards, account-backed wishlists (the shipped `/shop/wishlist` is device-local `localStorage` only — never tied to an account).
**Global nav:** transparent-over-hero sticky header, backdrop-blur on scroll (Apple); mega-menu with imagery on Shop/Collections (Unsaid); a persistent "Order on WhatsApp" pill instead of a cart icon; announcement bar rotating three messages (made-to-order · order on WhatsApp · memory preservation).
## B2. Page blueprints (section by section)
**Homepage** — (1) Hero: full-bleed scroll-scrubbed pour→cure sequence on depth gradient, Fraunces headline "Memories, cast in light", royal-blue CTA; (2) Featured-collection horizontal rail/marquee; (3) **Apple-style pinned showcase**: signature piece rotates through a pinned canvas sequence while copy blocks fade in beside it; (4) "The ResinRiva Difference" 3-up (handmade, non-toxic UV resin, memory preservation); (5) **Midnight-navy storytelling band** (Unsaid "360°" analog) — varmala/flower-preservation narrative, gold headline flourish; (6) Best-sellers grid; (7) Testimonials + UGC photos, gold stars; (8) Instagram/UGC gallery; (9) Newsletter; (10) Rich footer on navy.
**Shop/PLP** — sticky filter sidebar (desktop) / drawer (mobile), sort, responsive 2/3/4-col product grid, hover second-image swap, per-card Customize / WhatsApp CTA + device-local wishlist save (no quick-add — there is no cart to add to, Part 0), active-filter chips, result count, pagination or lazy infinite scroll.
**PDP** — sticky gallery left (zoom on hover, thumbnail rail, optional 360/3D — shipped as a `<model-viewer>` GLB viewer, `src/components/product/model-viewer.tsx`) + order-box right (Fraunces title, base/"from" price set by the owner — final price is quoted in WhatsApp, "made-to-order in X days" champagne badge, then the **per-product customization form**, driven by the product's `customizationSchema` defined in `/studio`: size/shape/color pickers, personalization text, occasion, quantity). Below: expandable specs (dimensions, materials, care), "how it's made" strip, "you may also like" cross-sell, reviews with photos. Sticky mobile **Place Order** bar.
**Customize & Order flow (replaces cart + checkout — implements Part 0 journey steps 2–5):** (1) customization selections; (2) contact fields — name, phone required, email optional; (3) reference-image upload (spec'd Cloudinary — production uses @vercel/blob, `src/lib/storage.ts`; Cloudinary remains an optional future migration); (4) notes textarea; (5) live order-summary preview that mirrors the exact WhatsApp message; (6) royal-blue **Place Order** → Server Action validates (Zod), saves the **Inquiry record**, builds the summary, then redirects to `https://wa.me/917096036250?text=<URL-encoded summary>`; (7) fallback state if WhatsApp can't open: show the number + copyable message. WhatsApp brand green may appear ONLY on this final button/icon — the one semantic exception to A2's one-interactive-color rule.
**Collections landing** — editorial hero, intro copy, curated grid, lookbook. Each collection treated as its own "alcove" (Cartier W&W pattern).
**Our Story / Craft** — long-form scroll narrative with pinned imagery, process timeline (pour → embed → cure → finish), founder note, materials/sustainability.
**Memory Preservation (custom orders)** — emotional hero on navy, how-it-works 4-step, upload form (photos/flowers), mold picker, requirements form → the **same Inquiry + WhatsApp pipeline** (type = memory preservation), FAQ, gallery of past commissions.
**Studio login (`/studio/login`)** — the only login on the site (Part 0): centered card on canvas ivory, email + password, staff roles admin/editor.
**Policies/FAQ** — two-column doc layout with anchored side nav.
## B3. Component library (storefront)
Navbar (transparent/solid states) · Mega-menu · Announcement bar · "Order on WhatsApp" pill · Button (primary royal-blue filled, secondary outline ink, ghost, icon; WhatsApp-green only on the final Place Order/WhatsApp action) · Product card (image, hover-swap, title, from-price, "Customize" link, badge) · Badge (New/Bestseller/Made-to-order/Limited per A2 rules) · Filter chip · **Customization form controls** (option pickers, personalization text, occasion select, quantity stepper) · **Reference-image uploader** · **Order-summary preview card** (mirrors the WhatsApp message) · Modal/Dialog · Toast · Form fields (text, tel, email, select, textarea, validation states) · Accordion · Tabs · Rating stars (gold) · Testimonial card · Marquee · Breadcrumb · Pagination · Skeletons · Newsletter form · Footer (navy, with WhatsApp contact).
## B4. Animation & interaction spec
**Library mapping (what Awwwards winners actually ship, all free):**
- **Lenis** — global smooth scroll, synced to GSAP ticker (Cartier W&W stack).
- **GSAP + ScrollTrigger** — pinned showcases, scrubbed image sequences, parallax, reveals. GSAP is 100% free incl. all former Club plugins since v3.13 (April 2025).
- **GSAP SplitText** — staggered line/word reveals for Fraunces headlines.
- **CSS entrances (tw-animate-css) + next-view-transitions** — micro-interactions, page transitions (`template.tsx` → `page-transition.tsx`, CSS on `--ease-out`), shop-card → PDP morph. Framer Motion was NOT adopted (single-motion-system law — audit/FINDINGS.md Phase 1 decisions); do not add it.
- **Lottie / Rive** — vector loops: pour animation, loader, empty states. **Not adopted** — all of these ship via GSAP/canvas sequences instead (preloader, 121-frame pour→cure scrub); do not add a third animation runtime.
- **Three.js / R3F (phase 3, optional)** — one hero resin piece with transmission/refraction material; always with video/image fallback (Igloo/Cartier pattern).
**Per section:**
- *Preloader:* logo mask with gold-shimmer "resin fill" progress; ≤1.2s; static logo under reduced motion.
- *Hero:* SplitText line reveal + parallax, or scroll-scrubbed sequence (`pin: true, scrub: 0.5, end: "+=3000"`); static first frame on mobile/slow devices.
- *Pinned showcase:* visual pinned, copy blocks activate on scroll (Apple feature-walkthrough).
- *Reveals:* fade-up + slight scale, staggered, `power2.out`, 0.6–0.8s.
- *Parallax:* multi-layer yPercent scrub (Osmo pattern).
- *Product cards:* hover image swap + lift (−6px) + soft shadow; magnetic "Customize" CTAs (`power2.out` in, `elastic.out(1,0.3)` back).
- *Editorial/gallery tiles* (UGC band, lookbooks — image-first, non-commerce): hover image zoom (scale 1.05) + navy-midnight/30 wash, micro tokens. This is THE single grammar for editorial tiles — product cards keep the lift grammar above; never mix the two on one surface.
- *PDP:* hover magnifier / lightbox zoom; 360/3D via `<model-viewer>` GLB (`src/components/product/model-viewer.tsx`), not an image sequence.
- *Cursor:* subtle dot + "view/drag" label on galleries, desktop only, optional.
- *Page transitions:* CSS fade+rise on `--ease-out` (`template.tsx` → `page-transition.tsx`) plus the next-view-transitions shop-card → PDP morph, ~0.5s — short, it's e-commerce. (Framer Motion not adopted — see library mapping above.)
- *Micro:* Place Order press feedback (scale 0.98) → success check → "Opening WhatsApp…" toast; form-field validation shakes kept subtle; option-picker selection pop.
**Performance & a11y law:** every scrub/pin has a static fallback; all non-essential motion behind `prefers-reduced-motion` (CSS + JS matchMedia); lazy-load sequences below fold; defer 3D until in-view; `next/image` everywhere; LCP < 2.5s or the effect gets downgraded. Never scroll-jack — Lenis smooths, never replaces, native scroll.
---
# PART C — THE STUDIO (staff-only panel at `/studio`)
**Philosophy: functional counterpoint.** Storefront is expressive; the Studio is calm, dense, fast. Same tokens, flatter surfaces, royal blue only for primary actions and chart accents, gold only for a single "top product" highlight. Base: shadcn/ui `dashboard-01` shell. Per Part 0: the Studio is the ONLY login on the site, with exactly two roles — **admin** (everything, incl. settings + staff) and **editor** (products, inquiries, content, reviews).
## C1. Sitemap / IA
Dashboard (KPIs: new inquiries today/this week, inquiry → confirmed conversion, top products by inquiries, pending scraper approvals; inquiries-over-time chart; recent inquiries) · **Inquiries — the heart of the panel** (status pipeline `NEW → CONTACTED → QUOTED → CONFIRMED → DELIVERED / CLOSED` — UIUX-610: `CLOSED` is the kept-for-history terminal for dead/declined leads, filtered from the active pipeline; DataTable with filters; detail view: customer name/phone/email, product, selections, reference images, notes, the exact generated WhatsApp message, one-click **Open in WhatsApp** (`wa.me` deep link), manual fields for quoted price / final price / delivery notes; bulk status update) · Products (DataTable + CRUD: multi-image upload via Cloudinary, materials, dimensions, SEO, lead time, badges, **per-product customization-form builder** that defines the PDP form's fields/options) with the three owner-only intake paths per Part 0: **(a) Product Scraper** — approval queue where scraped drafts land as PENDING, staff review images/title/description/price, then Approve → publish or Reject (nothing publishes without human approval); **(b) Bulk Import** — template-based Google Sheets/CSV upload (fixed downloadable templates → validation preview → import report; free column mapping and a dry-run toggle were not built — the review/preview step fills that role); **(c) Manual add** — full product form · Categories/Collections · Content/Banners (hero, announcement bar, featured collections, journal CMS) · Reviews moderation · Analytics (inquiries by period/category/product, conversion funnel, CSV export) · Settings (store profile, **WhatsApp number**, staff accounts + roles admin/editor, notifications).
**Explicitly absent, by Hard Rules:** payment/checkout settings, coupon engine, customer accounts, shipping-rate calculators — pricing, payment, and delivery live in WhatsApp.
## C2. Layout & components
Left collapsible sidebar (grouped items, active = royal-blue left border) · top bar (breadcrumb, ⌘K command palette, notifications, profile) · content cards. Routes: `/studio/*` shares the sidebar layout; `/studio/login` centered, no sidebar; middleware guards everything under `/studio` by staff session + role.
Components: DataTable (custom server-rendered tables — `src/components/studio/` sort-header/pagination primitives; TanStack Table NOT adopted, never "fix" the studio toward a client-table dependency — with **server-side pagination/filtering driven by URL searchParams** so views are bookmarkable) · KPI stat card (label, value, delta, sparkline) · Chart card · Forms (React Hook Form + Zod, inline validation) · Multi-image dropzone · **Customization-form builder** (defines PDP form schema) · **Scraper review card** (side-by-side source vs. mapped draft, Approve/Reject) · **Import wizard** (as shipped: content-type template → CSV/Sheets source → validate/preview → import report, plus the owner-tier Sheet Import / sheet-sync path; column mapping and dry-run were adapted away — add them only if the owner's real sheets stop fitting the templates) · Inquiry status pill · Filter bar · Date-range picker · Sheet/drawer quick-edit · Confirm dialog · Toast · Empty states · Skeletons · Tabs.
## C3. Data viz
shadcn Charts (Recharts): area = inquiries over time (royal-blue gradient fill on transparent) · bar = inquiries/category · donut = inquiry-status split · sparklines in KPI cards. Muted gridlines, one accent per chart, gold reserved for the single highlight series. Tremor if real-time dashboards are needed later.
**Studio UX patterns:** optimistic updates + toasts, bulk actions, ⌘K everywhere, saved filter views, role-gated menus (editor never sees Settings), audit trail on inquiries + scraper approvals, dark mode first-class.
---
# PART D — ARCHITECTURE
## D1. Stack
Next.js (App Router) + TypeScript on Vercel · Tailwind CSS + CSS-variable tokens · shadcn/ui (both surfaces) · Lenis + GSAP/ScrollTrigger/SplitText + tw-animate-css CSS entrances + next-view-transitions (Framer Motion and Lottie/Rive NOT adopted — single-motion-system law, audit/FINDINGS.md Phase 1 decisions; R3F phase 3) · Prisma + Postgres (Neon/Supabase) — or Mongoose + MongoDB if the existing repo is MERN · Auth.js (NextAuth) credentials, **staff-only for `/studio`** (admin/editor — zero customer auth, per Part 0) · **No payment SDKs — ordering is Server Action → Inquiry record → `wa.me/917096036250` deep link** · @vercel/blob in production (`src/lib/storage.ts` — product images + customer reference uploads; Cloudinary remains an optional future migration) · React Hook Form + Zod for customization forms · TanStack Query or Server Actions · scraper ingestion (HTTP platform adapters: Shopify/WooCommerce/JSON-LD, `src/lib/scraper/`) feeding the Studio approval queue · shared Zod schemas across storefront/studio/API.
## D2. Folder structure
> **Superseded by repo reality (original sketch kept below):** the shipped tree lives under `src/` — storefront routes in `src/app/[locale]/(v2)/…`, staff panel in `src/app/studio`, components in `src/components/{storefront,studio,motion,sections,shop,product,…}`, policies as discrete routes (`privacy/`, `terms/` — not `policies/[slug]`), route guard at `src/proxy.ts`. Do NOT restructure toward `app/(storefront)` (CLAUDE.md "Current repo reality").
>
> This spec was written for a monolingual site; the build is localized — 9 locales incl. RTL Arabic via next-intl (`src/i18n/`, as-needed locale prefix, per-locale canonical + hreflang). Every storefront route lives under `[locale]`, and new UI strings go through the message catalogs, never hardcoded English.
```
/app
  /(storefront)            # Lenis provider lives in this layout
    page.tsx               # home
    shop/  product/[slug]/  collections/[slug]/
    customize/             # memory preservation → Inquiry + WhatsApp
    our-story/  contact/  policies/[slug]/
  /studio                  # staff-only panel — the ONLY login (Part 0)
    login/
    page.tsx (dashboard)  inquiries/  products/(new|scraper|import)/
    categories/  content/  reviews/  analytics/  settings/
  /api/                    # or Server Actions in /lib/actions
/components
  /ui          # shadcn primitives
  /storefront  # ProductCard, Hero, PinnedShowcase, CustomizeForm,
               # OrderSummaryPreview, WhatsAppCTA, Marquee...
  /studio      # DataTable, KpiCard, InquiryPipeline, ScraperQueue,
               # ImportWizard, FormBuilder, InquiriesChart...
  /motion      # Reveal, SplitTextHeading, PageTransition, LenisProvider, useReducedMotion
/lib           # db, auth(staff), whatsapp.ts (message builder + wa.me URL),
               # cloudinary, utils, zod schemas, actions (placeOrder → Inquiry)
/styles        # tokens.css, globals.css
/public        # sequences/, lottie/, og/
/prisma        # schema.prisma, seed.ts (dev placeholders only — never production)
/hooks
```
## D3. Data models (Prisma sketch — adapt names to existing repo)
Product (title, slug, description, basePrice?, images[], categoryId, materials, dimensions, leadTimeDays, isActive, badges, source MANUAL|SCRAPED|IMPORTED, **customizationSchema JSON** — drives the PDP form) · Category/Collection · **Inquiry** (number, name, phone, email?, productId?, type PRODUCT|MEMORY_PRESERVATION, selections JSON, referenceImages[], notes, **whatsappMessage** (the exact generated text), status NEW|CONTACTED|QUOTED|CONFIRMED|DELIVERED|CLOSED (UIUX-610), quotedPrice?, finalPrice?, staffNotes, timestamps) · ScrapedProduct (sourceUrl, rawPayload, mappedDraft JSON, status PENDING|APPROVED|REJECTED, reviewedBy) · ImportBatch (fileName, rowCount, successCount, errors[], createdBy) · Review (rating, text, photos, approved) · Banner/ContentBlock · **StaffUser** (email, passwordHash, role ADMIN|EDITOR). No Order, no Cart, no Coupon, no customer User model — by Hard Rules.
---
# PART E — THE CLAUDE CODE WORKFLOW ⭐
Everything below assumes you build 100% with Claude Code. The system: **this file (`DESIGN.md`) is the spec, `CLAUDE.md` is the constitution, skills are your repeatable moves, subagents are your reviewers, hooks are your guarantees.** Docs: https://docs.claude.com/en/docs/claude-code/overview
## E1. One-time setup
```bash
# install (either)
npm install -g @anthropic-ai/claude-code
# or native installer:  curl -fsSL https://claude.ai/install.sh | bash
cd ResinRiva2.0
claude          # start
/init           # generates a starter CLAUDE.md from the repo — then replace with E2
```
Commit `CLAUDE.md`, `DESIGN.md`, `.claude/` and `.mcp.json` to git — they are team infrastructure.
## E2. CLAUDE.md — historical bootstrap template (superseded: the committed `CLAUDE.md` at the repo root is authoritative — never re-paste this block over it)
```markdown
# ResinRiva 2.0
Premium resin-art brand site. Design spec lives in DESIGN.md — read the relevant
section BEFORE building any UI, motion, or studio feature. Never invent colors,
spacing, or animation values; they are all defined in DESIGN.md Part A.
## HARD RULES — business model (verbatim in DESIGN.md Part 0; Part 0 wins all conflicts)
- NO payment gateway, online checkout, or cart payment (no Stripe/Razorpay/PayPal).
- NO customer login/membership/accounts. The ONLY login is the staff studio
  (admin/editor roles) at /studio.
- NO AI-invented products, ever. Catalog is filled ONLY by the owner via
  scraper review+approval, Bulk Import (Google Sheets/CSV), or manual /studio adds.
- Every order finalizes through WhatsApp: Place Order → generate order summary
  → save Inquiry record via Server Action → redirect to wa.me/917096036250
  with the complete pre-filled message.
## Commands
- dev: `npm run dev`
- typecheck: `npm run typecheck`   (tsc --noEmit)
- lint: `npm run lint -- --fix`
- test: `npm test`
- build: `npm run build`
## Stack
Next.js App Router + TS, Tailwind (tokens in styles/tokens.css), shadcn/ui,
Prisma + Postgres, Auth.js (STAFF ONLY, /studio), Cloudinary,
WhatsApp deep-link ordering (lib/whatsapp.ts), React Hook Form + Zod forms,
Lenis + GSAP/ScrollTrigger/SplitText, Framer Motion.
## Conventions
- TypeScript strict; no `any`; named exports; server components by default,
  `"use client"` only for interactivity/motion.
- Styling: Tailwind classes referencing CSS-variable tokens only. No raw hex
  in components — tokens live in styles/tokens.css.
- Motion: every GSAP/Framer effect must (1) use tokens from DESIGN.md A5,
  (2) have a prefers-reduced-motion fallback, (3) never scroll-jack.
- Storefront routes in app/(storefront); staff panel in app/studio (guarded
  by middleware, roles admin/editor). No customer auth routes exist.
  Shared Zod schemas in lib/schemas.
- Commits: feat|fix|chore|refactor(scope): message. Small, verified commits.
## Definition of done (every task)
typecheck ✓ lint ✓ build ✓ · works at 360px and 1280px · keyboard reachable · *(Superseded 2026-08-22 by owner decision: the section container is now 1430px — `--container-section` in tokens.css, `max-w-section` everywhere.)*
reduced-motion checked · screenshots verified via Playwright MCP when UI changed ·
HARD RULES respected (no cart/checkout/payments/customer auth; catalog only via
owner intake paths) · order flow intact: Place Order saves an Inquiry and opens
wa.me/917096036250 with the correct pre-filled message.
```
## E3. `.claude/` scaffolding
```
ResinRiva2.0/
├── CLAUDE.md
├── DESIGN.md                 # this document
├── .mcp.json                 # project-scoped MCP servers
└── .claude/
    ├── settings.json         # permissions + hooks
    ├── skills/               # reusable workflows, invokable as /name
    │   ├── new-section/SKILL.md
    │   ├── a11y-audit/SKILL.md
    │   ├── motion-pass/SKILL.md
    │   └── ship/SKILL.md
    └── agents/               # subagents
        ├── design-reviewer.md
        ├── a11y-auditor.md
        └── perf-auditor.md
```
Note: custom slash commands (`.claude/commands/*.md`) merged into **skills** in Claude Code v2.1.101 — both still work and are invoked as `/name`; skills take priority and are the forward path, so the templates below use `SKILL.md`.
### Skills (copy-paste)
**`.claude/skills/new-section/SKILL.md`**
```markdown
---
name: new-section
description: Build a storefront section exactly to spec from DESIGN.md
---
Build the section the user names in $ARGUMENTS.
1. Read DESIGN.md Part 0 (hard rules), the matching blueprint in Part B2, and tokens in Part A.
2. Plan the component tree + motion (Part B4) before writing code.
3. Implement in components/storefront, server-first, tokens only.
4. Add reduced-motion fallback and 360px layout.
5. Run typecheck + lint, then screenshot desktop AND 375px via Playwright MCP
   and self-critique against the blueprint before reporting done.
```
**`.claude/skills/a11y-audit/SKILL.md`**
```markdown
---
name: a11y-audit
description: Audit changed pages against DESIGN.md accessibility floor
---
For each route in $ARGUMENTS: check contrast against DESIGN.md A2 rule 3
(especially any gold on light — must be #8C6A1D), focus rings per A2 rule 4,
keyboard order, 44px targets, alt text, aria on drawers/menus/tables,
prefers-reduced-motion behavior. Output a fix-list, then fix it.
```
**`.claude/skills/motion-pass/SKILL.md`**
```markdown
---
name: motion-pass
description: Add/refine GSAP+Lenis+Framer motion per DESIGN.md B4
---
Apply the motion spec in DESIGN.md B4 to $ARGUMENTS. Use only the easing and
duration tokens from A5. Every ScrollTrigger gets a static fallback and a
matchMedia reduced-motion guard. Verify 60fps feel by screenshot/scroll test
via Playwright MCP; if it can't hold up, downgrade to the static version.
```
**`.claude/skills/ship/SKILL.md`**
```markdown
---
name: ship
description: Verify, commit, and push the current work
---
Run typecheck, lint, build. Fix failures. Summarize the diff, write a
conventional commit (feat|fix|chore(scope): ...), commit and push.
Never use --no-verify.
```
### Subagents (copy-paste)
**`.claude/agents/design-reviewer.md`**
```markdown
---
name: design-reviewer
description: Reviews UI diffs against DESIGN.md. Use after any visual change.
tools: Read, Grep, Glob, Bash
---
You are ResinRiva's design lead. Compare the implementation against DESIGN.md:
Part 0 hard rules first (no cart/checkout/payment/customer-auth UI anywhere;
order paths end in the Inquiry + WhatsApp flow), then tokens only (no raw hex),
correct type scale and weights, section rhythm
(canvas↔white↔navy bands, no divider borders), gold ≤8% and never interactive,
one motion vocabulary. Return a numbered list of violations with file:line
and the exact DESIGN.md rule broken. Be strict; do not fix, only report.
```
**`.claude/agents/a11y-auditor.md`**
```markdown
---
name: a11y-auditor
description: WCAG AA audit of changed routes. Use before merging UI work.
tools: Read, Grep, Glob, Bash
---
Audit against DESIGN.md A5 accessibility floor + A2 contrast law. Check
computed contrast pairs, focus visibility, keyboard traps in drawers/mega-menu,
form labels, reduced-motion. Report violations with severity and fixes.
```
**`.claude/agents/perf-auditor.md`**
```markdown
---
name: perf-auditor
description: Performance budget check (LCP<2.5s, image/sequence weight)
tools: Read, Grep, Glob, Bash
---
Check next/image usage, lazy-loading of scroll sequences and Lottie,
bundle-heavy client components that could be server components, font loading
(next/font, display swap), and anything violating DESIGN.md B4 performance law.
Report with file:line and concrete fixes.
```
### Hooks + permissions — `.claude/settings.json`
```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Bash(npx prettier *)", "Bash(git *)"],
    "deny": ["Read(.env*)", "Edit(.env*)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path // empty' | grep -E '\\.(ts|tsx|css)$' | xargs -r npx prettier --write"
          }
        ]
      }
    ]
  }
}
```
Hook input arrives as JSON on stdin and the schema evolves — verify against the current hooks reference (https://docs.claude.com/en/docs/claude-code/hooks) when you set this up. The guarantee this buys: every file Claude edits is formatted, and Claude can never read or edit your `.env`.
## E4. MCP servers — `.mcp.json` (project scope)
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```
- **Playwright MCP is non-negotiable for this project**: it lets Claude Code open localhost:3000, scroll, click, and screenshot — closing the loop of "build → SEE it → fix it". A picture is worth 1000 tokens; design-heavy work without visual verification drifts.
- Optional adds via `claude mcp add`: **Higgsfield** (`https://mcp.higgsfield.ai/mcp` — all image/video generation, see E4.1; already connected on your claude.ai), **Vercel** (deployments, logs), **Figma** (if you mock in Figma first — you already have it connected on claude.ai), **Google Drive** (pull the owner's Bulk Import sheets/CSVs), **Postgres** (inspect data while debugging studio queries).
### E4.1 Asset pipeline — all website images & video come from Higgsfield
**Rule:** any image or video the website needs (except real PDP listing photos — A4 exception) is generated on **Higgsfield (https://higgsfield.ai)**, via its MCP server inside Claude Code or claude.ai so generation stays in the same workflow as the build.
**What to generate, mapped to the doc:**
- Hero video loop (B2 homepage §1): macro resin pour on navy, 6–10s seamless loop.
- Pinned pour→cure sequence (B2 §3): generate the video, then extract frames with ffmpeg (`ffmpeg -i pour.mp4 -vf fps=30,scale=1440:-1 seq/frame_%03d.webp`) into `/public/sequences/` for the ScrollTrigger canvas scrub.
- Collection banners, navy storytelling-band visuals (B2 §5), Memory-Preservation gallery mood shots, Our Story process imagery, journal covers, 404/empty-state art, OG images.
**Prompt style guide (keeps every asset on-palette):** always anchor prompts in the Midnight Gild language — e.g. *"macro cinematography, liquid epoxy resin pour, deep midnight-blue backdrop (#0A1A2F), suspended gold-leaf flakes (#D4AF37), backlit translucency, caustic light refraction, shallow depth of field, luxury product film, soft ivory highlights (#FAF9F5), no text, no logos."* Reuse Higgsfield style presets / reference elements so all assets share one look; upscale finals with its upscale tools before export.
**Delivery specs:** images → AVIF/WebP (production storage is @vercel/blob via `src/lib/storage.ts`; Cloudinary transforms remain an optional future migration) → `next/image` with explicit width/height; hero video → MP4 (H.264) + WebM, ≤5MB, `autoplay muted loop playsinline` + poster frame; respect B4's performance law — every generated video ships with a static poster fallback and lazy-loads below the fold.
**Legal/trust:** verify commercial-use rights on your Higgsfield plan, keep an internal log of AI-generated assets, and never use a generated image as the listing photo of a real product a customer is purchasing.
## E5. The daily loop (Explore → Plan → Build → Verify → Commit)
1. **One task per session.** Start `claude`, state the task, `/clear` between unrelated tasks (context hygiene beats /compact).
2. **Explore:** "Read DESIGN.md section B2 homepage + the current components/storefront — don't write code yet."
3. **Plan:** press **Shift+Tab into Plan Mode** for anything non-trivial (new page, the order flow, the scraper, motion system). Ask it to "think hard" on gnarly problems (the scraper pipeline, ScrollTrigger orchestration) — extended thinking scales with think / think hard / ultrathink. Approve the plan before code.
4. **Build:** let it implement the approved plan. Interrupt early if it drifts — Esc stops, checkpoints let you rewind (Esc Esc / `/rewind`) if an approach was wrong.
5. **Verify:** "Screenshot the page at 1280 and 375 via Playwright, compare against DESIGN.md B2, list mismatches, fix them." Then `design-reviewer` + `a11y-auditor` subagents on the diff.
6. **Commit:** `/ship`. Small verified commits > big risky ones.
7. **Parallel work (optional, later):** `git worktree` per feature (e.g. `../rr-admin`, `../rr-motion`), one Claude per worktree — admin and storefront motion can proceed simultaneously without stepping on each other.
## E6. Phase-by-phase prompt playbook (copy-paste into Claude Code)
**Phase 0 — Foundation (week 1–2).**
> Read DESIGN.md Parts A and D fully. Scaffold per D2 if missing: Next.js App Router + TS strict + Tailwind. Create styles/tokens.css exactly from Appendix A and wire tokens into Tailwind. Install shadcn/ui and generate button, input, dialog, sheet, toast, badge themed with our tokens. Add next/font for Fraunces, Inter, IBM Plex Mono per A3. Build components/motion: LenisProvider, Reveal, SplitTextHeading, PageTransition, useReducedMotion — all obeying A5 motion tokens and B4 performance law. Typecheck, lint, build must pass.
**Phase 1 — Component library (week 2).**
> Using DESIGN.md B3, build every storefront component in components/storefront with realistic resin-product mock data. Each component: server-first, tokens only, hover/focus/disabled states per A2, 360px-safe. Screenshot a kitchen-sink page of all components via Playwright and self-review against Part A before done.
**Phase 2 — Storefront core + order flow (week 2–4).**
> Read DESIGN.md Part 0 first — it wins all conflicts. Build Home (static hero image for now — generate it and all other needed images/video via Higgsfield per E4.1), Shop with working filters, PDP with the per-product customization form (driven by customizationSchema), and the full Customize & Order flow per B2: Zod-validated form → Server Action saves the Inquiry record → redirect to wa.me/917096036250 with the URL-encoded order summary, plus the copyable-message fallback. Prisma schema per D3. Catalog data comes ONLY from the owner (run a Bulk Import CSV of real products); local-dev placeholders must be clearly marked and never deployed — never AI-invent products. Then /a11y-audit on all routes.
**Phase 3 — Order-flow hardening (week 4–5).**
> Build the Memory Preservation customize flow per B2 (uploads → mold picker → requirements → same Inquiry + WhatsApp pipeline, type MEMORY_PRESERVATION). Polish the WhatsApp message template into a clean readable summary (product, selections, reference-image links, name/phone, notes, inquiry number). Handle edge cases: WhatsApp not installed → copyable message + number; double-submit guard; honeypot + rate limit on the Server Action. Definition of done: a full test inquiry saves to the DB and opens WhatsApp with a correct, complete pre-filled message on desktop AND a 375px Android viewport.
**Phase 4 — The Studio (week 5–6).**
> Read DESIGN.md Part C. Scaffold app/studio with the shadcn dashboard shell (sidebar per C2) and staff-only Auth.js credentials with admin/editor roles + middleware guard — this is the ONLY login on the site. Build in order: Dashboard KPIs + inquiries chart (C3), the Inquiries pipeline (status flow NEW→…→COMPLETED/DECLINED, Open-in-WhatsApp deep link, quoted/final price fields, bulk update), Products CRUD with Cloudinary upload + the customization-form builder, the Product Scraper approval queue (PENDING → Approve/Reject; nothing publishes unreviewed), the Bulk Import wizard (Sheets/CSV → map → validate → dry-run → import report), Categories, Content/Banners, Reviews moderation, Settings (WhatsApp number, staff + roles). DataTables use server-side pagination via URL searchParams. Royal blue = only action color; gold only on the top-product highlight.
**Phase 5 — Signature motion (week 6–7).**
> Run /motion-pass on: preloader (gold shimmer fill), hero (SplitText + parallax), the pinned pour→cure showcase (ScrollTrigger pin+scrub, static mobile fallback), section reveals, product-card hovers, page transitions — all per DESIGN.md B4. Then design-reviewer + perf-auditor on the diff; anything under 60fps or over LCP budget gets the static fallback.
**Phase 6 — Story & content (week 7–8).**
> Build the Our Story long-scroll per B2 with pinned process imagery, the Memory Preservation storytelling page around the flow shipped in Phase 3, testimonials/UGC sections, journal (if in scope), and wire Content/Banners from the Studio onto the storefront.
**Phase 7 — Polish (week 8+).**
> Full /a11y-audit site-wide, perf-auditor pass, Lighthouse ≥90 perf / ≥95 a11y on Home, PLP, PDP; SEO (metadata, OG images, sitemap, structured data for products); 404/empty/error states; dark-mode Studio QA; deploy to Vercel production.
## E7. Git & deployment
- Branch per phase/feature: `feat/storefront-core`, `feat/admin-orders`. Claude Code writes the PR description from the diff.
- Conventional commits (enforced by habit + the /ship skill). Never `--no-verify`.
- Vercel: preview deploy per PR → visual check on real devices → merge to main = production. Keep secrets (database, blob storage — @vercel/blob today, Cloudinary only if migrated — scraper) in Vercel env vars only; the WhatsApp number is config (Studio settings/env), never hardcoded except the wa.me deep link per Part 0; `.env` is hook-denied to Claude.
## E8. Quality gates (Definition of Done, every merge)
typecheck ✓ · lint ✓ · build ✓ · Playwright screenshots at 1280/375 reviewed · design-reviewer clean · a11y-auditor clean · reduced-motion checked · WhatsApp inquiry flow unbroken — Place Order saves an Inquiry and opens the correct wa.me message (phases ≥2) · Lighthouse budget respected (phase 7 onward).
---
# PART F — AWWWARDS REFERENCE MAP (updated for Midnight Gild)
1. **Messenger** (Abeto — Awwwards Site of the Year 2025, browser WebGL): one memorable "wow," executed cleanly → our single signature = the pour→cure hero; optional drag-to-swirl pigment interaction in phase 3, always with static fallback.
2. **Lando Norris** (OFF+BRAND — SOTY nominee; Webflow + WebGL + Rive; strict two-color #D2FF00 on #111112): disciplined two-color drama → our navy `#0A1A2F` bands with a single gold accent; homepage scroll rhythm; Rive for vector motion.
3. **Cartier Watches & Wonders 2025** (Immersive Garden — Three.js + Blender + GSAP + Lenis; "six immersive alcoves"): museum-room storytelling → each Collection is an alcove; the exact GSAP+Lenis pipeline we ship.
4. **Igloo Inc** (Abeto — all-WebGL, KTX2, reduced-motion fallbacks, LCP≈1s, WCAG AA dark): "object encased in a translucent block" + ruthless perf/a11y discipline → hero refraction treatment and our B4 performance law.
5. **Osmo** (light mode, tilted physics cards, GSAP, magnetic CTAs): playful light-mode asymmetry → PLP card hovers + magnetic royal-blue CTAs, kept premium.
6. **Terminal Industries** (Propagande — clean type, modular layout): technical subject made beautiful → Craft/process section and the admin's modular card grid.
7. **Bruno Simon portfolio** (Three.js, SOTM Jan 2026): R3F craftsmanship, opt-in audio → optional 360 product explorer, audio strictly opt-in.
8. **The Renaissance Edition / Shopify** (SOTM Feb 2026): commerce as art gallery → Collections + Journal framed as curated exhibitions.
9. **Apple Store** (structure north star): system typography, 8pt grid, edge-to-edge tiles broken by color change, one product shadow, pinned scroll sequences, mobile static fallbacks → the entire layout system, PDP, hero.
10. **Unsaid** (emotion north star): feeling-named collections, memory-first copy, dark-canvas luxury (navy+gold now), rotating announcement bar, full-bleed lifestyle photography → Our Story, memory-preservation narrative, homepage navy band, nav taxonomy.
---
# APPENDIX A — `styles/tokens.css` (ready to paste)
```css
:root {
  /* primary — blue */
  --blue-ice: #EAF1FB;      --blue-powder: #C7D9F3;  --blue-steel: #7FA1DB;
  --blue-royal: #1E4FD8;    --blue-sapphire: #142F86; --navy-midnight: #0A1A2F;
  /* dark & neutrals */
  --ink: #0B1220;  --slate: #55627A;  --mist: #D7DCE4;
  --canvas: #FAF9F5;  --card: #FFFFFF;
  /* gold accents */
  --gold-champagne: #F0E3BC; --gold: #D4AF37;
  --gold-antique: #B8912C;   --gold-bronze: #8C6A1D;
  /* semantic */
  --success: #2F8F5B; --warning: #D97706; --danger: #D64545; --info: #0E9BD8;
  /* semantic aliases */
  --bg: var(--canvas); --surface: var(--card); --text: var(--ink);
  --text-secondary: var(--slate); --border: var(--mist);
  --primary: var(--blue-royal); --primary-hover: var(--blue-sapphire);
  --accent: var(--gold); --accent-on-light: var(--gold-bronze);
  /* gradients */
  --grad-depth: linear-gradient(160deg, #0A1A2F 0%, #1E4FD8 100%);
  --grad-gold: linear-gradient(90deg, #8C6A1D 0%, #D4AF37 50%, #F0E3BC 100%);
  /* radii */
  --r-sm: 6px; --r-md: 12px; --r-lg: 20px;
  /* motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-micro: 200ms; --dur-enter: 600ms;
}
.dark, [data-theme="navy"] {
  --bg: var(--navy-midnight); --surface: #10233D; --text: #F5F2EC;
  --text-secondary: #A9B6C9; --border: #22364F;
  --accent-on-light: var(--gold); /* true gold is safe on navy */
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Tailwind v4: map these in `@theme inline { --color-primary: var(--primary); ... }`. Tailwind v3: mirror them under `theme.extend.colors` referencing the CSS vars.
# APPENDIX B — Contrast cheat sheet
| Pair | Ratio | Verdict |
|---|---|---|
| Royal blue #1E4FD8 on white / white on royal | ≈6.5:1 | AA all text — buttons ✓ |
| Ink #0B1220 on canvas #FAF9F5 | ≈16:1 | ✓ |
| White #F5F2EC on navy #0A1A2F | ≈15.6:1 | ✓ |
| Gold #D4AF37 on navy #0A1A2F | ≈8.3:1 | ✓ — gold's home |
| Gold #D4AF37 on white | ≈2:1 | ✗ NEVER — use bronze |
| Bronze #8C6A1D on white/canvas | ≈5.0:1 / ≈4.75:1 | AA ✓ — gold-on-light substitute (slim margin on canvas: never lighten bronze) |
| Deep bronze #7A5C19 on champagne #F0E3BC | ≈4.87:1 | AA ✓ — badge text on champagne fills (plain bronze fails there at ≈3.9:1) |
| Slate #55627A on canvas | ≈5.6:1 | AA ✓ secondary text |
---
*End of master document. Part 0 is law; Parts A–D and F are the spec; Part E is how Claude Code executes it. When in doubt, the rule is always: Part 0 wins, tokens only, one interactive color, gold is a garnish, every order ends in WhatsApp, every effect has a fallback, verify with a screenshot.*
