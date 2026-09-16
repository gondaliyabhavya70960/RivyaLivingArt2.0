# AGENTS.md — Rivya Living Art

Cross-tool instructions for any coding agent working in this repository (Antigravity,
Cursor, Claude Code, Copilot, or a human who has not read the rest of the docs yet).

This file is **self-contained for the things that are dangerous to get wrong**. Everything
else points at the document that owns it. If this file and `CLAUDE.md` ever disagree,
`CLAUDE.md` and `REDESIGN.md` Part 0 win — but nothing below should ever be in conflict
with them, and a conflict is a bug in this file.

---

## What this is

A premium resin-art brand site for a real, operating studio in India. It is **live** at
`https://www.rivyalivingart.com`, it carries **4,385 real products**, and the owner takes
real orders through it. There is no staging safety net for the catalogue: the products,
the categories and the inquiries are the business.

Next.js 16.3 (App Router) · React 19 · TypeScript strict · Tailwind v4 (CSS-first, **no
`tailwind.config`**) · Prisma 7 + Postgres (**Prisma Postgres at `db.prisma.io`** — not Neon, whatever older docs say) · next-intl with **9 locales** ·
Auth.js (staff only) · Vercel + Vercel Blob.

---

## HARD RULES — do not violate these, ever

These are business-model constraints, not preferences. Each one exists because the owner
decided it. An agent that "helpfully" adds one of these has damaged the product.

1. **NO payment gateway, online checkout, or cart payment.** No Stripe, Razorpay, PayPal
   or equivalent. Not behind a feature flag. Not "for later".
2. **NO customer login, membership, or accounts.** The _only_ login is the staff studio
   (admin/editor roles) at `/studio`.
3. **NO AI-invented products. Ever.** The catalogue is filled _only_ by the owner, via
   scraper review + approval, Bulk Import (Google Sheets/CSV), or manual adds in
   `/studio`. Never write a product, a price, a review, a testimonial or a portfolio item
   that the owner did not supply. If a page needs content that does not exist, render
   nothing and say so.
4. **Every order finalises through WhatsApp.** Place Order → build the order summary →
   save an `Inquiry` row via a Server Action → redirect to `wa.me/917096036250` with the
   complete pre-filled message. This flow is covered by `npm run test:e2e`; if you change
   anything near it, run that.
5. **The redesign changes the VISUAL layer only.** Product data, filtering, search,
   customization fields, uploads, Server Actions, auth, Studio/CMS behaviour, URLs and
   routes are off-limits to design work (REDESIGN.md §1.1). Fixing a _bug_ in those areas
   is fine and often necessary — but it is its own change, with its own justification, not
   something folded into a visual pass.

**Never fabricate.** Not assets, not database rows, not competitor data, not scraper
results, not test results. If something cannot be verified, say that it cannot be
verified. This project has been damaged before by a confident false "done".

---

## The catalogue has THREE TIERS, and they are not three filters

The owner's product architecture, supplied 2026-09-15 and **in force**. Full document:
**`docs/plan/07-three-tier-architecture.md`**.

| Internal | Customer-facing | The work | The journey |
| --- | --- | --- | --- |
| `LARGE_FORMAT` | Collectible Furniture & Spatial Art | Dining/coffee/side tables, seating, benches, large panels, sculptures, installations | Explore → View Project → Customize → Consultation |
| `MEDIUM_FORMAT` | Memory & Celebration Art | Varmala & bouquet preservation, wall clocks, engagement trays, wedding frames, keepsakes | Choose Style → Size → Upload Memory → Customize → Order |
| `SMALL_FORMAT` | Personal Art & Gifting | Rakhi, jewellery, keychains, bookmarks, coasters, magnets, festive and corporate gifting | Browse → Personalize → Order |

Three customer intents with different price ladders, customization depth and interface
density, sharing **one** brand language. Not three websites, and not a facet on the shop
page. "Tier 1/2/3" is internal vocabulary for the database and the Studio; customers see
column two.

Four things about it that are expensive to get wrong:

- **`Product.tier` is NOT this.** That column is the owner-sheet import tier
  (1 owner · 2 resin goods · 3 supplies · 4 3D-print), an indexed `Int?` that the shop's
  default sort and nine other readers depend on. The size taxonomy is a separate nullable
  enum column, **`Product.sizeTier`**. `tier` is where a product came from; `sizeTier` is
  what it is.
- **`ScrapeSource.tier` is a third thing** — which supplier list we went looking in. It
  carries the same three names, which is exactly why they get confused.
- **Tier 03's "Add to Cart / Checkout" does not exist here.** HARD RULE 1 wins: it is fast
  WhatsApp ORDERING, not fast checkout. The conflict is recorded, not quietly resolved.
- **Ten further conflicts with REDESIGN.md §1.1 and Part 0 are open** (T2–T11 in that
  document): the header nav's four items, seven proposed product fields, Tier 02's upload
  flow, a homepage band that would breach the dark-band rhythm, a CTA the `Inquiry` schema
  cannot record. Each stops at a question rather than being built around.
- **The storefront reads `sizeTier` in exactly three places** (steps 7–8, 2026-09-16): the
  collectible card variant (`card-meta.ts` decides, `/large-resin-art` passes it by
  context), the PDP's order presets (`tier-order-copy.ts`; out of stock wins), and the
  shop's `?sizeTier=large|medium|small` facet. Every customer-facing word comes from the
  `ProductTier.<enum>` block in `messages/*.json`, whose `name`/`shortName` a test pins to
  the studio's labels. The scraper only SUGGESTS a tier (`size-tier-suggest.ts`), never
  stores one.

---

## Read these, in this order

| File                        | Lines  | Why                                                                                                                                                                                |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` (this)          | ~200   | The rules and the shape of the place                                                                                                                                               |
| `PROJECT_STATE.md`          | ~600   | **Start every session here.** The SESSION CHECKPOINT block at the top is the resume point; below it: current phase, what is done, what is open, and the decisions that are settled |
| `CLAUDE.md`                 | ~370   | The operating manual: subsystem-by-subsystem rules that are expensive to rediscover                                                                                                |
| `docs/redesign-contract.md` | ~200   | The short form of the design system: tokens, review rules, hard constraints                                                                                                        |
| `REDESIGN.md`               | ~1,400 | The full design spec. Read the relevant Part before building any UI — do not read it end to end                                                                                    |
| `CHANGELOG.md`              | —      | What changed and why, newest first                                                                                                                                                 |
| `docs/plan/README.md`       | ~200   | The index of the five workstreams currently in force (redesign · scraper rebuild · Sheets removal · asset pipeline · **the three-tier product architecture**)                     |
| `docs/plan/07-three-tier-architecture.md` | ~230 | **The product architecture. Read it before touching product cards, the PDP, navigation, the shop facets or the scraper's classification** — the summary is in "The catalogue has THREE TIERS" above |

**Superseded — do NOT act on these.** They are kept for history and they contradict the
current design:

- `DESIGN.md` (v2.0 "Midnight Gild") and `CONTEXT.md`
- `docs/design-v7-sapphire-atelier.md`
- **`RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md`** — explicitly _not a plan for this repo_. It
  was written against an older tree, assumes a dependency that is not installed, and most
  of it is already built, factually wrong here, or forbidden by the rules above.
  `docs/ui-master-plan-reconciliation.md` checks all 213 of its entries against HEAD.

---

## The one pattern the CMS follows

Eight studio surfaces all work the same way, and the sameness is the point:

```
registry in code   →   overrides in the database   →   a TOTAL resolver
```

The registry is the source of truth for what **exists**. The table stores only what the
owner **changed**. The resolver is **total**, so an empty table, a fresh database and an
unreachable one all render the page the repo ships with rather than a blank one.

Adding a surface means following this, not inventing a ninth shape. Four rules hold across
all of them:

- **A save is a DRAFT.** Copy and images stage in `draftValue`/`draft`, preview behind the
  staff cookie, and publish per _surface_.
- **Guardrails refuse, they do not warn** — CI does not run when an owner presses Publish.
- **Landing pages are the one place content lives in the row.**
- **Every new table that stores a media URL goes into `src/lib/media-usages.ts` in the same
  commit.** This rule has been broken four times and every break was silent.

---

## Conventions you will otherwise get wrong

- **Server components by default.** `"use client"` only for interactivity or motion.
- **Never call `setState` synchronously in an effect body** — the repo lints for it
  (`react-hooks/set-state-in-effect`). Use `useSyncExternalStore`, an event callback, or a
  direct DOM write.
- **No raw hex in components.** Tailwind classes referencing the design tokens only; the
  tokens live in `src/styles/tokens.css` and `src/app/globals.css`.
- **Logical properties everywhere** — `ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`. Arabic is a
  shipped locale and an unmirrored RTL is worse than none.
- **Numerics are mono and tabular** — every price, count, date, dimension and cure time.
- **Motion** must use the Part 3.8 tokens, must have a reduced-motion fallback, and must
  never scroll-jack beyond the two sanctioned pins. The fallback is gated:
  `redesign-audit.mjs` loads every audited route a second time under
  `prefers-reduced-motion: reduce` and fails on anything still animating, any scroll-linked
  timeline and any video playing by itself.
- **All user-facing copy goes through next-intl.** Add the key to `messages/en.json`
  first, then translate the batch into `ar de es fr gu hi ja zh`.
- **Commits:** `feat|fix|chore|refactor(scope): message`. Small, verified commits.
- **TypeScript strict, no `any`, named exports.**

---

## Commands

```bash
npm run dev                 # local dev
npm run typecheck           # tsc --noEmit
npm run lint -- --fix       # eslint
npm run test                # vitest, pure src/lib functions
npm run build               # migrate deploy + bootstrap + next build — NEEDS a database
npm run copy:check          # the copy registry must match messages/en.json
BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # the E2E smoke (storefront contract, order flow, Studio paths)

node scripts/i18n-missing.mjs                     # keys missing or untranslated
node scripts/redesign-audit.mjs "/,/shop" [--w 390]
node scripts/a11y-audit.mjs   "/,/shop" [--w 390]
node scripts/shots.mjs /tmp/out "/,/shop" --full
```

`npm run build` runs `prisma migrate deploy` (through `scripts/migrate-deploy.mjs`, which retries a database that is merely unreachable) and `prisma/bootstrap.ts` before
`next build`, so it fails without a reachable `DATABASE_URL`. That is deliberate.

---

## Definition of done

Every task, not just the big ones:

typecheck ✓ · lint ✓ · tests ✓ · build ✓ · `copy:check` ✓ · 0 missing translations ·
works at **360px and 1280px** · keyboard reachable · reduced-motion checked ·
`redesign-audit` and `a11y-audit` clean at every CI width (and RTL for layout changes) ·
`keyboard-audit` and `npm run test:e2e` green against the built server ·
**HARD RULES respected** · the order flow still opens `wa.me/917096036250` with the
correct pre-filled message.

And the one that matters most: **if you say it works, you have run it.** Prove a fix by
reproducing the failure first, then showing it gone.

---

## Traps that have actually cost people hours

- **A resolved default is not a user choice.** `normalizeEcosystemParam` always sets
  `filters.type`, so code asking "did the visitor filter?" sees a filter nobody applied.
  This has caused three separate bugs.
- **`scripts/i18n-missing.mjs` does not catch a changed English value with stale
  translations.** It reports keys that are _missing_ or _identical to English_. Editing an
  English string and leaving the other eight is invisible to every gate in the repo — so a
  copy change is a nine-file edit, always.
- **`messages/en.json` and `src/lib/site-copy.generated.ts` must be regenerated together**
  or `copy:check` fails in CI.
- **`happy-dom` and `three` look unused and are not.** `@tiptap/html/server` imports
  `happy-dom` at the top level; `three` is a required peer of `@google/model-viewer`,
  which the PDP gallery renders. Removing either breaks production. See PROJECT_STATE.md.
- **`prisma/reconcile-blog-covers.ts` is one-way.** It flips 55 blog cover rows to local
  paths, matching only `NULL` or the old remote URL. Once flipped it cannot re-run to
  repair, so anything that removes `public/images/blog/` 404s them permanently.
- **`src/app/api/cron/mirror-images/route.ts` is a LIVE production cron** (daily at
  02:30 UTC, `vercel.json`). The near-identically-named `mirror-images.yml` workflow was
  deleted under D24 once `public/` was committed — which is exactly the trap that note
  warned about, so it was deleted by path after reading both, never by grep. The route
  stays.
- **`public/` is load-bearing and was once missing entirely** — 242 files, 62 image slots.
  Three guards now fail loudly if it goes away: `site-images.test.ts`,
  `bundled-media.test.ts`, and a broken-image rule in `redesign-audit.mjs`.
- **Owner edits outrank every writer.** The CSV importer and the scraper refresh
  availability only when `ownerTouched` — never content, never images. The rule lives once,
  in `src/lib/scraper/merge-policy.ts`, and it is checked _before_ `needsRewrite`.
- **Google Sheets is gone** (2026-09-15). The push engine, the per-source sync policy
  and the service-account client were deleted; the confirmed list exports from
  `/studio/exports` as CSV or XLSX instead. The rule that used to sit here — sheet row
  deletion needs the tab's numeric id and a _descending_ index order, because an
  ascending pass deletes the wrong rows and succeeds while doing it — has no code left
  to govern. It is kept in `docs/archive/google-sheets.md` for whoever rebuilds this.
- **CI runs now, and it reaches almost everything.** Until 2026-08-31 GitHub Actions was blocked
  by an account-level billing condition (jobs failed in ~2s with `runner_id: 0`) and every gate
  that passed was run locally. On 2026-09-02 run #71 executed both `ci.yml` jobs on PR #29 on a
  real runner. Since F2 (2026-09-04) the build job seeds the Content Lab demo set and sweeps the
  detail routes on deterministic slugs, runs the E2E smoke against the started server, audits at
  1440 · 1280 · 390 · 360 (touch contexts and a failing 44px floor at phone widths), the RTL set,
  the keyboard paths including the lightboxes, the Studio at both widths and Lighthouse. A green
  PR is evidence for all of that. It is still not evidence for screenshots looked at by a person,
  reduced motion by eye, or a route with content only your database has — run those yourself
  and say so.
- **The session container restarts after idle stretches.** Running subagents' shells freeze
  (their last tool call never returns) and the local Postgres cluster is down until restarted
  (`pg_ctl … start` per PROJECT_STATE's environment recipe). Keep long work inside active turns,
  and check `uptime` before blaming a script.
- **`npm run test:db` seeds and REMOVES a demo set of its own** in whatever database it points
  at. Re-seed (`npm run seed:demo`) before any audit or smoke that needs `/product/demo-product-001`.
- **The CI runner has real internet; this sandbox does not.** A wa.me tab on the runner follows
  WhatsApp's 301 to `api.whatsapp.com/send/?phone=…&text=…` (spaces re-encoded as `+`), which
  is what failed the first E2E smoke run on `main` after it passed here. The smoke now answers
  the wa.me navigation inside the browser context and asserts on the recorded link; any new
  check that reaches an external host needs the same treatment or a runner-shaped fixture.

---

## Branch and PR conventions

Work happens on feature branches off `main`, one phase per PR, with the verification
evidence in the PR body. Pull requests are opened as drafts. The owner merges.
