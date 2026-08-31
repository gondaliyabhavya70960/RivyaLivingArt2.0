# Scraper audit — PARTIAL

The **SSRF guard** was read. The adapters, job orchestration and merge policy
were **not**. Nothing was executed.

## Verified — `src/lib/scraper/ssrf.ts`

This module is well-built.

- Rejects loopback, `0.0.0.0`, private v4 (`10/8`, `172.16/12`, `192.168/16`),
  and link-local `169.254/16` — explicitly naming the cloud metadata endpoint
  `169.254.169.254`.
- Handles IPv4-mapped IPv6 in **both** dotted (`::ffff:127.0.0.1`) and hex-group
  (`::ffff:7f00:1`) renderings, and NAT64 (`64:ff9b::…`). This is the detail
  most implementations miss.
- **Redirects are `manual` and revalidated at every hop.** A URL that passes a
  pre-flight check and then 302s to the metadata endpoint is the standard bypass;
  this closes it. The adapter comments record that `fetch`'s default
  `redirect: "follow"` previously bypassed the guard (SEC-107).
- Documents its own residual: validation is by hostname and `fetch` re-resolves
  at connect, so DNS rebinding remains theoretically open. Stating it is better
  than implying it is solved.

`safeFetch` is used by `robots.ts`, `sitemaps.ts`, `fingerprint.ts`, all four
adapters, and `catalog-mirror.ts`.

**Do not weaken any of this to make a scrape succeed.**

## NOT verified

- The four adapters (`shopify`, `woocommerce`, `jsonld`, and the fourth).
- Parsing robustness: malformed HTML/JSON, missing price, missing image,
  changed page structure.
- Response size caps and decompression-bomb behaviour.

## Invariants to re-verify by test

From `CLAUDE.md` — each was expensive to learn once:

| Invariant | Why it matters |
|---|---|
| **Staged rows are immutable** | `ScrapedProduct` is what the site said; promotion writes a separate `Product`. A normalisation change needs no re-scrape |
| **Owner edits outrank every writer** | `merge-policy.ts` must check `ownerTouched` **BEFORE** `needsRewrite`. Reversed, it silently overwrote edited products and deleted their galleries (fixed Phase 9) |
| **One run per source** | A second Scrape returns the in-flight job. `QUEUED` counts as in flight. Check for TOCTOU |
| **Five failures pauses a source** | Resume clears pause **and** counter; a success resets to zero rather than decaying |
| **`CONFIRMED ≡ confirmedAt IS NOT NULL`** | Only the Confirm action sets it. No path from scrape to confirmed |
| **Deletion clears the mirror and confirmed tab, never the tier tabs** | Those record what a supplier's site said; a deletion here does not un-happen the scrape |
| **Extraction failures are recorded, not nulled** | The checked fields are the ones that block confirmation |
| **Price history is append-only** | Written on first sighting, then only when the price moves. A gap means the price held |

Unit tests already exist for several: `merge-policy.test.ts`, `breaker.test.ts`,
`confirm.test.ts`, `run-scope.test.ts`, `price-history.test.ts`,
`purge.test.ts`, `validation.test.ts`. **They were not run.**

## Suggested SSRF regression test

There is no automated test pinning the SSRF host rules. Add one — a pure table
test over the address classifier needs no network:

```
127.0.0.1 · 10.0.0.1 · 172.16.0.1 · 192.168.1.1 · 169.254.169.254 ·
::1 · ::ffff:127.0.0.1 · ::ffff:7f00:1 · fc00::1 · 0.0.0.0    -> all blocked
file:// · data: · javascript: · ftp://                        -> all blocked
```

Plus a redirect-chain case asserting a hop to a private address is refused. This
is the highest-value test missing from the suite.
