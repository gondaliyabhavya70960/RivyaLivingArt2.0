# Rivya Living Art — Luxury Resin Art & 3D Printing Platform

**Live site:** [www.rivyalivingart.com](https://www.rivyalivingart.com) · **Admin studio:** [www.rivyalivingart.com/studio](https://www.rivyalivingart.com/studio)

Rivya Living Art is a production-ready, luxury e-commerce **showcase** platform for custom resin art, custom 3D printing, personalized resin gifts, nameplates, wedding resin art, corporate gifting, and home decor — built on Next.js and Vercel-native services, with every order finalized on **WhatsApp** (no payment gateway, no checkout, no customer accounts).

---

## Business Information

|             |                                                               |
| ----------- | ------------------------------------------------------------- |
| Brand       | **Rivya Living Art**                                          |
| Website     | https://www.rivyalivingart.com                                |
| Admin Panel | https://www.rivyalivingart.com/studio                         |
| Phone       | +91 7096036250                                                |
| WhatsApp    | +91 7096036250 (`wa.me/917096036250`)                         |
| Email       | gondaliyabhavya70960@gmail.com                                |
| Location    | https://maps.app.goo.gl/L2NHDt9Akgqs2ZoT6                     |
| Repository  | https://github.com/gondaliyabhavya70960/RivyaLivingArt2.0.git |

## Business Model — Hard Rules (never violate)

- **NO** payment gateway, online checkout, or cart payment (no Stripe / Razorpay / PayPal)
- **NO** customer login, membership, or customer accounts — the only login is the staff-only studio (admin/editor roles) at `/studio`
- **NO AI-invented products, ever.** The catalog is filled ONLY by the owner via: (a) Product Scraper review + approval, (b) Bulk Import (Google Sheets/CSV), (c) manual adds in `/studio`
- Every order is finalized through **WhatsApp**

### Customer Journey

1. Customer visits the website and views products
2. Customer customizes a product using its per-product customization form
3. Customer submits requirements (name, phone, optional email, selections, reference images, notes)
4. Customer clicks **Place Order** → the site generates an order summary AND saves it to the database (Inquiry record) via a Server Action
5. Redirect to WhatsApp with the complete order message pre-filled (`wa.me/917096036250`)
6. Price, payment, and delivery are handled manually in WhatsApp

## Tech Stack (Vercel-native)

| Layer     | Technology                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript; middleware is `src/proxy.ts`)                                                       |
| Styling   | Tailwind v4 (CSS-first, no config file) + shadcn/ui — "Liquid Luxury" v3 design system                                  |
| Motion    | GSAP (ScrollTrigger + SplitText), Lenis smooth scroll, next-view-transitions (shop-card → PDP morph)                    |
| 3D        | `@google/model-viewer` (GLB/USDZ product 3D viewer)                                                                     |
| Forms     | React Hook Form + Zod (server-side validation always)                                                                   |
| Database  | **Neon Postgres** via Vercel Marketplace (native integration) + Prisma ORM                                              |
| Media     | **Vercel Blob** (images, videos, 3D files, customer reference uploads)                                                  |
| Auth      | Auth.js v5 (Credentials) — admin/editor only, protects `/studio/*`; self-service password reset + first-run admin setup |
| Rich text | Tiptap (blog, pages, admin)                                                                                             |
| Email     | Resend via Vercel Marketplace (optional — WhatsApp is the primary channel)                                              |
| Analytics | Vercel Web Analytics + Speed Insights                                                                                   |
| Hosting   | Vercel (one dashboard, one bill; Hobby → Pro upgrade path, zero re-architecture)                                        |

## Design System — Liquid Luxury (v3)

The authoritative spec is **[REDESIGN.md](./REDESIGN.md)** ("Liquid Luxury" v3). Its 15-token palette
is obsidian · deep-ocean · sapphire · mineral · sand · champagne · ink · graphite · mist · hairline,
with champagne reserved for accents (never a fill, max two per viewport) and dark bands never
adjacent (max three per page). Typography: **Instrument Serif** (display) + **Inter** (body) +
**JetBrains Mono** (every price, count, date and dimension) via `next/font`, plus five Noto Sans
script faces for the non-Latin locales. Tokens live in `src/styles/tokens.css`, bridged into
Tailwind v4 by `@theme inline` in `src/app/globals.css` — **there is no `tailwind.config.*` file**.

> [DESIGN.md](./DESIGN.md) (v2.0 "Midnight Gild") and [CONTEXT.md](./CONTEXT.md) (v1 "Midnight
> Sapphire") are **superseded** and kept for history only, per [CLAUDE.md](./CLAUDE.md).

Award-level presentation layer: settings-driven hero video (with poster fallback), pinned 121-frame pour→cure canvas scrub, kinetic oversized typography, scroll-triggered storytelling, magnetic CTAs — all gated behind `prefers-reduced-motion` and performance budgets (LCP < 2.5s, INP < 200ms, CLS < 0.1).

## Website Structure

**Public:** Home · About · Shop · Category pages · Product detail · Custom Order · Workshops · Portfolio · Process · Blog · FAQ · Contact · Privacy · Terms · Search · WhatsApp Order fallback · luxury 404/error/loading states

**The catalogue is organised in three tiers** (`docs/plan/07-three-tier-architecture.md`,
in force from 2026-09-15) — **Collectible Furniture & Spatial Art** (tables, seating,
panels, sculpture, installations) · **Memory & Celebration Art** (varmala and bouquet
preservation, wall clocks, engagement trays, wedding frames, keepsakes) · **Personal Art
& Gifting** (rakhi, jewellery, keychains, coasters, desk pieces, festive and corporate
gifting). They are three customer intents with different price ladders, customization
depth and interface density — not three filters on one grid — and they share one brand
language. Internally they are `Product.sizeTier`; customers see the names above. Tier 3
stays a **WhatsApp order**, not a checkout: hard rule 1 is not negotiable by a tier.

The storefront is localized: a 9-locale next-intl tree (English, Hindi, Gujarati, … including RTL Arabic) served under `/[locale]` with an as-needed locale prefix, routed by `src/proxy.ts`.

**Admin (`/studio`):** Dashboard (KPIs/charts) · Products (with per-product Custom Form Builder) · Categories · Portfolio · Blog · Media Library (Vercel Blob) · Inquiries / WhatsApp Orders · Testimonials · FAQs · Subscribers · SEO · Site Settings · Pages · **Bulk Import (Google Sheets/CSV)** · **Catalog fill** (four-tier CSV catalog import) · **Product Scraper** (tiered source registry → scrape → review → approve → draft import with rewrite guard) · User Roles · Activity Logs

## Repository map

Every top-level entry, and what each root document is FOR. `docs/README.md` is
the same index for `docs/` (35 loose files and seven subdirectories), and
`docs/plan/README.md` for the workstream plans.

**Nothing here is filed by tidiness, and that is deliberate.** Measured on
2026-09-19: every non-blog markdown file in this repository has at least one
inbound reference, and several of those referrers are DATED RECORDS — owner
decision D24 says a dated document is never rewritten, because editing what it
said at the time falsifies it. So a file cannot be moved and its links
repaired; moving it would simply break `CHANGELOG.md`, `PROJECT_STATE.md`,
`docs/audits/` and `RENAME-MIGRATION.md` and leave them broken. This map is the
answer to "where is everything", and it is the answer a rearrangement was not
allowed to give.

### Top-level directories

| Path         | What it is                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`       | The application. Storefront routes in `src/app/[locale]/(v2)` (next-intl, nine locales incl. RTL), staff panel in `src/app/studio`, route guard at `src/proxy.ts` (Next 16 renamed middleware → proxy)    |
| `public/`    | Shipped media. `public/media/v3/` is the Part 15 asset set, `public/redesign/` the Liquid Luxury set (`catalog/` there is placeholders — never a product cover), `public/sequences/` the 121 scrub frames |
| `prisma/`    | Schema, 72 migrations, `bootstrap.ts` (runs on every build), the demo fixtures and the 55 seeded blog bodies in `prisma/blog-content/`                                                                    |
| `scripts/`   | The gates and the pipelines — `redesign-audit.mjs`, `a11y-audit.mjs`, `keyboard-audit.mjs`, `alt-audit.mjs`, `e2e-smoke.mjs`, `studio-audit.mjs`, the media fetchers, `migrate-deploy.mjs`                |
| `tests/`     | Database-backed tests (`npm run test:db`). The unit suite lives beside its source in `src/lib`                                                                                                            |
| `messages/`  | The nine locale files. English first, then the batch — `scripts/i18n-missing.mjs` is the gate                                                                                                             |
| `data/`      | **Read by code.** `data/tiers/*.csv.gz` is the catalogue importer's only source and `data/rewrites/*.json` its editorial copy; `next.config.ts` traces both into the catalog-fill route                   |
| `docs/`      | The documentation tree. **Start at `docs/README.md`** — half of what is there is dated or superseded, and that page is what tells them apart. Three paths in it are pipeline inputs that must not move    |
| `design/`    | The reference design: `implementation-plan.md` (§4.5's icon brief, §6's interaction table), `awwwards-redesign-spec.md`, the UI/UX audit, `mockup/`. Reference, not law — `REDESIGN.md` outranks it       |
| `QA/`        | The 14-part QA audit from the v1 build (architecture, security, performance, a11y, data, scraper…). A dated record                                                                                        |
| `audit/`     | `BASELINE.md` and `FINDINGS.md` — the 2026-07 forensic audit. A dated record                                                                                                                              |
| `.github/`   | `workflows/ci.yml` (the gate on every PR) and the pull-request template                                                                                                                                   |
| `.claude/`   | Agent configuration: skills, agent definitions and settings                                                                                                                                               |
| `.hallmark/` | One log from the superseded Midnight Gallery design system (2026-08-12). History                                                                                                                          |

### Root documents

**In force** — read these:

| File                                                 | Purpose                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CLAUDE.md](./CLAUDE.md)                             | **Read first.** Current repo reality, the hard rules, the conventions, and the traps that cost a production incident to learn. Outranks every other document where they disagree |
| [REDESIGN.md](./REDESIGN.md)                         | **The design spec** (v3 Liquid Luxury) — tokens, motion, every section, the Studio. `docs/redesign-contract.md` is the short version                                             |
| [AGENTS.md](./AGENTS.md)                             | Working agreement for agents: branch and PR conventions, the definition of done                                                                                                  |
| [README.md](./README.md)                             | This page — the business model, the stack, and the map above                                                                                                                     |
| [INSTALL.md](./INSTALL.md)                           | Local development setup                                                                                                                                                          |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                     | Vercel, Neon and Blob, the custom domain, the cron secret, and the optional edge rate limit                                                                                      |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md)                   | Plain-language guide for the owner: the Studio, products, imports, the scraper                                                                                                   |
| [CONTENT_GUIDE.md](./CONTENT_GUIDE.md)               | Content standards and every CSV / XLSX import template                                                                                                                           |
| [SEO_GUIDE.md](./SEO_GUIDE.md)                       | The SEO system, schema markup, per-page metadata                                                                                                                                 |
| [BACKUP_GUIDE.md](./BACKUP_GUIDE.md)                 | Point-in-time recovery, the Blob inventory, git                                                                                                                                  |
| [WHATSAPP_ORDER_GUIDE.md](./WHATSAPP_ORDER_GUIDE.md) | The ordering system: message format, `wa.me` rules, how to test it                                                                                                               |
| [COMPETITOR.md](./COMPETITOR.md)                     | Competitor research — reference only; no catalogue content comes from it                                                                                                         |

**Dated records** — never rewritten (D24). Read them as history, not instruction:

| File                                   | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| [CHANGELOG.md](./CHANGELOG.md)         | What shipped, newest first, each entry naming its phase                  |
| [PROJECT_STATE.md](./PROJECT_STATE.md) | Session checkpoints, newest at the top, each older one marked superseded |

**Superseded** — kept because deleting them would destroy the only account of
decisions that were really made:

| File                       | Superseded by                                         |
| -------------------------- | ----------------------------------------------------- |
| [DESIGN.md](./DESIGN.md)   | `REDESIGN.md`. v2.0 "Midnight Gild"                   |
| [CONTEXT.md](./CONTEXT.md) | `CLAUDE.md` + `PROJECT_STATE.md`. The v1 build memory |

`src/lib/repo-map.test.ts` pins this map against the tree in both directions:
a new root document or top-level directory that is not listed fails, and so
does a row pointing at something that no longer exists.

## Build Phases

> **Historical — the v1 build log.** These twelve phases record how the site was first
> built, in the vocabulary of the time; several describe implementations since replaced
> (the R3F WebGL hero, the cursor glow) and none of them describes the current tree. The
> live record is `PROJECT_STATE.md`'s SESSION CHECKPOINT and `CHANGELOG.md`; the current
> plan is `docs/transformation-roadmap.md`. Kept because it is the only account of the
> original decisions, and rewriting it would falsify what those sessions actually did.

One phase per session; each phase ends by updating CONTEXT.md and **stopping** for explicit permission to continue.

- [x] **Phase 1** — Repo + Documentation
- [x] **Phase 2** — Scaffold + Blue Design System (Next.js 16, Tailwind v4 blue tokens, motion primitives, DynamicHeader — 17/17 browser checks)
- [x] **Phase 3** — Database + Auth (Prisma 7 full schema + migrations, seed: admin/16 categories/FAQs/settings/legal stubs, Auth.js v5 staff login, edge-safe middleware — 6/6 auth flow checks)
- [x] **Phase 4** — Admin Core (studio shell, dashboard, Products CRUD + Custom Form Builder + needsRewrite publish guard, Categories, Media Library on a Blob/local storage abstraction, bulk actions with type-DELETE confirm — 11/11 browser checks)
- [x] **Phase 5** — Admin Rest (Blog with Tiptap, Portfolio, WhatsApp Orders workflow, Testimonials, FAQs, Pages, SEO, Site Settings, Users, Activity Log, Bulk Import with Google Sheets/CSV + scraper-export guard — 13/13 browser checks)
- [x] **Phase 5B** — Product Scraper Module (34-source tiered registry, Shopify/Woo/JSON-LD adapters with fingerprint + marketplace blocklist, chunked resumable jobs, ScrapeDeck v4 CSV export, review→approve→DRAFT import with publish-blocking rewrite guard — full pipeline verified end-to-end)
- [x] **Phase 6** — Public Core Pages (12-section Home, About, Process, FAQ, Contact with spam-protected inquiry form + optional Resend, Workshops, full India-appropriate Privacy/Terms from the Page model, luxury 404/error/loading — 16/16 browser checks incl. header theming)
- [x] **Phase 7** — Shop + Order Flow (filters incl. occasion + price band, infinite scroll, quick view, product detail with gallery/3D/dynamic customization form, reference uploads, live message preview, save-Inquiry-then-WhatsApp redirect, custom order, fallback page, analytics events — 17/17 E2E checks)
- [x] **Phase 8** — Portfolio + Blog + Search (case studies with draggable before/after slider + lightbox + ADM-style meta, blog with Tiptap rendering, read-time, filters, related posts, share — 7/7 checks; search shipped in Phase 7)
- [x] **Phase 9** — Motion + Immersive 3D Polish (R3F liquid-glass WebGL hero with reduced-motion/save-data/low-end/WebGL2 gates and lazy mount, scroll-storytelling scenes + pinned craft story, cursor glow, page transitions, shine sweeps, focus glows — 8/8 checks)
- [x] **Phase 10** — SEO + Deploy (Metadata API + canonicals everywhere, JSON-LD Organization/LocalBusiness/Product/Article/Breadcrumb/FAQPage, dynamic sitemap + robots + manifest, next/og branded OG images, favicon set, DEMO-product cleanup — deploy is owner-run via Vercel dashboard, see DEPLOYMENT.md)
- [x] **Phase 11** — Competitor Research + Blog Seeding + Catalog Channels (COMPETITOR.md: 17 entries + 39 source candidates; 55 original blog posts seeded across 6 categories; per-category customization-field templates in the product form — catalog remains 100% owner-fed, zero auto-generated products)

**All 12 build phases complete.** The catalog is auto-populated at deploy from the four committed tier CSVs (`data/tiers/*.csv.gz` via `prisma/import-tiers.ts`, run by the build's bootstrap step); the owner's intake paths (Product Scraper, Bulk Import, manual studio adds) remain the only other doors. Production deployment is **done** — the site is live at www.rivyalivingart.com on Vercel with Neon and Blob (this sentence claimed it was still the owner's remaining step until 2026-09-03); see [DEPLOYMENT.md](./DEPLOYMENT.md).

**Studio auth pages** — the `/studio` sign-in is a blue-led luxury card (void background + gradient mesh, show/hide password) with three companion flows, all staff-only and consistent with the no-customer-accounts rule:

- **Sign in** (`/studio/login`) — Credentials login with a "Forgot password?" link.
- **Forgot / reset password** (`/studio/forgot-password` → `/studio/reset-password`) — self-service reset with a hashed, single-use, one-hour token. Delivery uses Resend when `RESEND_API_KEY` is set (sender from `RESEND_EMAIL_DOMAIN` → `studio@<domain>`, or a full `EMAIL_FROM`); otherwise the reset link is written to the server log so the owner is never locked out. Responses never reveal whether an email exists.
- **First-run setup** (`/studio/signup`) — creates the first ADMIN, and **only** while the studio has zero accounts (a one-time owner bootstrap). Once any account exists it is permanently closed; further staff are invited from Studio → Users. There is no public/customer sign-up.

## Environment Variables

See [.env.example](./.env.example). `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are auto-injected by the Vercel-native Neon and Blob integrations; pull locally with `vercel env pull .env` (Prisma 7 reads `.env`, not `.env.local`).

## Known Caveats

- **Vercel Hobby plan is officially non-commercial** → the owner will upgrade to **Vercel Pro ($20/mo)** when the store goes commercial. The Vercel-native stack (Neon + Blob + Analytics) upgrades with zero re-architecture — billing stays in one Vercel invoice.
- Vercel Blob and Image Optimization include plan allowances; beyond them, usage-based billing applies → keep all media web-optimized (hero video ≤6MB, WebP images, lazy loading).
- Neon free plan auto-suspends and auto-wakes on request (scale-to-zero) — the first request after idle may have a brief cold start; this is normal and needs no action.
- `wa.me` links cannot attach files → reference images are uploaded to Vercel Blob and their public URLs are embedded in the message; the total message is kept under ~1,500 characters.
- The hero is a settings-driven video (≤6MB) with a poster image; reduced-motion users get the static poster automatically (the fallback is built in, not optional).
- The Product Scraper natively supports Shopify + WooCommerce JSON APIs, plus a generic JSON-LD Product-schema fallback for other sites (slower — one page per product, capped and resumable). Sites exposing none of these need a custom adapter. Marketplaces (Amazon/Etsy/Flipkart/IndiaMART…) are blocked by design — use their official APIs. Poonam Shah Art has no scrapeable catalog (enquiry-only) and is covered by the Phase 11 original category seed instead.
- Scraped text and images are competitor copyright — the scraper imports DRAFTS ONLY with a publish-blocking `needsRewrite` flag; rewrite descriptions and replace images with real Rivya Living Art photos before publishing.
- No Google account or credentials are needed. The confirmed product list exports from `/studio/exports` as CSV or XLSX; bulk import reads CSV/XLSX. (Direct Google Sheet sync existed until 2026-09-15 and was removed — see `docs/archive/google-sheets.md`.)
- Long scrapes run as chunked, resumable jobs to respect Vercel serverless time limits.
- ~100 sources × hundreds of products = tens of thousands of staging rows — per-run caps and change-hash upserts keep it manageable; scrape tiers in batches, not all in one day.
- "Top 50/20/20" scraper tier quotas are filled by the Phase 11 discovery task with MANDATORY fingerprint verification before a source is enabled — unverified or unsupported sites are stored disabled, never guessed at.

---

© Rivya Living Art. All product content is owner-fed and 100% original — competitor material is research reference only.
