# Needed work — what is still owed, tier by tier (2026-09-16)

> The companion of [`COMPLETED-WORK.md`](COMPLETED-WORK.md). Built from the
> five brief audits in [`docs/audits/2026-09-16/`](audits/2026-09-16/README.md)
> and the live-site content audit. Every item names where it comes from and
> what kind of thing it is — an owner input nobody else can supply, an owner
> decision the plan tabled, or work that can start now. Nothing here is a
> guess about the brief; the rows behind each line are in the audit tables.

Audited HEAD: `91c93b5` (`main` after PR #92) plus the reference-site rollout
PR that carries this file.

## 1. Owner inputs — content and facts only the owner can supply

The live site renders shipped copy everywhere, but these are empty in
production and **must not be invented** (HARD RULES: no AI-invented products,
reviews or testimonials).

| Surface | What is missing | Where to do it |
| --- | --- | --- |
| Products (all tiers) | The catalogue is empty since the 16:57 UTC purge. The reference rollout stages ~1,400 rows for review after the merge; **approving and importing them is the owner's act**, in `/studio/scraper/review` (bulk approve → Add to catalog, with the suggested tier). | `/studio/scraper/review` → `/studio/products` |
| The owner's own previous pieces | The 373 rows of `data/tiers/Tier1_Owner.csv.gz` (the owner's previous store) are TOMBSTONED by the purge, so the fill will not bring them back; the previous store itself answers HTTP 402. If they are wanted: clear their tombstones (`DeletedImport` rows with `importSource = "sheet:…"` for Tier 1) and run the fill for Tier 1 from `/studio/catalog-fill` — a Studio button for exactly that is buildable (see §3). | `/studio/catalog-fill` |
| Testimonials (all tiers) | Zero rows; the wall returns null on home, custom-order, large-format and every PDP. Publishing needs `permissionStatus: GRANTED`. | `/studio/testimonials` |
| Settings | `address` is empty, `socials` is `{}`, `logoUrl` / `faviconUrl` / `appIconUrl` are null; the footer and `/contact` show only the phone, the Gmail address and "10am–8pm IST". | `/studio/settings` |
| Photography | `home.maker` and `about.maker` are AI generations the owner must replace with a real portrait (§15.2); no real bench, studio or product photography; portfolio images are hot-linked from a supplier host. | `/studio/site-images`, `/studio/media` |
| Portfolio (LARGE especially) | 20 cases exist but are Tier-1 catalogue rows, not real commissions; no LARGE case, so the large-format page's case rail shows coasters and magnets under "large pieces"; no row carries `beforeImageUrl`, so the before/after slider (MEDIUM) never renders. | `/studio/portfolio` |
| FAQs | 6 seeded; the plans ask for 25+ with large-format, commission, preservation, pickup and workshop questions — facts about shipping, lead times and flower pickup are the owner's to state. | `/studio/faqs` |
| Seasonal landers (SMALL) | None; Raksha Bandhan, Diwali, wedding season, Valentine's, Mother's/Father's Day pages are buildable in the page builder (16 block types, scheduled by `isLive()`). | `/studio/custom-pages` |
| Workshops | "Next dates are being set" — a session is a PUBLISHED product in the `workshops` category. | `/studio/products` |
| Sources with no automated path | Scarlet Splendour (Cloudflare-gated), Draga & Aurel, Materia Aurea, WITHIN, VEDUMI, The Art Galaxy, ResinArt.in — filed as manual research with the reason; anything from them is the owner's manual research. Sumaiya Resin's store API lists 0 products. | `/studio/scraper/sources` |
| Vercel env | Verify no `GOOGLE_*` key remains in the Vercel dashboard (not checkable from the repo). | Vercel |

## 2. Owner decisions — tabled questions that block real work

Recorded in `docs/plan/07-three-tier-architecture.md` §"Conflicts that need
an owner decision" and `docs/plan/06-source-documents.md`; each blocks the
rows named.

| Question | What waits on it | Tier |
| --- | --- | --- |
| **T2** Tier-named header (Collectible Design · Memory Art · Personal Art & Gifts · Custom Commission · Our Story · Journal) vs the four-item masthead REDESIGN §5.2 fixes | The "Large → Medium → Small" hierarchy in discovery; the brand-hierarchy copy; the shop's old group tabs (Resin art · Gifts · Supplies · 3D printing) still showing on an empty catalogue | all |
| **T8** The "Three scales. One artistic language." homepage band (must replace a band under §3.1) | The journey line, "Art for the space / memory / person", `ProductTier.*.promise` copy (exists in nine locales with no consumer) | all |
| **T4** Tier 02's guided path: seven steps, three labelled uploads, pickup / flower-shipping instructions, the preservation explainer | The largest single gap; §1.1 protects customization logic and uploads | MEDIUM |
| **T3** Seven product fields: edition / one-of-one, finish, price type + "starting from", shipping class, subcategory, weight, personalisation type, commission / preservation flags | "Starting from" on cards, edition on the collectible card, installation/shipping guidance, the sub-collections as filters, recipient / colour / material / personalisation facets | LARGE, SMALL |
| **T5** Made to order vs ready to ship as two facts (today `inStock` carries both) | Tier 03's "Ready to ship" facet | SMALL |
| **T7** Tier-specific imagery (12 manifest rows ungenerated; Higgsfield credits exhausted) | Dramatically different imagery per tier; the room-scale hero | all |
| **T9** Consultation, quote, "request price" and architect/trade enquiry CTAs | `ProductTier.*.secondaryCta` copy with no consumer; an `InquirySource` value the schema does not have | LARGE |
| `festive-pooja` category default | The scraper keyword `pooja` files Memory and the category default files Personal; PR #92's margin rule settles the rows that carry the word, but the category's own default needs the owner's word | MEDIUM/SMALL |
| Competitor imagery posture | The promote path mirrors up to six supplier images into Blob while the briefs say "never re-host"; the CSP `img-src https:` and `remotePatterns` cannot be tightened until mirror coverage is measured (`docs/plan/06` §7) | all |
| Supplier domains in git | 19 sources sit in `seed-data.ts` against the briefs' "no competitor domains in the repo" (`docs/plan/06` §4) | — |
| Locale detection | Both briefs ask for a consent-based switcher instead of the Accept-Language redirect (`src/i18n/routing.ts:23`); a product decision as much as a code change | all |

## 3. Buildable now — no decision needed, by tier

### LARGE — Collectible Furniture & Spatial Art
- **The collectible card in every grid.** `cardVariantFor` has no grid caller;
  a LARGE piece in `/shop` renders the ordinary card. Pass the variant from
  `sizeTier` in `shop-explorer.tsx` (audit: three-tier brief, Card system).
- **A scale diagram** on `/large-resin-art` (dimension bands the studio makes)
  and an in-page brief-intake form instead of a CTA to `/custom-order`.
- **Download specifications** — a spec sheet as a file from the PDP's spec
  table.
- **Adapters for the LARGE references without one**: Draga & Aurel, Materia
  Aurea and WITHIN need a markup shape the JSON-LD adapter does not recognise
  (the local run read 18 sitemap pages of Draga & Aurel and extracted
  nothing); Scarlet Splendour needs a browser, which the policy forbids.
- **Geometry in millimetres** — the parser `embedding.ts` waits for; LARGE is
  the tier where dimensions decide everything.

### MEDIUM — Memory & Celebration Art
- **The memory card variant** (`card-meta.ts` still resolves MEDIUM to
  `full`): occasion / preservation type, size, customizable indicator,
  Preserve / Customize CTA — the collectible card is the template.
- **A "customizable" badge** on category pages and the card.
- **Preservation copy** on the category page and PDP that a first-time
  customer understands (the explainer is T4's; a copy slot per category is
  not).
- **Before/after data** — the slider is built; one real case with
  `beforeImageUrl` renders it.

### SMALL — Personal Art & Gifting
- **The gift card variant**: variant chips on the card (built in `shop.ts`,
  consumed only by search and the PDP), a personalizable indicator, price and
  quick view.
- **`OCCASIONS` is a code constant** covering 4 of the brief's 9 seasonal
  collections; add Raksha Bandhan, Valentine's Day, Mother's Day, Father's
  Day (facet + custom-order select, one file).
- **Gift packaging** as a per-product SELECT field template.
- "Best sellers" has no data behind it (orders close on WhatsApp);
  `featured` is the honest stand-in.

### All tiers — storefront
- Consent-based locale switcher (see §2, a decision first).
- CI does not sweep 768 / 1024 / 1920; Lighthouse perf floor is 85, the
  briefs say 90; no numeric LCP/CLS budget.
- A completion state after the custom-order submit is refused by Part 14
  (decorative motion) — not needed.

### Studio
- **A Studio button to restore the owner's own Tier-1 rows**: clear their
  tombstones and run the Tier-1 fill (see §1).
- **`maxProducts` has no Studio control** — the rollout sets it (500); the
  source detail page should show and edit it beside the politeness delay.
- **`NormalizationAlias` has no writer** — the read-time resolver works, but
  no action or screen creates alias rows; `/studio/scraper/mapping` is a
  report.
- **Export Center**: a builder (entity, columns, filters), dry-run preview,
  run history, an `ActivityLog` row per download, an inquiry export, PDF
  output for the comparison / opportunity boards.
- Explorer: resin-attribute FILTERS (materials, wood, pigment, dimensions are
  columns only); similarity explanation chips beside the bare %; a dedicated
  compare screen; per-source scheduling; a "changed since" inbox filter;
  saved views beyond the products list; feature flags and a docs viewer; a
  virtualised products table; a Higgsfield screen (credits exhausted, so no
  runs to show).

### Scraper and data contract (`docs/plan/02`, deferred on purpose)
- Canonical family / type, the 18-value resin-style vocabulary, structured
  materials (species, live-edge, base, substrate, inclusions), finish claims,
  production flags (MTO / one-of-one / limited / customizable), MOQ, rating,
  currency → INR FX snapshots, per-field provenance, taxonomy confidence and
  a mapping review queue.
- Analytics modules beyond the two views (assortment, price architecture,
  dimension, material, design language, production mix, promotion); the
  other four opportunity components (Rivya gap, distinctiveness,
  feasibility, admin weight).
- Source metadata (type, cadence, concurrency), per-source category-tree
  enable, CAPTCHA / paywall detection with an immediate stop, a labelled
  precision@k evaluation set, an adapter snapshot-regression suite.

### Hygiene (one-line PRs)
- `src/ResinRivaFavicon.svg`, `src/ResinRivaLogo.svg` (zero importers).
- Dead `CONFIRMED_SHEET_TAB` and "Google Sheet" wording in
  `src/lib/scraper/confirm.ts`.
- Stale "Neon" comments in `scripts/db-preflight.mjs`.
- A CI grep that fails if Google Sheets code returns; a redirect or notice
  on the old `/studio/scraper/sheets` bookmark; `301`s for removed catalogue
  pages.
- One-line "superseded" headers on `QA/11-GOOGLE-SHEETS-AUDIT.md` and
  `docs/prompts/scraper-studio-sheets-master-prompt.md`.
- `docs/design/COMPONENT_REGISTRY.md` (empty by construction, the rule
  unrecorded); runbooks for a failed export and concept-media misuse;
  `docs/data-normalization-resin.md`.

## 4. Explicitly NOT needed — refused or superseded by a recorded rule

Cart, checkout, customer accounts, payment gateways (Part 0 / T1). The gold
palette, glassmorphism, foil, glow, 3D slab hero, splash cursor, magnetic
buttons, split-text reveals, marquee, border-beam cards, pinned galleries,
section wipes and every third-party component pack (contract §2/§5/§8, D18,
D29, the 49 KB motion budget). Supabase, Cloudinary, Neon, `app/(studio)`,
`research_*`, `--rv-*` tokens, the older repo's slugs and docs (`docs/plan/06`
§1). A third role (§1.1). The 15-source starter pack and Etsy (the owner's
own list and the ten reference sites stand instead). Anything Google Sheets.
Order-status lookup by phone (a customer-facing account feature §1.1 keeps
off-limits). The full audit tables record each one with its rule.
