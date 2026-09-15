# The three-tier product architecture

Supplied by the owner on 2026-09-15 and **in force**. It is not a category
filter: the three tiers are three different customer intents, price ladders,
customization depths and interface densities, and the plan is that they share
one brand language rather than becoming three websites.

    SMALL OBJECT  →  PERSONAL MEMORY  →  COLLECTIBLE ART

| Internal | Customer-facing | Typical work | Buying flow |
|---|---|---|---|
| `LARGE_FORMAT` | Collectible Furniture & Spatial Art | Dining/coffee/side/console tables, seating, benches, large wall panels, sculptures, architectural installations | Explore → View Project → Customize → Consultation / Request Quote |
| `MEDIUM_FORMAT` | Memory & Celebration Art | Varmala & bouquet preservation, wall clocks, engagement/ring trays, invitation preservation, wedding frames, nameplates, baby keepsakes | Choose Style → Size → Upload Memory → Customize → Order |
| `SMALL_FORMAT` | Personal Art & Gifting | Rakhi, jewellery, keychains, bookmarks, coasters, magnets, desk pieces, festive and corporate gifting | Browse → Personalize → Order |

**"Tier 1/2/3" is internal vocabulary.** It belongs in the database and the
Studio. Customers see the names in column two.

---

## ⚠️ One part of the brief conflicts with Part 0, and Part 0 wins

The brief's Tier 03 flow says **"Add to Cart / Checkout"** and lists checkout as
a primary action. `CLAUDE.md`'s HARD RULES — which state that REDESIGN.md §1.1
and Part 0 win all conflicts — say the opposite, in three separate clauses:

- NO payment gateway, online checkout, or cart payment.
- NO customer login, membership or accounts.
- **Every order finalizes through WhatsApp**: Place Order → order summary →
  `Inquiry` row via Server Action → `wa.me/917096036250` with the message
  pre-filled.

So Tier 03 is built as **fast ordering, not fast checkout**: variant choice and
personalization stay quick and low-friction, and the terminal action is the
WhatsApp order flow this site already has. Everything else in the Tier 03
section — speed, discoverability by occasion/recipient/festival, price
visibility, seasonal collections — is adopted unchanged.

If the owner wants real checkout, that is a change to Part 0 and has to be made
there first; it is not a thing to slip in under a tier redesign.

---

## What each tier changes in the interface

Shared design foundation, **tier-specific variants** — not three disconnected
templates and not one template pretending three products are alike.

    <ProductGallery variant="collectible" | "memory" | "gift" />

- **Large** — editorial/gallery layout, few items per screen, full-bleed and
  macro photography, dimensions, materials, edition and lead time, craft story.
  Price may be a figure, a "from", or Price on Request; a bespoke piece must not
  be forced into an Add-to-Cart shape.
- **Medium** — guided customization is the whole product. Occasion, names, date,
  dimensions, colours, typography, uploads (photo, wedding card, references),
  and a visible 7-step path from choosing a piece to confirming the order, plus
  an explanation of how a physical flower becomes finished resin: pickup,
  preservation, design confirmation, casting, curing, finishing, QC, delivery.
- **Small** — efficient grid, quick personalization, variants, price visible,
  festival collections.

## Homepage and navigation

One band introducing the three worlds — *three scales, one artistic language* —
with deliberately different photography per tier (architectural / intimate /
tactile) inside one design system. Navigation follows large → medium → small:
Collectible Design · Memory Art · Personal Art & Gifts · Custom Commission.

## Studio

Every product carries a tier, movable without a deploy: that is `Product.sizeTier`,
a nullable `ProductSizeTier` enum set from the product form and changeable per
product by the owner, with a bulk action for the backlog.

**Nullable, and refused on PUBLISH rather than on save** — because three writers
create products without passing that form (the scraper's promote, Bulk Import,
and `tier-fill.ts` on every deploy), so a `NOT NULL DEFAULT` would both break
backward compatibility and invent the answer. "Mandatory" is earned by the
Studio refusing to publish an untiered product, not by the column type.

The brief also asks for seven further structured fields — finish, price type,
fulfilment, personalization type, commission and preservation flags, edition.
Those are **T3** in the conflict table below: §1.1 lists product data first under
do-not-change, and this document authorizes `sizeTier`, not a schema of its own.
Product type, dimensions, material, lead time and occasion already exist.

## Scraper

The classifier **suggests** a tier from title, description, type, dimensions and
category — dining table → LARGE, varmala preservation → MEDIUM, rakhi → SMALL —
and an administrator can always override it. Nothing scraped publishes without
passing the existing review/approval workflow. `ScrapeSource.tier` (this repo's
`ScrapeTier` enum) already carries the same three values for sources, shipped
2026-09-15.

**A source's tier and a product's tier are different columns and must stay so.**
`ScrapeTier` says where we went looking; `Product.sizeTier` says what a piece is.
A large-format supplier sells small pieces too, and `TIER_NUMBER` in `purge.ts`
maps the four OLD `ScrapeTier` values onto `Product.tier`, the catalog-fill
integer — which is exactly why the three size values map onto NULL there.

## Reference sites

Owner-supplied, for **principles, not duplication**. All ten are registered in
`seed-data.ts` under their tier, `enabled: false` and
`policyReviewStatus: PENDING`, so the governance gate refuses to collect any of
them until a human records a review. Reading a site for art direction and
crawling its catalogue are different acts; only the second needs that review.

| Tier | Site | Study for |
|---|---|---|
| Large | Draga & Aurel · Materia Aurea | Collectible resin furniture, material storytelling, commission presentation |
| Large | Scarlet Splendour · WITHIN | Indian luxury collectible furniture, editorial art direction |
| Large | Korepox Arts | Epoxy tables, bespoke furniture, consultation-led selling |
| Medium | VEDUMI · The Art Galaxy · Radhika Art | Varmala preservation, clocks, engagement trays, emotional storytelling |
| Small | Dinosaur Designs | Resin jewellery → homewares under one premium identity |
| Small | Resin Art Store India | Rakhi, jewellery, coasters, small-product taxonomy |

---


## What a survey of the code found, and what it changed

Before any of this was built, eleven read-only agents mapped every surface the
brief touches and a twelfth was asked what they had missed. Three findings
changed the plan; they are recorded here because the reasons outlive them.

### 1. `Product.tier` is taken, and it means something else

`schema.prisma:113` declares `tier Int?` — **"Owner-sheet tier (1 owner · 2
resin goods · 3 supplies · 4 3D-print)"**, indexed as `@@index([tier, status])`,
written by the catalog-fill importer from `data/tiers/*.csv.gz`, and read in ten
places including `shop.ts:189`'s DEFAULT SORT, `search-query.ts:129-133`,
`groupForTier` in `catalog-taxonomy.ts`, the Bulk Import validator, the
confirmed-products export and the demo fixtures' zod shape.

So an earlier draft of the sequence below — *"`Product.tier` as the three-value
taxonomy"* — could not be built. Taking that name over is a **retype of an
indexed integer column that live queries sort on**, which `CLAUDE.md` classes as
unsafe and which reaches production on push.

**The size taxonomy therefore lands on a new column, `sizeTier`,** a nullable
`ProductSizeTier` enum. `sizeTier` is the repo's own word for it already
(`purge.ts`, the `ScrapeTier` doc comment). The two columns coexist: `tier` is
where a product CAME FROM, `sizeTier` is what it IS.

### 2. Nothing pointed at this document

`docs/plan/README.md` — the index — contained no reference to this file, and
`AGENTS.md`, `README.md` and `PROJECT_STATE.md` contained no reference to
`docs/plan` at all. The brief was reachable only from `CLAUDE.md`. That is why
step 0 below is docs and no code: an architecture nobody can find is built
wrong by the next reader, human or agent.

### 3. Three writers bypass the Studio, so "mandatory" is a claim to earn

The brief says every product carries a mandatory tier. Three paths create
products without passing the product form: the scraper's promote
(`scraper-review.ts`), Bulk Import (`actions/import.ts`), and `tier-fill.ts`,
which runs on EVERY DEPLOY from `bootstrap.ts` over thousands of rows. A
`NOT NULL DEFAULT` to force the field would break the
backward-compatibility rule and invent data at the same time. So the column is
**nullable, refused on PUBLISH rather than on save**, and step 2 exists to make
the untiered backlog visible and bulk-fixable.

---

## Conflicts that need an owner decision

Recorded rather than resolved, because each one overrides a rule the owner set.
Work below them proceeds; these are the parts that stop at a question.

| # | The brief asks for | What it overrides | Status |
|---|---|---|---|
| **T1** | Tier 03 "Add to Cart / Checkout" | Part 0: no payment gateway, no cart payment, no accounts | **RESOLVED — Part 0 wins.** Tier 03 is fast ORDERING through WhatsApp. See above. |
| **T2** | Header nav: Collectible Design · Memory Art · Personal Art & Gifts · Custom Commission | REDESIGN.md §5.2 names the four items (Shop · Bespoke · Studio · Journal) and `e2e-smoke.mjs` asserts them BY LABEL | Open. A four-item swap is a §5.2 change plus a smoke-test change. |
| **T3** | Seven new structured product fields (finish, price type, fulfilment, personalization type, commission flag, preservation flag, edition) | REDESIGN.md §1.1 lists "product data" first under do-not-change | Open. `sizeTier` alone is justified by this document; seven more fields is a separate authorization. |
| **T4** | Tier 02's "Upload Memory" and its 7-step guided path | §1.1 names "customization logic" and "image upload" under do-not-change; the e2e smoke asserts the current PDP → `wa.me` round trip | Open, and the largest piece of work in the brief. |
| **T5** | "Made-to-order vs ready-to-ship" as a new field | `Product.inStock` ALREADY means made-to-order on the card (`card.madeToOrder` renders when `inStock` is true) | Two columns for one fact. Use the existing one. |
| **T6** | "Price on request" as a price type | The PDP emits `AggregateOffer` JSON-LD for every non-demo row, and `formatPriceBand` returns a hardcoded English `"Enquire"` outside next-intl | Open. Both are real defects to fix before a tier can select this. |
| **T7** | Deliberately different photography per tier | 78 image slots share 25 files today; the tier sets are ungenerated and the Higgsfield workspace is out of credits | Blocked on assets, not on code. |
| **T8** | A homepage "three worlds" band | §3.1 (max three dark bands, never adjacent — the homepage already declares exactly three) and the §6 record that a "three studios" block was DELETED for competing with the collections band | Open. The band has to REPLACE something, not be added. |
| **T9** | LARGE's "Consultation / Request Quote" | `InquirySource` is exactly `PRODUCT \| CUSTOM_ORDER \| CONTACT`; `Inquiry` has no scheduling and no priority column | Open. The CTA promises a record the schema cannot hold. |
| **T10** | A `/collectible-design` destination | `/large-resin-art` already exists — 846 lines, a sections-board entry, a footer link, a sitemap entry and a 64-key × 9-locale namespace. §1.1 protects existing URLs | Use the route that exists. A rename is worse than a duplicate. |
| **T11** | "Movable without a deploy" | A slug map is deploy-bound; a per-product column leaves owner-created categories untiered | The column is the closer of the two, and step 2 is what makes it true in practice. |

---

## Sequence

This is a workstream, not a pull request. Ordered so each step is useful alone,
nothing renders a tier it cannot yet populate, and no step ships a column
without the thing that writes it.

0. **Docs, no code.** Index this file where the entry points can reach it —
   `docs/plan/README.md`, `AGENTS.md`'s reading table, `README.md`'s
   documentation table, `PROJECT_STATE.md`'s checkpoint. Done, 2026-09-15.
1. **`ScrapeTier` gains the three size values** — done, 2026-09-15, with the ten
   reference sources filed under them.
2. **`Product.sizeTier`, with its Studio control, and no storefront consumer.**
   A hand-written additive migration: `CREATE TYPE "ProductSizeTier"`, a
   nullable column, `CREATE INDEX "Product_sizeTier_status_idx"`. **Never
   `prisma migrate diff`** — it re-proposes dropping the three trgm search
   indexes, which `schema.prisma` does not model. **No backfill statement**: it
   would run against production on push, before any screen exists to check it.
   The control ships in the same PR, because a column with no writer is a
   defect. Refused on PUBLISH, not on save.
3. **Make the untiered backlog visible and bulk-fixable, before anything renders
   it.** A `sizeTier` filter with an explicit "No tier yet" option on the product
   list, a bulk action in the shape of `setProductsCategory`, a
   `/studio/content-gaps` card — plus the two writers the Studio guard cannot
   reach: a Bulk Import column and the matching export column, both or neither.
4. **Demo fixtures.** `sizeTier` across all 100 rows of
   `prisma/fixtures/demo/products.json` and the zod shape in `demo/fixtures.ts`,
   spread so at least a LARGE and a SMALL land on audited demo detail routes.
   **Before step 6**, or every tier variant ships unseen by every CI gate.
5. **Copy, nine locales, one nested block.** `scripts/i18n-merge.mjs` with no
   `--partial`, then `npm run copy:registry`. Before any component, because
   `i18n-missing.mjs --stale` turns every later rewording into a nine-file edit.
6. **Scraper classification, pure and read-only.** Suggest a tier from title,
   description, type, dimensions and category — dining table → LARGE, varmala
   preservation → MEDIUM, rakhi → SMALL — in the shape of `category-map.ts`
   (weighted scoring, `null` when nothing scores), read at request time beside
   the existing `matchCategoryId` call. No column of its own until it earns one.
   An administrator always overrides; nothing publishes without the existing
   review/approval workflow.
7. **The first card variant, on `/large-resin-art`** — already tier-homogeneous
   and hand-rolling its own tile, so the variant DELETES a duplicate. Branch in a
   pure module (`card-meta.ts`): there is no component-test runner here, so a
   branch living in JSX is permanently untestable.
8. **PDP copy presets** through the existing `oosCopy` mechanism, which already
   proves server-resolved copy can reframe the CTA, the summary and the WhatsApp
   intro with a byte-identical payload → **shop facet** (all five places it must
   be registered, or it drops on page 2) → **navigation** (T2) → **homepage band**
   (T8) → **Tier 02's guided path** (T4), the largest single piece.

Two corrections to the brief's own ordering, both from the survey: **search must
be handled at step 2, not never** — `search-query.ts:129-133` already sorts on
`tier` under a comment a reader will take as covering the new column — and the
**Inquiry/analytics shape has to be settled before step 8**, because Tier 02's
guided path produces exactly the selection lines `buildOrderMessage` refuses to
truncate under `MAX_ORDER_MESSAGE_CHARS`.

Steps 7–8 are REDESIGN.md territory and must be read against it first. §1.1's
"visual layer only" constraint does not forbid this work — D26 scoped an
exception and this document is its own authorization for `sizeTier` — but every
field beyond `sizeTier` is T3, and stops at a question.
