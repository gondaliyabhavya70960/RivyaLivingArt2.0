# Production release checklist

Ordered. Items 1-3 are blocking.

## 1. Finish PR #138 — BLOCKING

CI is the first execution of the draft-order fix.

- [x] `Typecheck · lint · unit tests` — **green** (run 32935438940, `c377bf9`):
      typecheck, lint, `copy:check`, translation coverage and the unit suite
      including the 6 new assertions
- [ ] `Production build · design & a11y audits` — **not observed.** Was still
      running when the session ended. Check it before merging
- [ ] Review the diff on its own terms
- [ ] Do **not** merge on a red run

## 2. Run what this pass could not — BLOCKING

CI covers typecheck, lint, unit tests and the build. Still unrun anywhere:

```bash
BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # needs a populated catalog
npm audit
```

And, against a running server, the four route families CI cannot reach because
their slugs need content the CI database has no seed for:

```bash
node scripts/redesign-audit.mjs "/en/product/<slug>,/en/blog/<slug>,/en/portfolio/<slug>,/en/p/<slug>"
node scripts/a11y-audit.mjs   "/en/product/<slug>,/en/blog/<slug>,/en/portfolio/<slug>,/en/p/<slug>"
```

## 3. Verify the fix end-to-end — BLOCKING

The unit test covers the predicate and passes. Confirm the **wiring**:

- [ ] Anonymous order against a DRAFT product id -> rejected, no `Inquiry` row
- [ ] Same request, staff session **with** draft preview -> succeeds
- [ ] Published product order -> succeeds, `Inquiry` saved, `wa.me/917096036250`
      opens with the correct pre-filled message
- [ ] **Out-of-stock published** product -> still records an enquiry, with the
      availability-enquiry intro
- [ ] The rejection is the *generic* error, indistinguishable from a
      nonexistent id

The fourth is the regression most likely to be caused by this change. Check it
specifically.

## 4. Measure and finish the image migration — HIGH

- [ ] Run the three counting queries (`07-DATA-QUALITY-AUDIT.md`)
- [ ] `GET /api/cron/mirror-images?limit=500` until zero remaining
- [ ] Add the published-image hostname assertion to the CI **build** job

## 5. Then, and only then, enforce CSP — MEDIUM

Strictly after step 4. Full sequence in `RR-005`. Enforcing before the images
are mirrored will break the storefront.

## 6. Remaining hardening — MEDIUM/LOW

- [ ] `RR-002` — resolved-prefix containment in `uploads/[...path]`
- [ ] `RR-003` — magic-byte sniff on upload (`sharp` is already a dependency)
- [ ] `RR-004` — record the Vercel `X-Forwarded-For` dependency
- [ ] Add the SSRF host-classification table test (`10-SCRAPER-AUDIT.md`)
- [ ] Check CSV formula injection on both export routes
- [ ] Confirm `/api/csp-report` is rate-limited
- [ ] Secret sweep including git history; confirm no server secret is exposed
      under a `NEXT_PUBLIC_` prefix

## 7. Areas never audited — plan the work

Scraper adapters · Google Sheets sync · cache/revalidation matrix · performance
and N+1 · i18n completeness beyond the CI gate · SEO and structured data · data
quality · production smoke test.

The scraper adapters are the only unaudited area with real security weight; the
SSRF guard they call was read and is sound, but the adapters themselves were
not. See `00-FINAL-QA-SUMMARY.md` for the full coverage table.

---

## Sign-off

**Current state: NOT READY** — not because the application looks unhealthy. The
security surface checks out, the one real defect is fixed, and the fix is green
on typecheck, lint and the unit suite. It is NOT READY because the production
build and the four browser audits were never observed, the end-to-end order flow
was never exercised, and several requested areas were never examined.

Ready when: step 1's build job is green, steps 2-3 pass, and step 4 reaches zero.
