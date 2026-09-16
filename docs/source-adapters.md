# Adding a source adapter

Shared logic lives in the scraper core. A site's quirks live in its adapter.
A broken adapter must never break another source.

```
ScraperManager → adapter registry → the site's adapter
src/lib/scraper/adapters/{index,shopify,woocommerce,jsonld}.ts
```

Every adapter ships against **`docs/adapter-acceptance-checklist.md`** as
fixture tests that make no network call (fixtures live beside the adapters in
`__fixtures__/`). That checklist was written for this repo — the original
brief's checklist was never committed; the doc's own header records that.

## The markup-shape extractors (B5, 2026-09-16)

Two page mappers keyed on what a page's markup LOOKS like, not the platform:

- **`priced-store.ts`** — a single product page with commerce markup but no
  usable JSON-LD Product node (microdata, Open Graph product tags,
  `data-product_variants` blobs). Per-variant rows when the page names them,
  floor+ceiling rows for a bare range, never an invented midpoint.
- **`quote-studio.ts`** — a bespoke atelier's piece page: no price at all, a
  quote/enquiry CTA, spec lists. Emits one variant with `priceMajor: null`,
  which persists as QUOTE_ONLY with a NULL price — never zero.

`markup-shape.ts` decides which shape a page is, and the JSON-LD adapter's
fetch path calls it when a page has no schema.org Product node — so a
sitemap-discovered page without JSON-LD now extracts instead of skipping.
Detection is deliberately strict (checklist §D): price text alone never
promotes a page, a page with several product identities is a listing, and
non-product pages yield nothing.

---

## Before writing one

**Check the site is not already covered.** `fingerprint()` detects Shopify and
WooCommerce automatically, and JSON-LD covers a surprising number of the rest.
Most new sources need no code at all — add them to the registry and the
existing adapters handle them.

Write a new adapter only when fingerprinting returns `UNKNOWN` _and_ the site
has no usable JSON-LD.

## The contract

```ts
type AdapterContext = {
  baseUrl: string;
  sourceKey: string;
  vertical: string;
  page: number; // 1-based
};

type Adapter = (ctx: AdapterContext) => Promise<AdapterPage>;
```

Return the page's products and whether more pages exist. The core handles
staging, dedupe, change detection, price history and validation — an adapter's
only job is turning one page of a site into products.

## Rules

**Be polite.** Sleep between pages using the shared delay; do not invent your
own faster one. `robots.txt` is honoured by the core and must stay that way.

**Fetch through `safeFetch`** (`ssrf.ts`). Never call `fetch` directly — the
guard is what stops a scraped URL pointing at internal infrastructure.

**Never throw for a missing optional field.** Return what you found. A product
missing a price is a product with a validation failure, not a dead job. Only
throw when the _page_ could not be read.

**Give every product a stable `externalId`.** It is half the dedupe key. If the
site has no id, derive one deterministically from something that does not
change — a handle or path, not a title.

**Cap what you return.** A page yielding thousands of products usually means a
selector matched the wrong thing.

## Testing

Fixture-based, never hitting the network. The first adapter tests shipped
with B5 (2026-09-16) — `markup-shape.test.ts`, `priced-store.test.ts`,
`quote-studio.test.ts` — against checked-in HTML fixtures, per
`docs/adapter-acceptance-checklist.md`. Earlier pure-module suites
(`validation.test.ts`, `breaker.test.ts`, `merge-policy.test.ts`) remain the
pattern. A test that makes a real request fails in CI and re-fails
whenever the competitor redesigns.

## When a site changes shape

That shows up as a spike in `/studio/scraper/quality` — usually one field
across every product from one source. The "worst sources" panel is the fastest
way to spot it. Fix the adapter; the next scrape resolves the failures
automatically, because the condition that raised them stops holding.

If the site starts refusing us, the circuit breaker pauses the source after
five consecutive failures rather than hammering it. That is the intended
outcome, not a bug to work around.
