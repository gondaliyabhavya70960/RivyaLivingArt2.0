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

Every product carries a mandatory tier, movable without a deploy, plus the
structured fields the tiers need: product type, dimensions, material, finish,
price type (figure / starting / on request), made-to-order vs ready-to-ship,
lead time, personalization type, commission and preservation flags, occasion,
edition.

## Scraper

The classifier **suggests** a tier from title, description, type, dimensions and
category — dining table → LARGE, varmala preservation → MEDIUM, rakhi → SMALL —
and an administrator can always override it. Nothing scraped publishes without
passing the existing review/approval workflow. `ScrapeSource.tier` (this repo's
`ScrapeTier` enum) already carries the same three values for sources.

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

## Sequence

This is a workstream, not a pull request. Ordered so each step is useful alone
and nothing renders a tier it cannot yet populate.

1. **`ScrapeTier` gains the three size values** — done, 2026-09-15, with the
   ten reference sources filed under them.
2. **`Product.tier` as the three-value taxonomy, and the Studio field that sets
   it.** The schema change is additive; the Studio control is what makes the
   tier movable without a deploy. Until this exists nothing downstream can
   branch on tier.
3. **Scraper classification** — the suggest-from-text-and-dimensions rule, with
   the override. Pure, fixture-tested, no network.
4. **Product card and PDP variants** — one foundation, three variants. Card
   first: it is what the collection pages are made of.
5. **Collection pages and navigation** — the large → medium → small hierarchy,
   customer-facing names only.
6. **Homepage band** — three worlds, one language.
7. **Tier 02's guided customization** — the largest single piece, and the one
   with real upload and process-explanation work behind it.

Steps 4–7 are REDESIGN.md territory and must be read against it before any of
them is built; §1.1's "visual layer only" constraint does not forbid this work,
but it does mean product data and the order flow keep their current shapes.
