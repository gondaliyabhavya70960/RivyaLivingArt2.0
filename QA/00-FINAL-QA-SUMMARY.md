# ResinRiva 2.0 — QA pass summary

**Date:** 2026-08-26 · **Branch:** `claude/resinriva-qa-hardening-xl496z` · **PR:** #138

---

## Read this first: what this pass was, and was not

This was a **static-analysis pass**. Command execution was unavailable for the
entire session — no `npm test`, no `typecheck`, no `lint`, no `build`, no
`npm run test:e2e`, no local server, no browser, no database queries against
either a local or a production instance.

That single constraint decides how every claim in these documents is worded:

- Claims about **source code** were read from the files and are stated plainly.
- Claims about **runtime behaviour** are marked `NOT RUN`. None of them were
  observed. They are not "probably fine" — they are untested.
- The one code change in this branch was verified byte-for-byte against the
  working tree before it was pushed, and **CI is its first execution.**

Section 47 of the brief asked for `PASS` / `FAIL` / `BLOCKED` to stay distinct.
A large part of the requested matrix is `BLOCKED`.

---

## Executive summary

**The codebase is in markedly better security shape than the brief implies.**
Of the four findings carried into this pass, one was real and is now fixed; the
other three were either already solved or are documented, deliberate trade-offs
with tooling already built against them.

Ten further hypotheses — the kind that usually turn into findings on a codebase
this size — were investigated and **refuted by reading the code**. They are
listed in `03-MASTER-ISSUE-REGISTER.md` with the reason each is not a bug,
because the expensive failure mode here is a future audit re-raising them.

The recurring `SEC-…`, `ENG-…`, `AUDIT-…` markers throughout the source show
this code has been audited before and the fixes landed with their reasoning
attached. That is why this pass found one defect and not twenty.

### The one real defect

`submitProductOrder` loaded a product by the client-supplied `productId` and
never checked its `status`. A comment said DRAFT was "allowed on purpose" for
staff preview — correct intent, but the allowance was gated on nothing. The
product page refuses to render a DRAFT piece to a visitor; that was treated as
the control, and a Server Action is a POST endpoint reachable without the page.

Fixed in this branch by gating the allowance on Next's draft-mode cookie, which
`/api/draft` mints only behind `requireStaff()`. Full write-up: `RR-001`.

**It has no siblings.** `public.ts`, `search.ts` and `shop.ts` contain no
`findUnique`/`findFirst` at all — no other public action looks up a record by a
client-supplied id — and the public read paths filter on `status: "PUBLISHED"`.

---

## Issue statistics

| Severity | Found | Fixed | Open |
|---|---:|---:|---:|
| P0 | 0 | 0 | 0 |
| P1 | 1 | 1 | 0 |
| P2 | 1 | 0 | 1 (accepted, in progress) |
| P3 | 3 | 0 | 3 (hardening) |
| Refuted | 10 | — | — |

No P0 was found. That is a statement about the code that was read, not a
guarantee about the code that was not — see the coverage table.

## Test statistics

| | Count |
|---|---:|
| Static test cases evaluated against source | 41 |
| PASS (verified by reading the implementation) | 30 |
| FAIL (defect confirmed in source) | 1 |
| BLOCKED (needs execution — unavailable) | 10 |
| Automated tests added | 6 assertions in 1 new file |
| Automated tests executed by this session | **0** |

---

## Coverage — audited vs not

The honest part of this document.

| Area | Depth | Basis |
|---|---|---|
| Public order actions (`order.ts`) | **Full** | Read line by line |
| Auth guards (`helpers.ts`, `proxy.ts`) | **Full** | Read line by line |
| **Studio RBAC — all action call sites** | **Full** | Swept; see `09` |
| Draft-preview mechanism | **Full** | Read line by line |
| API routes (all 10) | **Full** | Read line by line |
| Upload + storage drivers | **Full** | Read line by line |
| XSS sinks | **Full** | Every sink enumerated and traced |
| Rate limiting | **Full** | Read line by line |
| SSRF module | **Partial** | Guard + redirect handling read; adapters not |
| Image mirroring | **Partial** | Module header + WHERE clauses read |
| Prisma schema | **Partial** | Enums + product indexes only |
| Scraper adapters | **NOT AUDITED** | — |
| Google Sheets sync | **NOT AUDITED** | — |
| Cache/revalidation matrix | **NOT AUDITED** | — |
| Performance / N+1 | **NOT AUDITED** | — |
| i18n completeness | **NOT AUDITED** | Needs `i18n-missing.mjs` |
| SEO / structured data | **NOT AUDITED** | — |
| Accessibility | **NOT AUDITED** | CI gates it on every PR |
| Data quality | **NOT AUDITED** | Needs database access |
| Production smoke test | **NOT AUDITED** | No network testing performed |

The security-critical surface is now covered. The unaudited remainder is mostly
correctness-and-quality rather than security, with one exception: the scraper
adapters. Nothing unaudited is implied to be clean.

---

## Before vs after

| Area | Before | After |
|---|---|---|
| Draft-product order authorization | Vulnerable — any DRAFT id accepted | Fixed — gated on staff draft mode |
| Regression cover for that rule | None | 6 assertions, `order-visibility.test.ts` |
| Studio RBAC | Unverified | Verified — every action guarded, ADMIN where it matters |
| External catalog images | Tooling built, completion unmeasured | Unchanged — needs a DB count |
| CSP | Report-Only | Unchanged — enforcement path documented |
| Typecheck | Unknown | **Passed on CI run 95** |
| Lint / test / build / audits | Unknown | Were still running when the session ended |

---

## Production readiness

### NOT READY

Not because the application looks unhealthy — the code that was read is
well-built, and the security surface now checks out — but because:

1. CI on #138 had not finished when this session ended. Typecheck passed;
   lint, unit tests, the production build and the four audits had not reported.
2. Several requested areas were never examined (table above).
3. Findings 2 (external images) and the data-quality audit both need a database
   count that was never taken.

A session with working command execution can close items 1 and 3 quickly.
`13-PRODUCTION-RELEASE-CHECKLIST.md` is the ordered list.

---

## Documents

| File | State |
|---|---|
| `00-FINAL-QA-SUMMARY.md` | This document |
| `01-ARCHITECTURE-AUDIT.md` | Substantive |
| `02-MASTER-TEST-CASES.md` | Substantive |
| `03-MASTER-ISSUE-REGISTER.md` | Substantive |
| `04-SECURITY-AUDIT.md` | Substantive |
| `05-PERFORMANCE-AUDIT.md` | Runbook — not audited |
| `06-ACCESSIBILITY-AUDIT.md` | Runbook — not audited |
| `07-DATA-QUALITY-AUDIT.md` | Runbook — not audited |
| `08-IMAGE-MIGRATION-AUDIT.md` | Substantive |
| `09-STUDIO-AUDIT.md` | Substantive |
| `10-SCRAPER-AUDIT.md` | Partial |
| `11-GOOGLE-SHEETS-AUDIT.md` | Runbook — not audited |
| `12-REGRESSION-TEST-REPORT.md` | Substantive |
| `13-PRODUCTION-RELEASE-CHECKLIST.md` | Substantive |
