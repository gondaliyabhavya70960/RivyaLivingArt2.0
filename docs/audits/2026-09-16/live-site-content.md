# Live site content audit — https://rivyalivingart.com, 2026-09-16 (evening)

Read-only fetch of every public route after the owner emptied the catalogue
(16:57 UTC) and the deploy-time CSV fill was switched off (PR #92). Every
`/en/*` route redirects to the unprefixed `https://www.rivyalivingart.com/*`
and answers 200; nothing 500'd. The Studio itself was read from source, not
from the deployment (no credentials in the session).

The question this answers is the owner's: "add primary business-related
content in each and every Studio-related place". The last column says who can
supply it — and **nothing below is invented**: a product, a review or a
testimonial is owner-supplied only, by the HARD RULES.

| Surface (`src/app/studio/(dashboard)/…`) | Backing table | Production state (live fetch or seed) | What "primary business content" is missing | Where real content could come from |
| --- | --- | --- | --- | --- |
| `products` | `Product` (+`ProductImage`, `ProductVariant`) | **0 rows.** `/shop`: "Showing 0 of 0 pieces" · "The first pieces are being poured" · "Every Rivya Living Art piece is made to order. Commission yours now, or message us on WhatsApp…". `/shop/varmala-preservation`, `/shop/gift-collections`: "No pieces yet". `/search?q=table`: 11 results = 2 journal + 9 portfolio, 0 products. Homepage/PDP/large-format piece bands render nothing. Deploy-time fill is OFF (`20260917130000`). | The entire catalogue: every tier, every category, workshop sessions | Owner-supplied only: `/studio/products` manual, `/studio/import` (CSV/XLSX/Sheet URL), scraper review → promote (the reference rollout stages ~1,200 rows for exactly this), or `data/tiers/Tier1_Owner.csv.gz` (373 rows of the owner's OWN previous store: title/slug/category/description/prices/images; categories "Choose your Products" 100 · blank 58 · "Diwali Resin Update" 49 · "Birthday Gifts" 37 · "Choose a Giftcard" 21 · "3d printed" 18 — includes soy candles and gift cards, so it needs curation, not a blind fill) via `/studio/catalog-fill` — NOTE those 373 rows are TOMBSTONED by the owner's delete (`DeletedImport`), so a fill will not resurrect them until the tombstones are cleared |
| `categories` | `Category` | Rows exist (seed.ts's 16 on first boot + the 22-slug canonical taxonomy `catalog-taxonomy.ts` created by `tier-fill.ts`; images back-filled every deploy by `seed-category-images.ts`). Homepage "The collections" shows 4 tiles (gift-collections, resin-home-decor, varmala-preservation, wedding-photo-frames). Shop group tabs: All · Resin art · Gifts · Supplies · 3D printing. | Nothing structural; all categories are empty of pieces. The Supplies and 3D printing tabs are the OLD taxonomy showing on an empty catalogue (T2 territory). | seed.ts / taxonomy already; owner edits descriptions/images |
| `faqs` | `Faq` | 6 seeded by `prisma/seed.ts` (delivery, packing, photo quality, care, price/payment, returns) — live on `/faq` | Large-format / commission / workshop / preservation questions, if wanted (the plans ask for 25+) | seed.ts (6) · owner via `/studio/faqs` — facts about shipping, lead times and pickup are the owner's to state |
| `blog` | `BlogPost` · `BlogCategory` · `Tag` | 55 posts seeded by `prisma/seed-blogs.ts` from `prisma/blog-content/*.md` (first boot only); live: `/blog` "Page 1 of 5", sitemap 55 `/blog/*`; homepage shows 3 | None missing (covers back-filled by `reconcile-blog-covers.ts`) | seed-blogs.ts · owner |
| `portfolio` | `Portfolio` · `PortfolioImage` | 20 cases LIVE (sitemap 20 `/portfolio/case-*`; `/portfolio` "Page 1 of 2"). Seeded by `prisma/seed-portfolio-cases.ts` (needs `PORTFOLIO_SEED=1` and an empty table, D22); the cases are Tier-1 catalogue rows with imagery hot-linked from `kanhakreation.com` and some Vercel Blob | No large-format case (the large-format page's "Documented as they leave the studio" rail shows coasters/placemats/magnets as "large pieces"); no `beforeImageUrl` anywhere; no owner photography | Owner-supplied only (real commissions, own photos) |
| `testimonials` | `Testimonial` | NOT seeded; live 0 — `testimonial-wall.tsx` returns null on home, custom-order, large-format, PDP | All reviews | Owner-supplied only (publish needs `permissionStatus: GRANTED`) |
| `pages` | `Page` | 2 legal pages upserted by seed.ts (`privacy`, `terms`) — live with owner email + WhatsApp | None | seed.ts |
| `custom-pages` | `CustomPage` · `CustomBlock` | None (only demo fixtures: 5 pages / 14 blocks, `isDemo`); sitemap has no `/p/*` | Seasonal/landing pages if wanted (Raksha Bandhan, Diwali, wedding season…) | Owner-supplied only (16 block types) |
| `media` | `Media` | Rows only from bootstrap's bundled site-image import (gated on `BLOB_READ_WRITE_TOKEN` + empty `SiteImage`) and owner uploads | Real studio/product/maker photography | Owner-supplied only |
| `site-copy` | `SiteCopy` (overrides) | Registry-defaulted, 1,297 slots; live pages render shipped copy (about: "Bhavya Gondaliya", Surat bench; process: 10 steps + lead-time bands; large-format, workshops, contact prose all present) | Only owner corrections | `site-copy.generated.ts` registry |
| `site-images` | `SiteImage` (overrides) | Registry-defaulted, 78 slots / 25 bundled masters | `home.maker` / `about.maker` are AI-generated (§15.2) — a real maker portrait; real bench/studio photos | Owner-supplied only |
| `sections` · `process` · `materials` | `PageSection` (overrides) | Registry-defaulted (7 pages; process-steps ×10, materials ×4). Homepage furniture/rooms bands and the large-format pieces band ship OFF | Nothing until products exist | `page-sections.ts` registry |
| `forms` | `FormOption` | bootstrap seeds `FORM_OPTION_DEFAULTS` when the table is empty | None | `form-options.ts` |
| `navigation` | `NavMenu` · `NavItem` | bootstrap seeds `NAV_MENU_DEFAULTS` when empty + back-fills `largeFormat` | None (T2 — the tier-named header — is an owner question) | `nav-menus.ts` |
| `settings` | `SiteSettings` | seed.ts sets brandName, tagline, announcement, phone, whatsappNumber, email, mapsUrl, defaultCareNotes; `address: ""`, `socials: {}`, `logoUrl`/`faviconUrl`/`appIconUrl` null. Live footer + `/contact` show only +91 7096036250, the Gmail address, "10am–8pm IST"; no social links, no postal address | Address, Instagram/social links, logo/favicon, business-hours confirmation | Owner-supplied only (`/studio/settings`) |
| `seo` | `SiteSettings.defaultSeo` | Seeded title/description | Per-page OG images if wanted | seed.ts · owner |
| `inquiries` | `Inquiry` | Customer-generated; none seeded (demo 30) | — (arrives from WhatsApp orders) | Customers |
| `subscribers` | `Subscriber` | Waitlist/newsletter signups; none seeded | — | Customers (workshops "Join the waitlist") |
| `users` | `User` | Admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed.ts) | Editor accounts if wanted | Owner |
| `scraper` | `ScrapeSource` · `ScrapeJob` · `ScrapedProduct` … | `seed-sources.ts` reconciles the registry every deploy (owner's 8 + 10 reference sites + the previous store), all `PENDING` until the reference rollout (PR after #92) records the review | Policy review per source, then runs — the rollout does both for the verified sources | `seed-data.ts` + the rollout + owner review |
| `research` | `ResearchRecord` | None seeded (demo 30) | — | Owner/scraper |
| `catalog-fill` · `import` · `exports` | `ImportRun` · `ImportConflict` · `ActivityLog` / reads `Product` | Fill OFF in production; exports read 0 confirmed products | — (tools, not content) | `data/tiers/*.csv.gz` |
| `content-lab` | every content table (`isDemo`) | Demo fixtures available (100 products, 40 testimonials, 12 portfolio, 30 posts, 5 custom pages, 40 media, 30 inquiries…); `demoContentPublic` is OFF (shop shows 0) | Not business content — never the answer here | `prisma/fixtures/demo/*.json` |
| `analytics` · `activity` · `content-gaps` | derived | `content-gaps` is the built-in worklist (no-description / no-sizeTier / no-images / needsRewrite counts, testimonial count) | — | — |

Notes:

1. Route facts: `/en/custom-order` is the commission route (form + 6 case
   links); `/en/whatsapp-order` without a token says "This order link has
   expired or is missing — no worries…" (expected); `/en/workshops`: "Next
   dates are being set." — sessions are `PUBLISHED` products in the
   `workshops` category, so 0 until one exists; `/search` reset once at the
   agent proxy, 200 on retry.
2. `/portfolio` renders "Commission stories are being written — yours could be
   first." beneath the 20 real cases. **Checked against source: not a bug.**
   That line is the closing commission band by design (the page's header
   comment records the move out of the empty state, which now renders only
   when a filter returns nothing).
3. The large-format page's pieces band says "There is nothing to browse at
   this scale yet…" and its case rail shows small goods (geode coasters,
   placemats, favour magnets) under "large pieces" — no large-format case
   exists in the archive.
4. Portfolio case images are hot-linked from `kanhakreation.com` (a supplier
   host) — not the owner's photography; the cases came from Tier-1 rows, not
   real commissions.
5. Shop group tabs still expose "Supplies" and "3D printing" on an empty
   catalogue.
6. The homepage never showed testimonials, and the footer/contact carry no
   address or social links — those are empty `SiteSettings` fields, not
   rendering bugs.
7. `gift-collections` on the homepage is a canonical-taxonomy category
   (`catalog-taxonomy.ts`, created by `tier-fill.ts`), not a demo leak; demo
   content is not public.
8. Nothing on any public route is a product, review or testimonial; all of
   those are owner-supplied only.
