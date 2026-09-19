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
| The owner's own previous pieces | The 373 rows of `data/tiers/Tier1_Owner.csv.gz` (the owner's previous store) are TOMBSTONED by the purge, so the fill will not bring them back; the previous store itself answers HTTP 402. If they are wanted: clear their tombstones (`DeletedImport` rows with `importSource = "sheet:…"` for List 1) and run the fill for List 1 from `/studio/catalog-fill` — a Studio button for exactly that is buildable (see §3). | `/studio/catalog-fill` |
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
| ~~**T5** Made to order vs ready to ship as two facts~~ | **CLOSED 2026-09-18 — use `inStock`.** Two columns for one fact; `collectibleCardMeta` already reads it as `availability` | SMALL |
| **T7** Tier-specific imagery (12 manifest rows ungenerated; Higgsfield credits exhausted) | Dramatically different imagery per tier; the room-scale hero | all |
| **T9** Consultation CTA (the quote half is closed) | **HALF CLOSED 2026-09-18.** "Request Quote" is a copy variant of the PDP's existing `orderFramingKey` over the `Inquiry` that already exists — no schema moves. **Consultation** stays: booking a time needs a slot, a calendar and a priority column `Inquiry` does not have | LARGE |
| `festive-pooja` category default | The scraper keyword `pooja` files Memory and the category default files Personal; PR #92's margin rule settles the rows that carry the word, but the category's own default needs the owner's word | MEDIUM/SMALL |
| Competitor imagery posture | The promote path mirrors up to six supplier images into Blob while the briefs say "never re-host"; the CSP `img-src https:` and `remotePatterns` cannot be tightened until mirror coverage is measured (`docs/plan/06` §7) | all |
| Supplier domains in git | **The question got bigger on 2026-09-18, and deliberately so.** `seed-data.ts` now carries 23, not 19 — the owner asked for 15 comparators at 5 per size tier, so five were added after a live probe, and the previous store's entry came out. That is the owner's own instruction running against the briefs' "no competitor domains in the repo" (`docs/plan/06` §4), which is exactly the collision this row exists to surface. Nothing was resolved by doing the work: the sources are `enabled: false` + PENDING and collect nothing, and if the answer is "no domains in git" the registry moves to a seeded table and these 23 go with it | — |
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
- **A Studio button to restore the owner's own List 1 rows**: clear their
  tombstones and run the List 1 fill (see §1).
- **The catalog fill could file tiers at write time.** It writes `sizeTier`
  NULL and the deploy-time pass files them afterwards; the screen now shows
  the forecast ("Would file as", the same rule), so writing it in the fill
  is one decision away, not a design.
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
- ~~`src/ResinRivaFavicon.svg`, `src/ResinRivaLogo.svg` (zero importers)~~ —
  **DONE 2026-09-18**, with the two stray root screenshots (`ar-drawer-360.png`,
  `shop-360.png`) that had no reference anywhere either.
- ~~Dead `CONFIRMED_SHEET_TAB` and "Google Sheet" wording in
  `src/lib/scraper/confirm.ts`~~ — **DONE 2026-09-18.** The const had zero
  consumers; the header now says what replaced the spreadsheet.
- ~~Stale "Neon" comments in `scripts/db-preflight.mjs`~~ — **DONE 2026-09-18.**
  The vendor name was wrong (this is Prisma Postgres, which the script prints
  on every build); the mechanism the comments explain is unchanged.
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

## 5. What closed on 2026-09-18/19, and what it left

Appended rather than edited in place: §1–§4 were written against HEAD
`91c93b5` (D24). The dark redesign (PRs #106–#108 and the PR carrying this
section) closed the storefront and Studio design rows and the six system
pages; `docs/COMPLETED-WORK.md` §10 lists them.

**Nothing new is owed by engineering.** What the redesign leaves is the same
two kinds of thing the sections above already name:

- **Owner inputs**, unchanged and still the gate on everything visual: real
  photography (the two maker slots are still AI generations §15.2 forbids),
  testimonials with `permissionStatus: GRANTED`, the address and socials,
  portfolio rows with a `beforeImageUrl` so the before/after slider has data.
  A dark ground does not make an empty catalogue look fuller.
- **Owner decisions**, unchanged: the T2–T11 questions tabled in
  `docs/plan/07-three-tier-architecture.md` — the header's nav items, the
  homepage band, Tier 02's guided path, the seven proposed product fields.

Two smaller things the redesign surfaced and deliberately did not build, both
recorded where they belong rather than here:

- **An unsaved-changes guard for the browser Back button.** The Studio forms
  warn on tab close and on in-app navigation; the history API's back entry is
  not coverable without hijacking the back button, which is worse than the
  problem.
- **A rate-limit rule at the edge.** `/too-many-requests` is built, localized
  and audited, and nothing routes to it on purpose — see DEPLOYMENT.md §13.
  Turning one on is an operations decision, not a build.
