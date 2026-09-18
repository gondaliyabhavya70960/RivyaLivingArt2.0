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


### Verified 2026-09-16 — what each site actually yields

Every reference site (and every automatable source on the owner's own list)
was run through this repository's scraper locally — `fingerprint()`, then a
full job — before the rollout listed it. The registry (`seed-data.ts`) carries
the verified platform and the finding on each row; `backlog-rollout.ts`
carries the review and the evidence.

| Site | Tier | Platform | Staged locally | Filed as |
| --- | --- | --- | ---: | --- |
| Korepox Arts | LARGE | WooCommerce | 9 | rollout |
| Draga & Aurel · Materia Aurea · Scarlet Splendour · WITHIN | LARGE | none usable | 0 | manual research (design references) |
| Radhika Art | MEDIUM | JSON-LD | 148 | rollout |
| VEDUMI · The Art Galaxy | MEDIUM | none usable | 0 | manual research |
| Dinosaur Designs | SMALL | Shopify | 331 | rollout (a reference with foreign prices — the review queue decides) |
| Resin Art Store India | SMALL | WooCommerce | 31 | rollout |
| Saashi · Leoberry Gifts · Kanha Kreation · WoodenSure · Resin Arts Jaipur | owner's list | WooCommerce / JSON-LD | 338 · 210 · 151 · 146 · 22 | rollout |
| The owner's previous store (`store.bhavyagondaliya.co.in`) | owner's list | HTTP 402 | — | manual research; its rows are `data/tiers/Tier1_Owner.csv.gz` |

1,386 rows; by step 6's suggestion 174 Collectible · 452 Memory · 596
Personal · 164 unsure. The LARGE minimum is met only through the owner's own
list; the brief's Tier 01 references are design references with nothing to
collect.

**Status of this document's own asks** — every requirement checked against
HEAD on 2026-09-16 is in `docs/audits/2026-09-16/three-tier-brief.md` (127
rows: 61 done · 38 partial · 13 not done · 13 tabled on T2–T9 · 1 refused by
Part 0); what is buildable now and what waits on an owner answer is in
`docs/NEEDED-WORK.md` §2–§3, tier by tier.

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

**Reviewed 2026-09-18 on the owner's instruction to "address the owner
inquiries (T2–T11)".** Six rows closed, one half-closed, three still an owner's
call. The rule applied: **a row closes when spec precedence settles it, or when
the thing it asks for turns out to already exist.** Nothing that breaches Part 0
was built or decided here — those carry a recommendation and stay open, which is
what "needs an owner decision" means. The reasoning for each close is below the
table; the recommendations for the three open rows are below that.

| # | The brief asks for | What it overrides | Status |
|---|---|---|---|
| **T1** | Tier 03 "Add to Cart / Checkout" | Part 0: no payment gateway, no cart payment, no accounts | **RESOLVED — Part 0 wins.** Tier 03 is fast ORDERING through WhatsApp. See above. |
| **T2** | Header nav: Collectible Design · Memory Art · Personal Art & Gifts · Custom Commission | REDESIGN.md §5.2 names the four items (Shop · Bespoke · Studio · Journal) and `e2e-smoke.mjs` asserts them BY LABEL | **CLOSED 2026-09-18 — §5.2 wins.** The four items stand. The brief's intent is reachable without touching them; see the recommendation below. |
| **T3** | Seven new structured product fields (finish, price type, fulfilment, personalization type, commission flag, preservation flag, edition) | REDESIGN.md §1.1 lists "product data" first under do-not-change | **CLOSED 2026-09-18 — no column is needed.** All seven already exist as a column, a model or an owner-controlled `lexical`/`occasions` row. Mapping below. |
| **T4** | Tier 02's "Upload Memory" and its 7-step guided path | §1.1 names "customization logic" and "image upload" under do-not-change; the e2e smoke asserts the current PDP → `wa.me` round trip | Open, and the largest piece of work in the brief. |
| **T5** | "Made-to-order vs ready-to-ship" as a new field | `Product.inStock` ALREADY means made-to-order on the card (`card.madeToOrder` renders when `inStock` is true) | **CLOSED 2026-09-18 — use `inStock`.** Two columns for one fact. `collectibleCardMeta` already reads it as `availability`. |
| **T6** | "Price on request" as a price type | The PDP emits `AggregateOffer` JSON-LD for every non-demo row, and `formatPriceBand` returns a hardcoded English `"Enquire"` outside next-intl | **Half closed (2026-09-16).** The `"Enquire"` leak is fixed at every storefront site (hero, summary, card); `showPrice: false` already yields the localized "price on request" and suppresses the JSON-LD offer. A price TYPE field was the rest of T3 — now **CLOSED 2026-09-18** (`showPrice` IS the price type), so this row closes with it. |
| **T7** | Deliberately different photography per tier | 78 image slots share 25 files today; the tier sets are ungenerated and the Higgsfield workspace is out of credits | Open — but **not a decision**. Blocked on assets, not on code or on an answer. Nothing to close until there are files. |
| **T8** | A homepage "three worlds" band | §3.1 (max three dark bands, never adjacent — the homepage already declares exactly three) and the §6 record that a "three studios" block was DELETED for competing with the collections band | Open — an owner's call. The band has to REPLACE something, not be added; a recommendation is below. |
| **T9** | LARGE's "Consultation / Request Quote" | `InquirySource` is exactly `PRODUCT \| CUSTOM_ORDER \| CONTACT`; `Inquiry` has no scheduling and no priority column | **HALF CLOSED 2026-09-18.** "Request Quote" closes — it is a copy variant of an existing CTA over an existing record. "Consultation" stays open: it promises scheduling the schema cannot hold. |
| **T10** | A `/collectible-design` destination | `/large-resin-art` already exists — 846 lines, a sections-board entry, a footer link, a sitemap entry and a 64-key × 9-locale namespace. §1.1 protects existing URLs | **CLOSED 2026-09-18 — use `/large-resin-art`.** §1.1 protects the URL; a rename is worse than a duplicate and a duplicate splits the index. |
| **T11** | "Movable without a deploy" | A slug map is deploy-bound; a per-product column leaves owner-created categories untiered | **CLOSED 2026-09-18 — DELIVERED, not decided.** `Product.sizeTier` shipped 2026-09-15; it is per-product, the Studio's product form edits it, and no deploy is involved. |

### Why each closed row closed (2026-09-18)

**T2 — the four header items stand.** REDESIGN.md §5.2 names them, Part 0 says
REDESIGN.md wins every conflict, so this is settled by precedence and not by
preference. Two facts make the swap worse than it looks: `e2e-smoke.mjs`
asserts the four BY LABEL, so the nav is a contract test, not a style choice;
and the proposed items are four INTENTS where the current four are a shop, a
commission path, a story and a journal — replacing them would leave no header
route to Bespoke, Studio or Journal at all.

**T3 — nothing needs a column.** This is the expensive one to have got wrong,
because it is a seven-column migration onto a live, indexed table that would
reach production on push. All seven already have a home:

| The brief's field | Where it already lives |
|---|---|
| finish | `Product.lexical` — the owner's own labelled spec rows ("Finish · Hand-polished"), editable in the product form |
| price type | `Product.showPrice` + `priceMin`/`priceMax`. False yields the localized "price on request" and suppresses the JSON-LD offer — that IS the type (T6) |
| fulfilment | `Product.inStock` — reads as "Made to order" on the card (T5) |
| personalization type | `CustomizationField` — a whole per-product model with a `FieldType` enum, `options`, `required` and `order` |
| commission flag | Derived, already: `hasCustomFields` drives the PDP's `orderFramingKey` between `ctaCustomize` and `ctaOrder`. A piece with customization fields IS the commission path |
| preservation flag | `Category` (`varmala-preservation`, `wedding-photo-frames`) plus `Product.occasions` |
| edition | `Product.lexical`, same as finish |

A column would not add expressiveness here; it would add a second place for
each fact to disagree with the first. `Product.tier` versus `Product.sizeTier`
is what that costs, and this document already carries the scar.

**T5 — `inStock` is the fulfilment fact.** `collectibleCardMeta` reads it as
`availability` and the card renders `card.madeToOrder` from it. A second column
would let a row say "ready to ship" and "out of stock" at once.

**T6 — `showPrice` is the price type.** The `"Enquire"` leak was fixed at every
storefront site on 2026-09-16; the only thing left in this row was a price TYPE
field, which was T3, which is now closed.

**T9's "Request Quote" half.** The PDP already picks its CTA framing —
`orderFramingKey = hasCustomFields ? "ctaCustomize" : "ctaOrder"`. A LARGE piece
with `showPrice: false` already shows "price on request", so "Request Quote" is
a third framing key over the record that already exists: an `Inquiry` with
`source: PRODUCT`, saved before the `wa.me` redirect. No schema moves. What does
NOT close is **"Consultation"** — booking a time is scheduling, `Inquiry` has no
slot, no calendar and no priority column, and a CTA that promises a record
nothing writes is worse than no CTA.

**T10 — `/large-resin-art` is the route.** §1.1 protects existing URLs. A rename
breaks the footer link, the sections-board entry, the sitemap and 64 keys × 9
locales; a duplicate splits the index against itself.

**T11 — already delivered.** `Product.sizeTier` shipped 2026-09-15: per product,
nullable, edited in the Studio's product form, with `catalog-size-tier.ts`
filing the untiered backlog by rule and a **Suggest tiers** button on
`/studio/products`. Moving a piece between tiers is a save, not a deploy. This
row was a design question before the column existed and is a statement of fact
after it.

### Step 8 shipped the memory and gift cards — and found the wiring missing

`cardVariantFor` existed from step 7 and **nothing called it.** The shop grid
asked `shelfVariant` only, and `collectible` reached the screen through one
hand-passed `variant="collectible"` prop on the large-format page's band. A
variant nobody asks for is the unmounted-component problem owner decision D18
is actually about, so step 8 is two things: the two new variants, and the
branch that reaches all three.

**The wiring keeps §4.6's rule by splitting one word into two.** The shelf
still decides the RATIO once per grid — that is what stops a 1:1 tile sitting
beside a 4:5 one — and the tier now decides the CONTENT inside it. Mixing
`collectible`, `memory`, `gift` and `full` in one grid is safe precisely
because none of them is `compact`: all four render the same 4:5 stage.

**`shelfVariant` had to learn that a tiered row is never a part.** Its
"is this a piece?" test was price — under ₹1,000 means a part — which was the
only signal available before `sizeTier` existed. It conflates a ₹8 bezel
finding with a ₹399 resin jhumka. Measured on the catalogue: all 12 published
LARGE_FORMAT rows and 373 of 425 SMALL_FORMAT rows sit under ₹1,000, so the
large-format grid — the editorial tier, by definition — rendered as a dense
supplies shelf, and `gift` could never appear on the tier it was built for.
A row with a `sizeTier` is now a piece whatever it costs; the price heuristic
still decides the untiered ones, which is where the molds and pigments are.
`shelfVariant` moved to `card-meta.ts` in the same change, because it had no
test at all while it lived in a component file the pure-lib suite cannot
import.

**No column was added**, per T3 above. `memory` reads `categoryName`,
`timeline`, `variantChips.length` and the price; `gift` reads the price,
`variantChips.length` and `inStock`. The one new string is
`Shop.card.choicesCount`, in all nine locales.

**The choice count is a NUMBER, deliberately.** `variantChips` holds strings
built in `shop.ts` as hardcoded English — "Colours +3", "Sizes S/M/L" — and
rendered nowhere before this. Painting them on a card would have put English
on the shop grid in nine languages.

### The three still open, and what is recommended

**T4 — Tier 02's "Upload Memory" and its 7-step guided path.** Still the largest
piece in the brief and still an owner's call: §1.1 names "customization logic"
and "image upload" under do-not-change, and the e2e smoke asserts the current
PDP → `wa.me` round trip. *Recommendation:* if it is wanted, build it as a
SEPARATE route rather than as a change to the PDP — the existing custom-brief
page already uploads reference images through `uploadReferenceImages` and
already ends at WhatsApp, so a guided path is a new entry point onto a flow that
exists, and the PDP's round trip stays untouched and still asserted.

**T7 — photography per tier.** Not a decision; blocked on files. The Higgsfield
workspace is out of credits and the tier sets are ungenerated, so nothing here
can be answered by choosing. *Recommendation:* leave it until there are assets;
`media-v3-fetch.mjs --planned` is the queue.

**T8 — a homepage "three worlds" band.** Still an owner's call, for the reason
recorded: §3.1 caps the homepage at three dark bands, never adjacent, and it
already declares exactly three — so this band must REPLACE something. The sharper
objection is the §6 record that a "three studios" block was DELETED for competing
with the collections band, and a three-worlds band is that block under a new
name. *Recommendation:* do not add a band. Make the **existing collections band**
tier-aware instead — it is `bg-mineral`, it already occupies the slot, and the
three tiers are what it is trying to say. That spends no dark band, replaces
nothing, and does not re-create a block the site removed on purpose.

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
2. **`Product.sizeTier`, with its Studio control, and no storefront consumer** —
   done, 2026-09-15. A hand-written additive migration: `CREATE TYPE
   "ProductSizeTier"`, a nullable column, `CREATE INDEX
   "Product_sizeTier_status_idx"`, and **no backfill statement** — it would run
   against production on push, before any screen existed to check it. (`prisma
   migrate diff` was not used to write it and must not be: it re-proposes
   dropping the three trgm search indexes, which `schema.prisma` does not
   model.) The control shipped in the same PR, in Essentials, because a column
   with no writer is a defect.

   **The refusal is scoped to the publish TRANSITION, not the state**, and that
   is the difference between a guardrail and a lockout: the column is new, so
   every one of the ~4,385 rows already in the catalogue is untiered, and
   refusing every save of an already-published product would stop the owner
   editing any of them with no bulk tool yet built. Nothing NEW goes live
   untiered; what is already live keeps saving. Both the product form and the
   bulk status action apply it, and the bulk toast names the reason.

   Also here: the old `Product.tier` control is relabelled **"Import tier"** —
   and, since 2026-09-17, **"Import list"**: the word "tier" is the product
   tier's alone now (`src/lib/import-list.ts`).
   Two selects on one page both called "Tier" is a question an owner should
   never have to answer twice.
3. **Make the untiered backlog visible and bulk-fixable, before anything renders
   it** — done, 2026-09-15. A `sizeTier` filter whose FIRST option is
   "No tier yet" (the backlog is the default state of a catalogue this column
   arrived after, so a filter that could only select the three tiers would show
   the owner everything already done and nothing left to do); a bulk
   **Set product tier** in the shape of `setProductsCategory`, deliberately with
   no "— none" (un-tiering thousands of rows on one misclick is not a
   correction anyone asked for, and the product form clears the one row where
   it is); a `/studio/content-gaps` card counting the whole backlog, not just
   published rows, linking straight to `?sizeTier=NONE&status=ALL`; a
   **Product tier** column beside the renamed **Import list** one (it read
   "Import tier" for two days).

   And the two writers the Studio guard cannot reach, both: a `product_tier`
   Bulk Import column and the matching export column. `parseSizeTierCell` takes
   the short word as well as the enum name, because the person filling it in is
   in a spreadsheet and `MEDIUM_FORMAT` is a database identifier. An EMPTY cell
   means "no opinion" and is omitted from the write — the same rule `in_stock`
   already follows — so re-importing an older export never un-tiers a product.

   **This is where the table ran out of room.** A twelfth column pushed
   `/studio/products` to 1450px in a 1440px viewport and the studio audit
   failed the route. Eight pixels off each tier column's trailing padding is
   the whole margin; a thirteenth column needs a real answer, not more shaving.
   **The backlog itself — worked by rule, 2026-09-16.** A row at a time was
   never a plan for ~4,385 rows, and the CSV fill creates PUBLISHED rows on
   every deploy that the publish refusal cannot reach. `src/lib/catalog-size-tier.ts`
   (pure) decides a row from two things and refuses on a third: the owner's
   own category (the brief's "typical work" column, slug by slug, in
   `CATEGORY_SIZE_TIER` — Resin Home Decor, Resin Vases and Kids Room Decor
   deliberately have no default); step 6's vocabulary over the title,
   description and dimensions, which outranks the category only when it is
   decisive (6: a form-factor word in the title, or a ≥ 60 cm side) AND beats
   the category's own tier by that margin ("Candle Bouquet" under candle
   holders carries a word for each side, and the owner's filing settles it;
   "Engagement Ring Tray" under keychains carries none for Personal, and
   moves); and a supply guard — `SUPPLY_CATEGORY_SLUGS` plus a title list of
   molds, pigments, hardeners, clock hands, bezels, beads, "40gms", "100 Pcs"
   — because ~3,500 of the rows are not pieces at all and there is no fourth
   tier for "not a piece" (that is a T-question). The category NAME is never
   scored (it double-counted the filing), Collectible is never decided on a
   weak word (the collectible card is the costliest wrong render), and a tie
   or a title that says nothing about form stays for a person.

   The write side (`catalog-size-tier-backfill.ts`) touches only `sizeTier IS
   NULL` rows that are not `ownerTouched` and not demo, re-checks null per row
   on apply, and records one `ActivityLog` row (`size-tier-suggest`). Two
   callers: `prisma/suggest-size-tiers.ts`, run by `bootstrap.ts` right after
   the CSV fill on production and local builds and **skipped on preview
   builds** — a preview runs against production, and a classification a
   person may want to see first lands with the merge, not the push; and the
   Studio's **Suggest tiers** button on `/studio/products`, which shows the
   plan (counts and sample titles per tier, what stays untiered and why)
   before **File** writes it.

   Measured on the local mirror: 4,385 untiered → 567 filed (13 Collectible ·
   125 Memory · 429 Personal), 3,484 supplies left untiered on purpose (2,996
   by category, 488 by title), 334 for a person through "No tier yet" —
   nearly all Resin Home Decor rows whose titles say nothing ("Get Well
   Soon!", "Round placemats"). The shop drawer's Scale section stays where
   step 8 left it, last and closed; promoting it is the owner's call once
   that list is worked.
4. **Demo fixtures** — done, 2026-09-16. `sizeTier` on the zod shape (from
   `PRODUCT_SIZE_TIERS`, so a fourth enum value fails the vocabulary test
   before any fixture changes), on the loader, and on all 100 rows: 52 LARGE ·
   12 MEDIUM · 34 SMALL, filed by what the piece IS off its editorial name
   rather than its fixture category (batch G's generator paired them
   loosely). The two workshop sessions are null on purpose — a session is not
   a piece, and step 6's classifier returns null for one too. Every tier lands
   on a PUBLISHED row, the E2E PDP is LARGE, and the demo lander's grid
   carries one PUBLISHED piece of each (001 · 006 · 086 · 078) — because
   `/shop/gift-collections` cannot carry a demo row (no seeded category maps
   to it), the lander is where MEDIUM and SMALL are audited.
5. **Copy, nine locales, one nested block** — done, 2026-09-16.
   `ProductTier.<LARGE_FORMAT|MEDIUM_FORMAT|SMALL_FORMAT>` keyed by the enum
   value, so a consumer writes t(`${tier}.primaryCta`) with no mapping table:
   `name` and `shortName` (pinned byte-for-byte to the studio's own labels by
   `product-size-tier.test.ts`), `promise`, `primaryCta`, `secondaryCta`, and
   from step 8 `orderSummaryNote` and `orderWaIntro`. The same test refuses
   cart/checkout wording in any tier (T1).
6. **Scraper classification, pure and read-only** — done, 2026-09-16.
   `size-tier-suggest.ts`: one home per keyword (a keyword in two tiers is a
   tie by construction and the test refuses it), longest phrase first and
   consumed on match, curated fields double, prose once, one dimension
   heuristic (≥ 60 cm pushes LARGE, ≤ 10 cm pushes SMALL, the band between
   leans MEDIUM under a decisive word; the description is never parsed for a
   size). Nothing scoring → null; a tie → null, the one departure from
   `matchCategoryId`'s first-wins — the operator decides. The source's own
   tier is not an input, and the test fails if `ScrapeTier` enters the code.
   Wired the way the category auto-map is: computed per row on the source
   page, a "Product tier" select defaulting to it with a "suggested" hint,
   carried by the Add-to-catalog dialog, written on create (and on the
   uncurated re-import branch only where the draft has none). Nothing is
   stored on the staged row.
7. **The first card variant, on `/large-resin-art`** — done, 2026-09-16.
   `cardVariantFor` / `collectibleCardMeta` in `card-meta.ts` (tested), a
   `collectible` variant on `CatalogProductCard`, and `large-format.ts` now a
   `CARD_SELECT` consumer with a byte-identical where — the hand-rolled tile is
   gone. The variant is passed by CONTEXT on that page, not read off
   `piece.sizeTier`: the band is tier-homogeneous by its where-clause, and the
   where still classifies by category on purpose (a `sizeTier` clause would
   empty the band until the backlog is worked).
8. **PDP copy presets** — done, 2026-09-16: `tier-order-copy.ts` resolves the
   three fields off `ProductTier.<tier>` (the CTA is the tier's own
   `primaryCta`), `selectOrderCopy` is the one precedence rule the panel and
   the Server Action share (out of stock wins — a fact outranks a framing),
   Tier 03's intro is byte-equal to the default order intro in every locale,
   and the byte-identical payload is a `toBe` on the built message. T6's leak
   (`formatPriceBand`'s English "Enquire" on the hero and the summary when both
   prices are null) is closed at both sites; "price on request" as a tier
   behaviour needs no price type — `showPrice: false` already yields it.
   → **shop facet** — done, 2026-09-16: `?sizeTier=large|medium|small`, derived
   slugs, all five places, the drawer section deliberately last and closed
   until the catalogue is tiered, and the search comment corrected.
   → **navigation** (T2) → **homepage band** (T8) → **Tier 02's guided path**
   (T4), the largest single piece — **all three still stop at their question.**

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
