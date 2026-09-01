# JULES FORENSIC REPOSITORY AUDIT

## 1. Current Architecture
The repository uses a modern Next.js App Router (v14/v15/v16) structure with TypeScript.
- **Styling**: Tailwind CSS v4 with custom tokens (`src/styles/tokens.css`).
- **Database**: Postgres handled by Prisma (`prisma/schema.prisma`).
- **Auth**: Auth.js v5 (exclusively for staff/admin in `/studio`). No public user accounts.
- **Media**: Vercel Blob integrations.
- **Localization**: next-intl for 9 locales under `src/app/[locale]/(v2)`.
- **Animations**: GSAP, Lenis (smooth scrolling), R3F (WebGL 3D).

## 2. Current Routes
- **Storefront** (`src/app/[locale]/(v2)`): Home, About, Shop, Categories, Product Detail, Custom Order, Workshops, Portfolio, Process, Blog, FAQ, Contact, Privacy, Terms, Search.
- **Admin** (`src/app/studio`): Dashboard, Products, Categories, Portfolio, Blog, Media Library, Inquiries, Testimonials, FAQs, Settings, Scraper, Users, Pages.

## 3. Current Database
A robust `schema.prisma` exists with:
- E-commerce models: `Product`, `ProductImage`, `Category`.
- CMS models: `SiteImage`, `SiteCopy`, `CustomPage`, `PageSection`.
- Studio models: `User`, `Inquiry`, `Subscriber`.
- Configuration: `FormOption`, `NavMenu`, `ContentRevision`.
*Note: The `Inquiry` model currently uses a basic `InquiryStatus` enum but lacks the comprehensive workflow tracking (NEW → CONTACTED → ...) required for Bespoke.*

## 4. Existing Product Functionality
- Fully localized product catalog.
- "WhatsApp Order" fallback workflow via `lib/whatsapp.ts`.
- Customizable configuration fields via FormOption lists.
- Display properties for priceMin/Max, materials, dimensions.

## 5. Existing Scraper Functionality
- `Product Scraper Module` exists for Shopify/WooCommerce JSON and generic JSON-LD.
- Chunked, resumable background jobs to respect Vercel limits.
- Writes to drafts and enforces a `needsRewrite` guard before publishing.
- Optional syncing with Google Sheets.

## 6. Existing Competitor Functionality
- Competitor tracking is present in `COMPETITOR.md` (17 entries, 39 source candidates).
- It does not yet seem to have a fully fleshed-out interactive UI as a dedicated "Market Intelligence" section in the DB.

## 7. Existing Google Sheets Functionality
- `prisma/import-tiers.ts` and `data/tiers/*.csv.gz` sync catalogs.
- The scraper can sync with `SCRAPE_SHEET_ID`.
- Needs to be refactored/expanded to cleanly distinguish between raw market intelligence vs. Rivya's products.

## 8. Existing Blog
- Tiptap-based rich text editor in the Studio.
- Categories and tags with translations.
- Requires thematic pivot from generic resin crafts to luxury furniture/art focus.

## 9. Existing Portfolio
- Uses before/after slider patterns (though DB missing `beforeImageUrl` currently).
- Needs renaming to `Projects` with expanded narrative capabilities.

## 10. Existing Admin
- Secure, token-based Staff-only `/studio`.
- Functional CMS for Site Copy, Images, and Page Sections.

## 11. Existing 3D Functionality
- Uses `@google/model-viewer` and Three.js (R3F) for hero components.
- Lazy-mounted with `prefers-reduced-motion` fallbacks.

## 12. Existing Animations
- High-quality page transitions and scrolling interactions via GSAP + Lenis.
- Heavy focus on not blocking Core Web Vitals (LCP/CLS) using lazy-loading and constraints.

## 13. Existing Problems
- The brand focus is diluted. It caters generically to resin art rather than aggressively asserting itself as a monumental luxury furniture house.
- The "Custom Order" form is functional but lacks the depth and CRM pipeline of a true "Bespoke" furniture experience.
- Some CMS data exists as hardcoded dictionary entries instead of DB-driven content (e.g. `messages/en.json`).

## 14. Recommended Changes
- Overhaul Information Architecture: Prioritize `/furniture`, `/art`, `/bespoke`, `/projects`.
- Pivot `/portfolio` -> `/projects` and `/blog` -> `/journal`.
- Restructure the homepage to feature "Hero Furniture", "Signature Table", and "Materials" upfront, pushing gifts/jewelry lower.
- Extend `Inquiry` in Prisma to support `NEW → CONTACTED → QUALIFIED → QUOTATION → IN_PROGRESS → COMPLETED → CLOSED` for Bespoke.
- Upgrade the Scraper UI in the Studio to a "Market Intelligence Studio".

## 15. What Should Be Preserved
- Auth.js and RBAC admin structure.
- `next-intl` localization strategy.
- Scraper job queue and Google Sheets integration logic.
- GSAP/Lenis animations and WebGL optimization principles.
- The `SiteCopy` and `SiteImage` slot override system.

## 16. What Should Be Replaced
- Replace the current generic homepage sections with the 11 new luxury sections.
- Replace generic "Custom Order" with the detailed `/bespoke` workflow.

## 17. What Should Be Added
- `Bespoke` CRM workflow in Studio.
- Distinctly separate `/wedding` experience.
- Formal "Competitor Intelligence" UI in Studio if it currently relies only on markdown files.
