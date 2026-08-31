# ResinRiva — Luxury Resin Art & 3D Printing Platform

**Live site:** [store.bhavyagondaliya.co.in](https://store.bhavyagondaliya.co.in) · **Admin studio:** [store.bhavyagondaliya.co.in/studio](https://store.bhavyagondaliya.co.in/studio)

ResinRiva is a production-ready, luxury e-commerce **showcase** platform for custom resin art, custom 3D printing, personalized resin gifts, nameplates, wedding resin art, corporate gifting, and home decor — built on Next.js and Vercel-native services, with every order finalized on **WhatsApp** (no payment gateway, no checkout, no customer accounts).

---

## Business Information

| | |
|---|---|
| Brand | **ResinRiva** |
| Website | https://store.bhavyagondaliya.co.in |
| Admin Panel | https://store.bhavyagondaliya.co.in/studio |
| Phone | +91 7096036250 |
| WhatsApp | +91 7096036250 (`wa.me/917096036250`) |
| Email | gondaliyabhavya70960@gmail.com |
| Location | https://maps.app.goo.gl/L2NHDt9Akgqs2ZoT6 |
| Repository | https://github.com/gondaliyabhavya70960/ResinRiva2.0.git |

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

| Layer | Technology |
|---|---|
| Framework | Next.js 15+ (App Router, TypeScript) |
| Styling | TailwindCSS + shadcn/ui — blue-led luxury design system |
| Motion | GSAP (ScrollTrigger + SplitText), Lenis smooth scroll, next-view-transitions (shop-card → PDP morph) |
| 3D | `@google/model-viewer` (GLB/USDZ product 3D viewer) |
| Forms | React Hook Form + Zod (server-side validation always) |
| Database | **Neon Postgres** via Vercel Marketplace (native integration) + Prisma ORM |
| Media | **Vercel Blob** (images, videos, 3D files, customer reference uploads) |
| Auth | Auth.js v5 (Credentials) — admin/editor only, protects `/studio/*`; self-service password reset + first-run admin setup |
| Rich text | Tiptap (blog, pages, admin) |
| Email | Resend via Vercel Marketplace (optional — WhatsApp is the primary channel) |
| Analytics | Vercel Web Analytics + Speed Insights |
| Hosting | Vercel (one dashboard, one bill; Hobby → Pro upgrade path, zero re-architecture) |

## Design System — Midnight Gild (v2.0)

The public site is the light v2.0 "Midnight Gild" system: a **porcelain `#FAF9F5`** canvas, **royal blue `#1E4FD8`** for interaction, **gold** reserved for accents, and **midnight navy `#0A1A2F`** bands applied via `data-theme="navy"` sections. Tokens live in `src/styles/tokens.css` per [DESIGN.md](./DESIGN.md) Appendix A. Typography: **Fraunces** (display serif) + **Inter** (body sans) + **Manrope** + **IBM Plex Mono** via `next/font`.

Award-level presentation layer: settings-driven hero video (with poster fallback), pinned 121-frame pour→cure canvas scrub, kinetic oversized typography, scroll-triggered storytelling, magnetic CTAs — all gated behind `prefers-reduced-motion` and performance budgets (LCP < 2.5s, INP < 200ms, CLS < 0.1).

## Website Structure

**Public:** Home · About · Shop · Category pages · Product detail · Custom Order · Workshops · Portfolio · Process · Blog · FAQ · Contact · Privacy · Terms · Search · WhatsApp Order fallback · luxury 404/error/loading states

The storefront is localized: a 9-locale next-intl tree (English, Hindi, Gujarati, … including RTL Arabic) served under `/[locale]` with an as-needed locale prefix, routed by `src/proxy.ts`.

**Admin (`/studio`):** Dashboard (KPIs/charts) · Products (with per-product Custom Form Builder) · Categories · Portfolio · Blog · Media Library (Vercel Blob) · Inquiries / WhatsApp Orders · Testimonials · FAQs · Subscribers · SEO · Site Settings · Pages · **Bulk Import (Google Sheets/CSV)** · **Sheet Import** (four-tier owner-sheet catalog import) · **Product Scraper** (tiered source registry → scrape → review → approve → draft import with rewrite guard) · User Roles · Activity Logs

## Documentation

| File | Purpose |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | **Project instructions** — current repo reality, hard rules, conventions. Read this first in every session. |
| [DESIGN.md](./DESIGN.md) | **Master design spec** (v2.0 Midnight Gild) — tokens, motion, sections, studio |
| [CONTEXT.md](./CONTEXT.md) | Historical v1 build memory (phase log) — superseded by CLAUDE.md + DESIGN.md |
| [INSTALL.md](./INSTALL.md) | Local development setup |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel deployment, Neon + Blob integration, custom domain |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | Plain-language guide for the owner: studio, products, imports, scraper |
| [CONTENT_GUIDE.md](./CONTENT_GUIDE.md) | Content standards + every Google Sheet / CSV import template |
| [SEO_GUIDE.md](./SEO_GUIDE.md) | SEO system, schema markup, per-page metadata |
| [BACKUP_GUIDE.md](./BACKUP_GUIDE.md) | Neon point-in-time recovery, Blob inventory, git |
| [WHATSAPP_ORDER_GUIDE.md](./WHATSAPP_ORDER_GUIDE.md) | WhatsApp ordering system: message format, wa.me rules, testing |
| [COMPETITOR.md](./COMPETITOR.md) | Top-20 competitor research (populated in Phase 11) |

## Build Phases

One phase per session; each phase ends by updating CONTEXT.md and **stopping** for explicit permission to continue.

- [x] **Phase 1** — Repo + Documentation
- [x] **Phase 2** — Scaffold + Blue Design System (Next.js 16, Tailwind v4 blue tokens, motion primitives, DynamicHeader — 17/17 browser checks)
- [x] **Phase 3** — Database + Auth (Prisma 7 full schema + migrations, seed: admin/16 categories/FAQs/settings/legal stubs, Auth.js v5 staff login, edge-safe middleware — 6/6 auth flow checks)
- [x] **Phase 4** — Admin Core (studio shell, dashboard, Products CRUD + Custom Form Builder + needsRewrite publish guard, Categories, Media Library on a Blob/local storage abstraction, bulk actions with type-DELETE confirm — 11/11 browser checks)
- [x] **Phase 5** — Admin Rest (Blog with Tiptap, Portfolio, WhatsApp Orders workflow, Testimonials, FAQs, Pages, SEO, Site Settings, Users, Activity Log, Bulk Import with Google Sheets/CSV + scraper-export guard — 13/13 browser checks)
- [x] **Phase 5B** — Product Scraper Module (34-source tiered registry, Shopify/Woo/JSON-LD adapters with fingerprint + marketplace blocklist, chunked resumable jobs, ScrapeDeck v4 CSV + optional Sheets sync, review→approve→DRAFT import with publish-blocking rewrite guard — full pipeline verified end-to-end)
- [x] **Phase 6** — Public Core Pages (12-section Home, About, Process, FAQ, Contact with spam-protected inquiry form + optional Resend, Workshops, full India-appropriate Privacy/Terms from the Page model, luxury 404/error/loading — 16/16 browser checks incl. header theming)
- [x] **Phase 7** — Shop + Order Flow (filters incl. occasion + price band, infinite scroll, quick view, product detail with gallery/3D/dynamic customization form, reference uploads, live message preview, save-Inquiry-then-WhatsApp redirect, custom order, fallback page, analytics events — 17/17 E2E checks)
- [x] **Phase 8** — Portfolio + Blog + Search (case studies with draggable before/after slider + lightbox + ADM-style meta, blog with Tiptap rendering, read-time, filters, related posts, share — 7/7 checks; search shipped in Phase 7)
- [x] **Phase 9** — Motion + Immersive 3D Polish (R3F liquid-glass WebGL hero with reduced-motion/save-data/low-end/WebGL2 gates and lazy mount, scroll-storytelling scenes + pinned craft story, cursor glow, page transitions, shine sweeps, focus glows — 8/8 checks)
- [x] **Phase 10** — SEO + Deploy (Metadata API + canonicals everywhere, JSON-LD Organization/LocalBusiness/Product/Article/Breadcrumb/FAQPage, dynamic sitemap + robots + manifest, next/og branded OG images, favicon set, DEMO-product cleanup — deploy is owner-run via Vercel dashboard, see DEPLOYMENT.md)
- [x] **Phase 11** — Competitor Research + Blog Seeding + Catalog Channels (COMPETITOR.md: 17 entries + 39 source candidates; 55 original blog posts seeded across 6 categories; per-category customization-field templates in the product form — catalog remains 100% owner-fed, zero auto-generated products)

**All 12 build phases complete.** The catalog is auto-populated at deploy from the owner's four-tier product sheet (`data/tiers/*.csv.gz` via `prisma/import-tiers.ts`, run by the build's bootstrap step); the owner's intake paths (Product Scraper, Bulk Import, manual studio adds) remain the only other doors. Production deployment (Vercel import + Neon/Blob + custom domain) is the owner's remaining step; see [DEPLOYMENT.md](./DEPLOYMENT.md).

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
- Scraped text and images are competitor copyright — the scraper imports DRAFTS ONLY with a publish-blocking `needsRewrite` flag; rewrite descriptions and replace images with real ResinRiva photos before publishing.
- Direct Google Sheet sync is optional and needs a free Google service account (`GOOGLE_SERVICE_ACCOUNT_JSON` + `SCRAPE_SHEET_ID`); without it, staging + Sheet-ready CSV export covers the full workflow with zero Google keys.
- Long scrapes run as chunked, resumable jobs to respect Vercel serverless time limits.
- ~100 sources × hundreds of products = tens of thousands of staging/Sheet rows — per-run caps, per-tier Sheet tabs, and change-hash upserts keep it manageable; scrape tiers in batches, not all in one day.
- "Top 50/20/20" scraper tier quotas are filled by the Phase 11 discovery task with MANDATORY fingerprint verification before a source is enabled — unverified or unsupported sites are stored disabled, never guessed at.

---

© ResinRiva. All product content is owner-fed and 100% original — competitor material is research reference only.
