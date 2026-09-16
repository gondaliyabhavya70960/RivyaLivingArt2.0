# B — Product scraper rebuild

> **Blocked on D26.** `CLAUDE.md`'s HARD RULES and `REDESIGN.md` §1.1 currently forbid changing
> product data, Server Actions and Studio behaviour. This workstream does all three, by design.

Source of requirements: the attached `resin-art-merchandiser-rebuild-prompts_1.md`.
Where that document and the user's instruction disagree — it makes Google Sheets first-class, the
instruction removes it — **the instruction wins** (D27). See [`03`](03-sheets-removal.md).

---

## 1. What exists today, stated precisely

**Data model.** `ScrapeSource` (key, tier, vertical, platform, supply, enabled, `requestDelayMs`,
`consecutiveFailures`, `pausedAt`) → `ScrapeJob` (status, `cursorPage`, counts, heartbeat, scope) →
`ScrapedProduct` → `ValidationFailure` · `PriceHistory`.

**Adapters.** Four: `shopify`, `woocommerce`, `jsonld`, plus `strip-html`. Platform is *detected*,
not per-host. There is no `sources/<host>/` registry.

**Normalization.** `normalize.ts` exports exactly four functions: `normalizeMaterial`,
`normalizeColour`, `normalizeUnit`, `canonicalizeUrl`. Code-side maps, no alias tables.

**Execution.** `createScrapeJob` → the client hook `use-scrape-runner.ts` polls
`continueScrapeJob(jobId)` one page at a time. `cursorPage` makes it *resumable*, but **the job
only advances while an operator's browser tab is open on the scraper page.** There is no queue, no
worker, and `vercel.json` schedules only `mirror-images` and `publish-scheduled`.

**Governance that is already right** and must survive the rebuild — these were expensive to learn:

- Staged rows are immutable *in intent*; corrections never edit them.
- Owner edits outrank every writer (`merge-policy.ts`, checked **before** `needsRewrite`).
- One run per source; `QUEUED` counts as in flight.
- Five consecutive failures pauses a source; resume clears pause *and* counter.
- `CONFIRMED_PRODUCTS ≡ { p : p.confirmedAt IS NOT NULL }`; nothing but Confirm sets it.
- Extraction failures are **recorded**, not nulled (`ValidationFailure`).
- Price history is append-only.
- SSRF guard (`ssrf.ts`), robots handling (`robots.ts`), circuit breaker (`breaker.ts`).

---

## 2. The gap, requirement by requirement

| Attached doc asks for | Today | Gap |
|---|---|---|
| Source type · analytics league · collection mode · robots/policy review status | `tier` · `vertical` · `platform` · `supply` | **Missing.** Tier is a Rivya-sourcing concept, not a league. |
| Per-source category tree, enable/disable | — | **Missing** (Prompt 7). |
| **Immutable snapshot per scrape** | One row per `(sourceKey, externalId)`, **upserted in place**; `contentHash` + `lastSeen` | **Contradiction.** The doc's central rule. Needs a new table. |
| Product identity ≠ source snapshot | Conflated | **Missing.** |
| Variants / option combinations | — | **Missing.** |
| Geometry normalized to mm | `dimensions String?` free text | **Missing.** |
| Structured materials (wood species, resin family, base, substrate, inclusions) | `materials String?` free text | **Missing.** |
| Resin visual language (river/ocean/geode/…) | — | **Missing.** 18 canonical values specified. |
| Colour / opacity / effects | `normalizeColour` only | **Partial.** |
| Finish + claimed performance, recorded as source text then normalized | — | **Missing.** |
| **Price basis** — per piece / per area / starting-from / **quote-only** | `priceMin`/`priceMax` ints | **Missing, and load-bearing.** *"Do not silently convert `Contact for price` into zero."* |
| Production model: made-to-order, one-of-one, limited-edition, customizable, lead time | `timeline String?` | **Missing.** |
| Shortlist states (7) | `ReviewStatus` (4: PENDING/APPROVED/REJECTED/IMPORTED) | **Partial.** |
| Alias/mapping tables applied at compute time | Code-side maps | **Missing.** |
| Fair comparison scopes (4) | — | **Missing** (Prompt 12). |
| Canonical taxonomy + confidence + review queue | `category-map.ts` | **Partial.** `/studio/scraper/mapping` exists. |
| Analytics, opportunity scoring | — | **Missing** (Prompts 14–17). |
| Embeddings, visual similarity | — | **Missing** (Prompts 23–24). |
| Durable orchestration surviving restarts | Client-polled cursor loop | **Partial.** Resumable, not durable. |
| Content-hash image dedupe to blob storage | Image URLs stored as JSON | **Partial.** `media-ingest.ts` exists for catalog media. |
| Fixture-based adapter tests, no network | Unit tests over pure functions | **Missing** for adapters. |

---

## 3. Architecture decision

The attached document assumes a monorepo: separate API, a scraper/ML worker, vector search, blob
storage, an independently deployable admin. This repo is one Next.js app on Vercel where the
scraper is a Studio subsystem.

**Two options.**

**(i) Spin out a separate service.** Faithful to the doc. Gets a real worker, real queues, a vector
database, and horizontal scale. Costs: a second deployment, a second auth surface, a second schema,
and a synchronisation problem between Rivya's catalogue and the research corpus — for a
single-operator business whose corpus is ~15 sources.

**(ii) Keep it in-app; add the missing durability. ← recommended**

The doc's *rules* are what matter — immutable snapshots, provenance, fair comparison, leagues,
human confirmation. None of them require a separate service. What the current design genuinely
lacks is a job that runs without a browser tab open, and that is one cron route:

```
vercel.json  →  /api/cron/scrape-drain   (every 5–10 min)
   ├─ reclaim RUNNING jobs whose heartbeat is stale
   ├─ advance each eligible job by N pages, within the request budget
   └─ respect per-source delay, concurrency cap and the circuit breaker
```

`continueScrapeJob` already does the per-page work and already heartbeats `updatedAt`. The drain
calls the same function the client hook calls, so scheduled and manual runs share one code path —
which is exactly what Prompt 30 requires. Revisit option (i) only if the corpus outgrows a single
Postgres, which is not this decade's problem.

---

## 4. Schema plan

Additive first; nothing is dropped until its replacement is populated and read.

### Phase 6a — snapshots and identity

```
ResearchProduct        stable identity across scrapes
  id · sourceKey · externalId · canonicalUrl · firstSeen · lastSeen
  canonicalFamily · canonicalProductType · scaleClass · confidence
  @@unique([sourceKey, externalId])

ProductSnapshot        IMMUTABLE. one row per successful scrape
  id · researchProductId · jobId · capturedAt · contentHash
  rawPayload Json            ← exactly what the source said
  @@index([researchProductId, capturedAt])
```

`ScrapedProduct` stays for one release as the promote path's input, then becomes a view over the
newest snapshot. The rule that makes this work: **snapshots are append-only and never edited.**

### Phase 6b — structure

```
ProductVariant      snapshotId · label · optionsJson · priceMinor · currency
                    priceBasis · isReference · referenceReason
ProductGeometry     snapshotId · lengthMm · widthMm · heightMm · diameterMm
                    thicknessMm · weightG · shape · seatingCapacity
                    sourceUnit · sourceText
ProductMaterial     snapshotId · role(resin|wood|base|substrate|hardware|inclusion)
                    rawText · normalizedValue · aliasId
ProductStyle        snapshotId · resinStyle · colourFamily · opacity · effects[]
                    finish · claimsJson      ← claims stay claims, never facts
ProductionModel     snapshotId · madeToOrder · oneOfOne · limitedEdition
                    customizable · leadTimeText · leadTimeDays
```

**`priceBasis` is an enum and every price carries one:** `PER_PIECE · PER_AREA · STARTING_FROM ·
QUOTE_ONLY`. `QUOTE_ONLY` has a null price and is excluded from every numeric aggregate by clause,
not by filtering zeros. Add a `test:db` case that asserts a quote-only row never lands in a mean.

### Phase 6c — governance and comparison

```
SourcePolicy        sourceId · sourceType · analyticsLeague · collectionMode
                    policyReviewStatus · reviewedAt · reviewedBy
                    maxPagesPerRun · maxItemsPerRun · concurrencyCap · timeoutMs
NormalizationAlias  kind(unit|material|resinStyle|colour|productType|availability)
                    rawValue · canonicalValue · createdBy · createdAt
                    @@unique([kind, rawValue])
ShortlistEntry      researchProductId · state · changedBy · changedAt
                    note · tags[] · reason · linkedOpportunityId
```

`ShortlistState`: `NEW · REVIEW · SHORTLISTED · REJECTED · CONFIRMED · INSPIRATION_ONLY ·
DUPLICATE`. The existing `ReviewStatus` maps forward: `PENDING→NEW`, `APPROVED→SHORTLISTED`,
`REJECTED→REJECTED`, `IMPORTED→CONFIRMED`.

**`AnalyticsLeague` is the rule that protects every chart:** `FINISHED_ART · MATERIALS_DIY ·
MARKETPLACE_B2B`. DIY materials and B2B MOQ listings never enter a finished-art benchmark. Enforce
it **server-side in the query**, not in a UI filter a user can clear.

### Phase 8 — analytics and similarity (separate commission)

`AnalyticsSnapshot` (precomputed JSON keyed by source/league/view/scope, stamped with
`computedAt` · `scrapeRunId` · `normalizerVersion` · `analyticsVersion`), `OpportunityScore`
(one row per component, so the formula is inspectable), `ProductEmbedding`
(`hash · model · version · vector`).

**Vector search is the one place option (i) may still win.** Postgres + `pgvector` is adequate at
this corpus size; if the deployment cannot install the extension, the honest answer is a managed
vector service, not a hand-rolled index.

---

## 5. Source registry

The attached doc names 15 starter sources across three tiers. They are a **registry, not a
whitelist** — the operator adds, disables and reclassifies without a deploy, which the current
`ScrapeSource` table already allows.

Two rules to implement before the first new source is enabled:

1. **`collectionMode` gates the fetcher.** `http · browser · api · feed · manual_research`. A source
   set to `manual_research` has no automated path at all — the Studio offers a paste-and-record form
   instead. Etsy and the B2B marketplaces default here.
2. **`policyReviewStatus` is surfaced, not assumed.** A source cannot be enabled for automated
   collection until someone records that its robots rules and terms were reviewed.

The existing guards stay and are the reason this is safe: `ssrf.ts`, `robots.ts`, `breaker.ts`, the
per-source delay, and the rule that an auth/paywall/CAPTCHA response **stops the run**. Never add
proxy rotation, CAPTCHA bypass or stealth behaviour — the attached doc says so and so does this plan.

---

## 6. Studio surfaces

Designed **once**, after phase 6b lands — not restyled now and rebuilt later (see
[`01`](01-redesign-main-and-studio.md) §4.4).

| Screen | State |
|---|---|
| Sources control centre | Extend existing — add league, collection mode, policy review, caps, schedule |
| Scrape control | Extend existing — scope picker, live `workflow_runs` feed |
| Review inbox | Rebuild on `ShortlistEntry`, 7 states, bulk actions |
| Confirmed products | New — the gated final list, with CSV/XLSX export ([`03`](03-sheets-removal.md)) |
| Product explorer | New — the doc's Prompt 21 filter set over raw + normalized values side by side |
| Large-format workspace | New — Prompt 22. Image-first, dimensions, material stack, reference board |
| Data quality | Extend `/studio/scraper/quality` — group by root cause, create aliases, test against history |
| Workflow runs | New — filterable feed, stages, retry/cancel |

---

## 7. Phasing, and what to build first

The attached document's own Build Order Notes are right: **Prompts 11–15 are the valuable part.**
Normalization, fair comparison, taxonomy and analytics are where a merchandiser's questions get
answered. Embeddings are a demo until those exist.

| Step | Ships | Proves |
|---|---|---|
| B1 | `/api/cron/scrape-drain` + reclaim | A scrape finishes with the laptop closed |
| B2 | Snapshots + identity (6a), dual-write | History is queryable; nothing else changes |
| B3 | Structure (6b) incl. `priceBasis` | Quote-only never becomes zero |
| B4 | Alias tables + compute-time normalization | A mapping fix needs no re-scrape |
| B5 | Two new adapters — one priced/variant store, one bespoke/quote studio | The schema survives both catalog styles *before* it hardens |
| B6 | Fair comparison scopes + leagues | A coaster is never benchmarked against a dining table |
| B7 | Shortlist → confirmed → export | Human confirmation gates the final list |
| B8 | Analytics + opportunity score | Every payload carries `computed from X of N` |
| B9 | Embeddings + similarity | Only after B8 |

> **B5 shipped 2026-09-16** as the markup-shape extractors
> (`adapters/priced-store.ts`, `adapters/quote-studio.ts`,
> `adapters/markup-shape.ts`), wired as the fallback inside the JSON-LD fetch
> path — a page with no schema.org Product node is now routed by its markup
> shape instead of being skipped. The Adapter Acceptance Checklist named below
> was never committed with the source brief, so the repo now carries its own:
> `docs/adapter-acceptance-checklist.md`, labelled as agent-written.

> **B6 shipped 2026-09-16** as `AnalyticsLeague` on `ScrapeSource`
> (FINISHED_ART · MATERIALS_DIY · MARKETPLACE_B2B; backfilled from the
> owner-set `supply` flag, which was already this decision in another
> column), the pure vocabulary and query guards in `scraper/leagues.ts` +
> `scraper/league-query.ts`, and the four comparison scopes in
> `scraper/comparison-scopes.ts` (all-variants · base-product ·
> unique-design · quote-only-separate, with the reference-variant pick's
> rationale recorded on every row). The write path stamps non-benchmark
> leagues' variants `isReference` with a `league:<LEAGUE>` reason; the guard
> is enforced in the query (`variantWhereForLeague`), not in a UI filter.
> The owner re-leagues a source from its Studio page, beside the collection
> mode and policy review it already carried.

> **B7 shipped 2026-09-16** as `ShortlistEntry` — one row per researched
> product holding the current funnel state, who moved it, when and why —
> with the seven-state machine in `scraper/shortlist.ts` (CONFIRMED reachable
> only from SHORTLISTED; CONFIRMED leaves only back to SHORTLISTED; no
> automatic transitions anywhere). The review inbox is rebuilt on entries
> (`shortlist-query.ts` + `shortlist-inbox.tsx`): NEW folds in the entry-less
> products, bulk moves report "moved / already / refused" instead of failing
> a mixed selection, and notes/tags live on the entry. The legacy
> `reviewStatus` stays as the promote path's input, mirrored both ways
> (SHORTLISTED→APPROVED down; APPROVED→SHORTLISTED up, never un-confirming),
> and the import path's IMPORTED now confirms the entry — the backfill's
> mapping applied going forward. The new `/studio/scraper/confirmed` page is
> the gated final list, with CSV/XLSX export at
> `/api/scraper/export-confirmed` carrying the B6 reference-variant pick and
> its rationale on every row. The plan sketch's `linkedOpportunityId` is
> deferred to B8 — a column with no writer is the defect ResearchProduct's
> comment already cites.

Every adapter ships against the **Adapter Acceptance Checklist** as fixture tests that
make no network calls. The source brief's own checklist was never committed to this repo;
`docs/adapter-acceptance-checklist.md` is this repo's replacement for it, written at B5
and labelled as such — reconcile with the original if the owner ever supplies it.

---

## 8. Rules to carry into the rebuild unchanged

1. Research, do not clone.
2. Facts, normalized values, AI inference and human notes carry separate provenance.
3. Quote-only is not free.
4. Different scales need different benchmarks.
5. Made-to-order is a business-model attribute, not a missing-stock condition.
6. Raw scraped data is immutable; fix mappings at compute time.
7. Every automated recommendation is explainable — show the components, not a score.
8. **Human confirmation gates the final list.** Nothing auto-confirms, and under D28 nothing
   AI-generated reaches the catalogue without an explicit owner action.
