# Competitor research — leagues, patterns, and what to do with them

_2026-09-19. Desk research across 42 sources in six markets, every one
recorded individually in `prisma/fixtures/starter/research.json` (seeds the
internal ResearchRecord table via `npm run seed:starter` — status RESEARCH,
never public). Nothing here is copied from any competitor; patterns are
observations, not text._

## The league map

The single most useful frame: nobody competes with "a resin art business" —
they compete inside a league, and each league has its own price physics.

| League | Who plays (records) | Price evidence observed | What it means for Rivya |
| --- | --- | --- | --- |
| Collectible design | Eduard Locota, Sabine Marcelis, Wonmin Park, 1stDibs/Pamono | €7k–€45k per piece; editions of 5–35; $8k side tables | Large-format resin holds five-figure pricing through **visible time** (60+ layers, months per piece), **artificial scarcity** (numbered editions) and **story-named designs** |
| Luxury commission | Black Forest Wood Co. | $14k–$50k commission tables; $2,999 plans | The top end is relationship-sold and content-marketed (YouTube as the entire funnel) |
| Premium made-to-order (India) | Sansara Living, ClassyArtz | ₹56,400 dining sets; ₹5,500 clocks | A calm, craft-led Indian tier exists between discount volume and luxury — this is Rivya's home league |
| Volume manufacturers (India) | Diya Lighting, The Next Decor, Pacific Resin Art, Novo Magic | ₹1,999–₹96,600; perpetual 50–70% discounts; COD | Named designs sold as SKUs with size dropdowns; discount anchoring trains buyers to distrust list prices — **do not join** |
| Marketplace makers | Etsy India sellers | ₹21,560–₹2,12,905 on one listing's size ladder | Marketplaces prove the size-driven price ladder publicly; buyers comparison-shop here |
| Preservation specialists | Shaahi Decor, ResinVilla, Flower Preservation India, Diviner Saga, Viva Gifts (IN) · Artisan Palace, SO Resin, Sals Forever Flowers (UK) | ₹800–₹50,000 (IN) · £15–£2,280 (UK) | India's range is 60× wide — the league rewards operational trust (pickup, updates, deposits) more than price |
| Gifting platforms | FNP, IGP | 60-min delivery; 19,000 pincodes; ₹500–₹1,500 international | Platforms own *convenience* and *print-level* personalisation; they structurally cannot sell a one-of-one poured piece |
| Corporate gifting | Consortium, Giftana, WhataShop, Idea Gifts, ARC Print, PrintMine, Qikink, Annaya | ₹90–₹885 promo sets; under-₹500→₹2,000+ bands; Fortune-2500 client lists at the top | Three sub-leagues: promo merchandise (₹90–₹500), curated hampers (₹500–₹2,000), enterprise trust (Consortium). Rivya's wedge: objects recipients keep |
| 3D printing services | iamRapid, 3Ding, Champ3D, ThinkRobotics, Make3D, Shapeways, Xometry | ₹3/cm³; ₹200/₹1,000/₹2,000 tech starting prices; instant quotes | Buyers of *parts* expect instant pricing; buyers of *objects* expect consultation. Rivya sells objects |

## What the best competitors do that Rivya can adopt without copying

**Operational honesty as conversion copy.** 3Ding's FAQ names every awkward
number — minimum order value, shipping thresholds, file retention, reprint
terms. Artisan Palace's price guide answers the question the whole UK market
dodges, and ranks for it. Rivya's FAQ already holds this register (48-hour
damage window, no online payment); the move is to extend it into a
"what custom resin work costs and why" journal guide in the Artisan Palace
spirit — India has no equivalent ranking today.

**Progress updates as a named promise.** Flower Preservation India sends
video updates mid-process; Shaahi Decor promises updates before the final
stage. Rivya does this informally on WhatsApp already. Naming it on the
preservation pages — "photos at every stage, approval before the final
pour" — converts an existing behaviour into a stated trust signal at zero
cost.

**Booking mechanics for preservation.** SO Resin turned preservation into a
calendar event: pick your wedding date, pay a £25 deposit, get packing
instructions instantly. Rivya's FAQ answers "when do I book?" in prose;
the mechanics (reserve the date on WhatsApp, receive a packing guide) could
be made explicit in the commission flow without any new infrastructure.

**Price-ladder presentation.** Diviner Saga publishes preservation prices
size by size (₹1,999→₹6,500 across four frames); Etsy sellers publish the
same ladder per table size; Giftana publishes budget tiers for corporate
buyers. Rivya's PDP price bands are the right shape; the corporate/gifting
enquiry could borrow the tier guide ("what 10 / 50 / 200 custom pieces
cost") to pre-qualify procurement buyers.

**Procurement trust signals.** ARC Print names the GST invoice (input tax
credit matters to every Indian business buyer). Stating "GST invoice
provided" on Rivya's corporate pages answers a procurement checkbox that is
currently handled ad hoc.

**Scarcity mechanics for large format.** Every collectible-league player
manufactures scarcity — editions of 5, of 8 + 4 AP, of 35. Rivya's pieces
are already one-of-one by nature; saying so in gallery language
("documented as a numbered pour") costs nothing and is the missing lever
between ₹1L Indian pricing and €10k+ collectible pricing.

## What competitors do that Rivya should keep NOT doing

- **Perpetual discounting** (Pacific's eternal 70%, Novo's ₹7,499 strike
  anchors, Woodensure's 66%): it converts once and distrusts forever.
- **Keyword-stuffed copy** (Reziwood's SEO text, Akanksha-style city-keyword
  pages): it ranks and repels; the journal's editorial voice is the better
  long-term asset.
- **Instant-quote machinery** (iamRapid, Xometry): correct for parts, wrong
  for art. Recorded so the consultation-first flow reads as a choice.
- **Marketplace dependence** (Shapeways' lesson: buyers don't browse for 3D
  prints or poured art; they arrive with a need). The need-led custom-order
  flow is validated.
- **SKU-count competition** (The Next Decor's 68 MDF clocks): Rivya competes
  on materials and meaning, not catalogue breadth in small decor.

## FAQ topics buyers ask across the market (observed, not guessed)

Harvested from competitor FAQ pages and guides — these are the questions the
market's customers demonstrably ask, now cross-checked against Rivya's own
42-FAQ starter library:

- Covered by Rivya's library: price/payment flow, timelines, care, heat,
  scratching, yellowing, dimensions, colour choice, shipping, damage,
  preservation prep, file formats, materials, personalisation, bulk.
- Covered by competitors, worth watching: preservation **rush fees** (UK
  studios charge 25–50% — Rivya's answer is "we don't rush cure times", said
  in the journal), **progress updates** (now recommended above), **GST
  invoicing** for corporate, and **pickup/courier assistance** for sending
  flowers (ResinVilla prices it at ₹200 — an owner decision, logged in
  `OWNER-REVIEW.md` §5 territory).

## SEO patterns observed

- Indian volume players rank on keyword density and city pages; the content
  is thin and the trust is thinner.
- The content that ranks *and* converts in this market is the honest
  explainer: Artisan Palace's price guide, 3Ding's FAQ, Black Forest's
  YouTube process library, Woodensure's price-drivers article (their best
  page by far).
- Rivya's 55-article journal is already the strongest editorial asset in the
  Indian resin space seen in this research. The gap is one guide type:
  pricing transparency, which the whole market dodges and buyers clearly
  search for.

## Method note

42 records: 9 preservation, 8 resin-furniture, 8 corporate gifting,
7 3D printing, 4 resin decor, 4 collectible design, 2 gifting platforms,
plus marketplace context records. Each carries its source URL, observed
pricing/UX facts, and a dated note in `research.json`. Sources were searched
and read 2026-09-19; nothing was scraped, and no competitor text, imagery or
reviews were reused — Final Hard Rules 13–16.

## Related

- `prisma/fixtures/starter/research.json` — the 42 records this synthesises
- `docs/content/CONTENT-AUDIT.md` — why the demo content is not on the site
- `docs/content/CONTENT-INVENTORY.md` — the counts
- `docs/content/OWNER-REVIEW.md` — decisions only the owner can make
