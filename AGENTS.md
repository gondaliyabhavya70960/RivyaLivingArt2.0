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
`tailwind.config`**) · Prisma 7 + Postgres (Neon) · next-intl with **9 locales** ·
Auth.js (staff only) · Vercel + Vercel Blob.

---

## HARD RULES — do not violate these, ever

These are business-model constraints, not preferences. Each one exists because the owner
decided it. An agent that "helpfully" adds one of these has damaged the product.

1. **NO payment gateway, online checkout, or cart payment.** No Stripe, Razorpay, PayPal
   or equivalent. Not behind a feature flag. Not "for later".
2. **NO customer login, membership, or accounts.** The *only* login is the staff studio
   (admin/editor roles) at `/studio`.
3. **NO AI-invented products. Ever.** The catalogue is filled *only* by the owner, via
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
   routes are off-limits to design work (REDESIGN.md §1.1). Fixing a *bug* in those areas
   is fine and often necessary — but it is its own change, with its own justification, not
   something folded into a visual pass.

**Never fabricate.** Not assets, not database rows, not competitor data, not scraper
results, not test results. If something cannot be verified, say that it cannot be
verified. This project has been damaged before by a confident false "done".

---

## Read these, in this order

| File | Lines | Why |
|---|---|---|
| `AGENTS.md` (this) | ~200 | The rules and the shape of the place |
| `PROJECT_STATE.md` | ~600 | **Start every session here.** The SESSION CHECKPOINT block at the top is the resume point; below it: current phase, what is done, what is open, and the decisions that are settled |
| `CLAUDE.md` | ~370 | The operating manual: subsystem-by-subsystem rules that are expensive to rediscover |
| `docs/redesign-contract.md` | ~200 | The short form of the design system: tokens, review rules, hard constraints |
| `REDESIGN.md` | ~1,400 | The full design spec. Read the relevant Part before building any UI — do not read it end to end |
| `CHANGELOG.md` | — | What changed and why, newest first |

**Superseded — do NOT act on these.** They are kept for history and they contradict the
current design:

- `DESIGN.md` (v2.0 "Midnight Gild") and `CONTEXT.md`
- `docs/design-v7-sapphire-atelier.md`
- **`RIVYA LIVING ART_2.0_UI_MASTER_PLAN.md`** — explicitly *not a plan for this repo*. It
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
  staff cookie, and publish per *surface*.
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
  never scroll-jack beyond the two sanctioned pins.
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
BASE_URL=http://127.0.0.1:3000 npm run test:e2e   # 10 smoke checks incl. the WhatsApp rule

node scripts/i18n-missing.mjs                     # keys missing or untranslated
node scripts/redesign-audit.mjs "/,/shop" [--w 390]
node scripts/a11y-audit.mjs   "/,/shop" [--w 390]
node scripts/shots.mjs /tmp/out "/,/shop" --full
```

`npm run build` runs `prisma migrate deploy` and `prisma/bootstrap.ts` before
`next build`, so it fails without a reachable `DATABASE_URL`. That is deliberate.

---

## Definition of done

Every task, not just the big ones:

typecheck ✓ · lint ✓ · tests ✓ · build ✓ · `copy:check` ✓ · 0 missing translations ·
works at **360px and 1280px** · keyboard reachable · reduced-motion checked ·
`redesign-audit` and `a11y-audit` clean at both widths (and RTL for layout changes) ·
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
  translations.** It reports keys that are *missing* or *identical to English*. Editing an
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
- **`mirror-images.yml` (a workflow) and `src/app/api/cron/mirror-images/route.ts` (a LIVE
  production cron) have almost the same name.** Do not delete by grep.
- **`public/` is load-bearing and was once missing entirely** — 242 files, 62 image slots.
  Three guards now fail loudly if it goes away: `site-images.test.ts`,
  `bundled-media.test.ts`, and a broken-image rule in `redesign-audit.mjs`.
- **Owner edits outrank every writer.** The sheet importer and the scraper refresh
  availability only when `ownerTouched` — never content, never images. The rule lives once,
  in `src/lib/scraper/merge-policy.ts`, and it is checked *before* `needsRewrite`.
- **Sheet row deletion is not upsert-in-reverse.** It needs the tab's numeric id and rows
  must be removed in *descending* index order; an ascending pass deletes the wrong rows and
  succeeds while doing it.
- **CI runs now — but it cannot reach everything.** Until 2026-08-31 GitHub Actions was blocked by
  an account-level billing condition (jobs failed in ~2s with `runner_id: 0`) and every gate that
  passed was run locally. On 2026-09-02 run #71 executed both `ci.yml` jobs on PR #29 on a real
  runner. A green PR is now evidence for what `ci.yml` covers; it is still not evidence for the
  detail routes (`/product`, `/blog`, `/portfolio`, `/p`), the E2E smoke, or widths other than
  1440/390 — run those yourself and say so.

---

## Branch and PR conventions

Work happens on feature branches off `main`, one phase per PR, with the verification
evidence in the PR body. Pull requests are opened as drafts. The owner merges.
