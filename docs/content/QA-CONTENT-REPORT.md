# QA content report — Phases 28–30

_2026-09-19, executed against production (`www.rivyalivingart.com` and
`/studio`). Read-only throughout, with exactly one deliberate write: the
owner-delegated starter-content apply via Studio → Content Health. No forms
were submitted, no demo data written, nothing deleted._

## Phase 28 — Public website

| Area | Result | Evidence |
| --- | --- | --- |
| All 20 page types render | **Pass** | Full matrix in `PAGE-CONTENT-AUDIT.md`; streamed pages verified in a real browser |
| robots.txt | **Pass** | `Allow: /`, `Disallow: /api`, sitemap declared |
| sitemap.xml | **Pass** | HTTP 200, **2,019 URLs** — products (default-locale), 13 static × 9 locales, categories/posts/portfolios/landers with hreflang clusters. Portfolio cases **are present** (they pass the `PUBLISHED + isDemo:false` clause) |
| Security headers | **Pass** | Full CSP with `report-uri`, HSTS `max-age=63072000; includeSubDomains; preload`, `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: strict-origin-when-cross-origin` |
| Locale behaviour | **Pass** | `/hi` serves `lang="hi"` with fully translated title and content; default locale stays unprefixed |
| WhatsApp fallback route | **Pass** | `/whatsapp-order` → HTTP 200, claim-token gated (ENG-811) |
| Global 404 | **Pass** | Unknown routes return a real HTTP 404 with the branded panel |
| **Unknown product/blog/category slugs** | **FAIL — soft 404** | `/product/<bad-slug>` returns **HTTP 200** with the "Piece not found" branded panel (same for blog/category). Truly unknown routes correctly return 404. The in-tree `notFound()` path streams a 200 — the codebase's own comment in `global-not-found.tsx` documents this trade-off. Google treats these as soft 404s: wasted crawl, no clear "gone" signal |
| Demo content visibility | **Pass** | Zero demo rows in production; nothing synthetic can render (host guard held since deploy) |
| Desktop rendering | **Pass** | All audited pages |
| Tablet/mobile viewports | **Not certified here** | Viewport-specific QA needs a device lab; responsive Tailwind layout in use. Left to owner spot-check — flagged, not glossed |

## Phase 29 — Studio (read-only + one delegated write)

| Screen | Result | Evidence |
| --- | --- | --- |
| Login | **Pass** | Credentials flow works; forgot-password link present |
| Overview | **Pass** | Real metrics render: 1,083 published products (T1 55 / T2 547 / T3 481 / untiered 0), 10 in review, 16 drafts, 55 journal, 20 portfolio, 0 testimonials, 0 demo records, 2,854 media, 1,407 scraped, 424 catalog-fill runs |
| Products / Categories | **Pass** | Listed with tier architecture and filters |
| Portfolio | **Pass — and diagnostic gold** | All 20 cases are **PUBLISHED**, 0 drafts/review/archived, `isDemo:false`. The public index's empty state is therefore an **index-side rendering bug, not a data problem** (header count works, grid does not) |
| Journal | **Pass** | 55 published, 0 without cover image |
| FAQs | **Pass** | Was 6/6 published → 48/48 after the starter apply |
| Testimonials | **Pass (correct zero)** | 0 rows; publish requires `permissionStatus: GRANTED` — the no-invented-words rule is enforced in code |
| Inquiries | **Pass (empty, intact)** | 0 genuine inquiries; 9-status pipeline model verified in schema |
| Research | **Pass** | Was "No research yet" → 42 records after apply |
| Media Library | **Pass with note Q2** | 2,854 files — **2,854 without alt text**. Content Health surfaces it; alt set here is inherited everywhere the file is used |
| Settings | **Pass** | Screens render |
| Content Lab | **Pass** | 0 demo rows everywhere, host guard refuses production writes ("Allow-listed: No · Looks like production: Yes"), Demo Data Manager present (per-entity counts, row selection, typed confirmation, shared-media protection) |
| Content Health | **Pass** | Genuine-only counters for every entity; starter-content panel with dry-run preview |
| Demo Manager bulk ops | **Pass by architecture + tests** | Selection/entity-select/remove-all/typed confirmation/server-side `isDemo` re-check/genuine + shared-media protection all verified in `src/lib/demo/selective.ts` and covered by the passing suite. Not executed against production — there is nothing to delete |
| Editing / publishing / archive / translations | **Screens verified, actions not executed** | Edit links and status controls render (portfolio, FAQs, journal). Read-only QA: no records were modified |

## The one deliberate write — starter content apply (owner-delegated)

Studio → Content Health → "Add the missing content", after the built-in dry
run previewed `42 + 8 + 42 to add · 0 already there`:

**"Added 92 items. 0 already present and left alone."**

- FAQs: 6 → **48 questions, all published** (42 new, sorted after the owner's six — orders 7–48)
- Portfolio: 20 published genuine + **8 concept studies as DRAFT** (labelled `concept-study`, never public until the owner publishes with real photography)
- Research: 0 → **42 records** (internal only)
- Public `/faq` serves the library within the cache window (fresh HTML: "48 questions" + new entries verified)
- Nothing existing was changed, updated or deleted — the seeder's core promise, confirmed against live data

## Phase 30 — Business flow regression

The write path was verified by code inspection and non-submitting live
checks — **no test inquiry was created in the production pipeline** (a QA
submission would pollute the owner's real lead inbox; the demo-inquiry set
exists for pipeline QA on non-production environments).

| Chain link | Result | Evidence |
| --- | --- | --- |
| Product → Customisation | **Pass** | PDP order panel verified live: displayName, price, reference images (0/5, 5 MB cap), notes, quantity, per-product customization fields in schema |
| → Contact information | **Pass** | Name / phone / email(optional) on the order panel; same shape on the 4-step custom-order form (idea → details → references → contact) |
| → Inquiry saved | **Pass by code** | `src/actions/order.ts` server-validates and saves; `Inquiry.number` is a Postgres autoincrement sequence (#RR-…) |
| → WhatsApp message | **Pass by code** | `src/lib/whatsapp.ts` constructs the message from selections + contact; demo orders are prefixed `[DEMO] ` |
| → WhatsApp redirect | **Pass** | `wa.me/917096036250` links verified live with prefilled product message on the PDP |
| Fallback + claim token | **Pass** | `/whatsapp-order` renders (HTTP 200); re-read requires the one-time claim token hash (ENG-811) |
| Studio pipeline fields | **Pass** | `quotedPrice`, `finalPrice`, `staffNotes`, `attribution` (UTM/referrer/landing) all present in schema; staff-only fields never selected by public readers |
| Reference uploads | **Pass** | 5-image cap, type/size validation visible on the live panel; Blob storage in schema |
| Locale behaviour | **Pass** | `/hi` verified end-to-end; 9 locales in `messages/` |
| Studio pipeline (Inquiries screen) | **Pass (empty)** | 0 genuine inquiries; board/list views render; statuses NEW→LOST in model |

## Test suite

`npm test` on `main` at merge state: **122 files, 1,348 tests, 0 failed**
(31.6 s). Includes the demo-clause, starter-apply, selective-removal,
fixtures and placeholder-assets suites. `npm run test:e2e` (e2e-smoke) was
not run — it needs a running app + DB and is a CI job, not a code
conclusion.

## Findings register

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| Q1 | Medium (SEO) | Soft 404: unknown product/blog/category slugs return HTTP 200 with the not-found panel | Open — fix decision needed (in-tree `notFound()` vs the comment in `global-not-found.tsx`) |
| Q2 | Low (a11y/SEO) | 2,854 of 2,854 media-library files have no alt text; inherited everywhere used | Open — owner pass, or an assisted alt-writing task |
| Q3 | Note | Public pages serve stale content for one cache window after Studio writes (observed: `/faq` showed 6 briefly after the apply, correct 48 on fresh fetch) | By design — ISR; not a bug |
| — | Medium | **Portfolio public index renders empty state while 20 cases are PUBLISHED** (from PAGE-CONTENT-AUDIT Finding 1, now confirmed from inside Studio) | Open — index-side rendering bug; code fix offered as next PR |
| — | Info | Viewport (tablet/mobile) certification not executable from this environment | Owner spot-check |

## Related

- `docs/content/PAGE-CONTENT-AUDIT.md` — the 20-page content matrix
- `docs/content/FINAL-REPORT.md` — the Phase 32 report
- `docs/content/DEMO-DATA-MANAGEMENT.md` — the demo architecture
