# Adapter Acceptance Checklist

> **Provenance.** `docs/plan/02-scraper-rebuild.md` §7 names "the document's
> **Adapter Acceptance Checklist**" as the definition of done for every
> adapter, and asks for it to be copied into this repo verbatim. That document
> (`resin-art-merchandiser-rebuild-prompts_1.md`) was never committed — no
> file in this tree contains the checklist (verified by repo-wide grep,
> 2026-09-16). This checklist is therefore **written for this repo, by the
> agent that built B5, and is labelled as such** — it is not the original
> brief's checklist. If the owner later supplies the original, reconcile the
> two and keep the stricter rule of each pair.

Every adapter — platform (Shopify, WooCommerce, JSON-LD) or markup-shape
(priced-store, quote-studio) — must pass every gate below as **fixture tests
that make no network call**. Fixtures are checked-in HTML/JSON under
`src/lib/scraper/adapters/__fixtures__/`; tests call the adapter's pure
mapping function directly. A test that makes a real request fails in CI and
re-fails whenever the source redesigns.

## A. Identity and dedupe

- **A1** Every product carries a stable `externalId` from something that does
  not change when the site rewrites copy: SKU, product id, or URL path slug —
  never the title.
- **A2** One page yields one product per identity; duplicates inside a page
  are the engine's problem (`upsertPage` dedupes), not a reason to invent ids.

## B. Price honesty (the load-bearing rules)

- **B1** No parseable price ⇒ one variant with `priceMajor: null`. Downstream,
  `derivePriceBasis` makes that `QUOTE_ONLY` and `priceForBasis` stores NULL.
  **A quote-only row never carries a number — not even zero.**
- **B2** An explicit quote phrase ("price on request", "request a quote"…)
  wins over any number on the page, including placeholder prices. The adapter
  preserves the phrase in the product text so the basis derivation can see it.
- **B3** "Starting from ₹X" and "per sq ft" text reach the product text so
  `STARTING_FROM` / `PER_AREA` can be derived; the adapter does not collapse
  them to a plain price.
- **B4** A ranged price becomes TWO variant rows (floor and ceiling), never
  one invented midpoint. Per-variant prices become one row per variant, with
  the option axes the source named in `options`.
- **B5** Currency comes from the markup when declared; the fallback default
  is documented, not silent.

## C. Field coverage

- **C1** Title, description (HTML-stripped), images (absolute URLs, alts
  preserved when published), and availability are extracted when present.
- **C2** No availability markup ⇒ assume purchasable, and say so in a comment;
  explicit out-of-stock markup is honoured.
- **C3** Anything source-specific (sku, brand, variant axes, spec tables) goes
  into `fields` raw. Nothing is parsed out of existence.

## D. Negative gates (the page is not a product)

- **D1** A blog post, listing/category page, about page, or malformed HTML
  yields `null` — never an invented product. Each shape has at least one
  checked-in negative fixture.
- **D2** Markup-shape detection requires *structural evidence of a single
  product* (product-typed meta/microdata, product id/variant attributes, a
  quote CTA beside spec lists). Price text alone never promotes a page — a
  category grid is full of price text.
- **D3** A page with several product identities (a listing) is NONE, even if
  every card carries product markup.

## E. Robustness and politeness

- **E1** Malformed HTML never throws; a page that cannot be read yields
  `null`. One bad product never fails the run.
- **E2** Fetching goes through `safeFetch` only, at the shared politeness
  delays. Adapters contain no network code of their own beyond the existing
  shared path.
- **E3** No new dependencies; mapping is pure and split from fetching.
- **E4** A page yielding implausibly many products means a selector matched
  the wrong thing — these page mappers return at most one product by
  construction; discovery caps stay the discovery layer's job.
