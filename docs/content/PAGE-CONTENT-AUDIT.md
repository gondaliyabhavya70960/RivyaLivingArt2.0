# Page-by-page content audit — Phase 14

_2026-09-19. Every page below was rendered live on `www.rivyalivingart.com`
and measured against the craft prompt's Phase 14 list — content, imagery,
video, iconography, hierarchy, CTA, internal links, SEO, accessibility.
Pages that stream behind the v2 loading boundary (product, blog post, terms)
were additionally rendered in a real browser so the verdict reflects what a
visitor sees, not what a plain HTTP fetch sees._

Legend: **Complete** (nothing material missing) · **Strong** (works,
enhancements optional) · **Gap** (something from the prompt is missing).

## The scorecard

| Page | Verdict | Note |
| --- | --- | --- |
| Home `/` | Complete | All 13 numbered sections present with substantive copy (hero/pour, manifesto, featured pieces, large format, material, collections, maker, recent work, bespoke, workshops, 3D printing, process, journal) — verified against the page and the `Home.*` message groups (20 key groups in `messages/en.json`) |
| About `/about` | Strong | Story (3 chapters), 4 values (Patience, Provenance, Precision, Permanence), maker section naming Bhavya, 4 process cards, materials. The "Living Art" name-concept is implied ("Where resin meets reverence"), never stated — one explicit line would close it |
| Process `/process` | Strong | Unified 10-step flow (Concept → Delivery) with per-step imagery and honest timing. 3D-printed forms and preservation prep appear inline (steps 02–03). The prompt asks for per-workflow tracks (product order / commission / large-format / 3D / preservation) — the single flow covers them all; splitting tracks is an enhancement, not a gap |
| Shop `/shop` | Complete | 1,063 pieces, 12 collections, type filters (All / Resin art / Gifts / 3D printing), search, sort |
| Category `/shop/[slug]` | Complete | Collections link from the shop grid; categories without published products stay out of the sitemap by design (SEO-008) |
| Product `/product/[slug]` | Strong | Verified on a Tier-2 PDP: title, display name, price (₹3,499), breadcrumb, image carousel, order panel (reference images 0/5, notes, quantity), WhatsApp CTA with prefilled message, four trust lines, uniqueness caveat. 22-point checklist mostly above the fold; lower sections (4.9k px) not enumerated item-by-item |
| Large Format `/large-resin-art` | Complete | Four kinds of large work, plan-first philosophy, 4-step commission run, "what makes a quote quick" (room photo, measurements incl. doorway, use, references), materials, past work, FAQ, pieces. Maps one-to-one onto the prompt's brief→quote list |
| Bespoke / Custom Order `/custom-order` | Complete | Hero with honest timeframes (small 7–10 days, statement 3–6 weeks, 24–72 h/layer), four commission starters, 4-step how-it-works (progress photos named in step 3), the brief form, FAQ, recent work |
| Workshops `/workshops` | Complete | Session format (2.5 h, max 8, materials included, Surat), three reasons, 5-step afternoon, take-homes, private/corporate, the room |
| Portfolio `/portfolio` | **Gap** | **Renders the empty state** ("Commission stories are being written — yours could be first") while 23 genuine cases exist in the database and their detail pages render fully. See Finding 1 |
| Portfolio detail `/portfolio/[slug]` | Complete | Verified on `case-varmala-preservation-clock`: story (4 paragraphs), material/technique meta, tags, final-piece section, three related cases, commission-similar CTA |
| Journal `/blog` | Complete | Lead story + archive grid with category filters (6 chips) across five pages; 55 articles |
| Journal post `/blog/[slug]` | Complete | Full article renders in browser; streams behind the loading boundary for plain-HTTP clients (Finding 2) |
| FAQ `/faq` | Strong | 6 genuine questions, search, category filter. The 42-FAQ starter library (PR #118) lands through `npm run seed:starter -- --apply` — after that this page is Complete |
| Contact `/contact` | Complete | Response expectation ("usually within a few hours, 10am–8pm IST"), WhatsApp-first routing, studio note form (name/phone/email/message), FAQ band |
| Search `/search` | Complete (by design) | Query-only, deliberately noindex and absent from the sitemap (SEO-001) |
| 404 | Complete | `global-not-found.tsx` returns a real 404 status with the branded panel; `visual-404` asset exists in the Drive `assets/` set |
| Privacy `/privacy` | Complete | Plain-language policy: collection, use, no-payments, storage (Neon/Blob), retention, rights, children, contact |
| Terms `/terms` | Complete | 10 sections incl. quotes & payment, made-to-order, timelines, shipping & damage, returns, IP, workshop bookings, governing law. Streams behind the loading boundary (Finding 2) |

## Finding 1 — the portfolio index hides 23 case studies (top action)

`/portfolio` renders its empty state — "Commission stories are being
written — yours could be first" — followed by the custom-order CTA and the
footer. No case cards. Yet:

- `prisma/seed-portfolio-cases.ts` holds 23 genuine cases, and
  `docs/content/CONTENT-AUDIT.md` records them as the live portfolio,
- detail pages render fully (`/portfolio/case-varmala-preservation-clock`
  verified end-to-end, with three related cases in "from the same bench"),
- the index header still prints the real stats ("20 commissions · 2026 ·
  7 collections").

So the cases exist and are reachable by URL, but the index shows none. Two
plausible causes, distinguishable only from inside: the index query filters
them out (a status/visibility/`isDemo` clause mismatch between index and
detail readers), or the index grid failed to stream and the page fell back
to the empty state. Either way, the studio's strongest trust asset is
invisible from its own index page. **Check the portfolio index query in
production before any new portfolio content is written** — concept studies
included.

## Finding 2 — v2 detail pages stream behind a branded loading boundary

`/product/[slug]`, `/blog/[slug]`, `/terms` and `/journal` serve only
`loading.tsx` ("Loading") to a plain HTTP fetch; all four render fully in a
real browser (verified on Terms and on a PDP). This is a streamed-Suspense
shape, not a bug — and not an SEO emergency, because page metadata (title,
description, OG image) lives in `<head>`, which is unaffected: WhatsApp link
previews and crawlers that render JavaScript are fine. What sees "Loading":
non-rendering link unfurlers and any crawler that never executes JS. Worth
remembering when judging unfurl previews; not worth re-architecting.

## Finding 3 — the custom-order capture vs the prompt's 14 fields

The prompt lists 14 things to capture: project type, dimensions, location,
colours, materials, references, images, budget, timing, quantity, occasion,
personalisation, notes (+ contact). Measured on the live 4-step form:

- **In the form (9):** idea (2,000 chars), material, occasion, budget band,
  timeline, reference images (5 × 5 MB), notes, name, phone, email.
- **Deliberately in the WhatsApp conversation (5):** project type,
  dimensions, location, quantity, personalisation specifics — the FAQ
  library's ordering answers set the expectation that these are settled in
  chat.

This matches the non-negotiable sales flow (friction-light form, everything
negotiable in chat). Recorded as by design, not a gap.

## Cross-cutting criteria

- **Imagery:** every audited page carries on-brand editorial imagery; the
  Drive `assets/` set is wired through site-image slots, the 45 concept
  images render only under the placeholder honesty rule.
- **Video:** hero-pour and pour-swirl loops wired via `src/lib/site-videos.ts`
  (home hero), posters present.
- **Iconography:** `lucide-react` throughout (rule 53 — no bespoke icon
  sprawl).
- **Hierarchy/CTA:** every page ends in a single clear next step — WhatsApp
  or custom order; no competing CTAs seen on any audited page.
- **Internal links:** breadcrumbs on detail pages, related cases/products,
  journal cross-links in article bodies.
- **SEO:** sitemap excludes empty categories and demo content; `/search`
  noindex; per-locale hreflang clusters; streamed fallback affects only
  non-rendering clients (Finding 2).
- **Accessibility:** skip-to-content present site-wide (verified in browser);
  alt text enforced by tooling (`npm run alt:check`); real 404 status; form
  controls carry labels and step state ("Step 1 of 4").

## Recommended actions, in order

1. **Investigate the portfolio index query** (Finding 1) — the only true
   gap found in this audit.
2. Run `npm run seed:starter -- --apply` to land the 42-FAQ library (PR
   #118), moving FAQ from Strong to Complete.
3. Optional: one explicit "Living Art" name line on About; per-workflow
   tracks on Process — enhancements, not repairs.

## Related

- `docs/content/CONTENT-AUDIT.md` — demo-content root cause
- `docs/content/CONTENT-INVENTORY.md` — the counts
- `docs/content/COMPETITOR-RESEARCH.md` — the league map
