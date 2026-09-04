<!--
The PR body is the verification evidence (AGENTS.md, "Branch and PR conventions").
Delete any section that genuinely does not apply and say why in one line — an
empty heading tells a reviewer nothing, and a deleted one with no reason reads
as an oversight.
-->

## What changed, and why

<!-- The change in a few sentences: what a visitor or the owner can now do that
they could not before, or what was broken and now is not. Link the phase, the
roadmap entry or the audit finding this closes. -->

## How it was verified

<!-- "If you say it works, you have run it." Paste the real results — a command
you did not run is a blank, not a tick. For a fix, reproduce the failure first,
then show the same check passing. -->

| Gate | Result |
|---|---|
| `npm run typecheck` | |
| `npm run lint` | |
| `npm run test` | |
| `npm run copy:check` · `i18n-missing` | |
| `npm run build` | |
| `npm run test:db` | |
| `redesign-audit` · `a11y-audit` | |
| `keyboard-audit` · `npm run test:e2e` | |

**By hand** (CI cannot do these for you):

- [ ] Works at **360px** and **1280px**
- [ ] Keyboard reachable — including any overlay or lightbox this touches
- [ ] Reduced motion checked (`scripts/shots.mjs --reduced`)
- [ ] RTL checked, if this changes layout — Arabic is a shipped locale
- [ ] Screenshots looked at by a person

## HARD RULES

<!-- REDESIGN.md §1.1 · Part 0 wins all conflicts. Tick each one you can stand
behind; if the PR touches none of a rule's territory, say "not touched". -->

- [ ] No payment gateway, checkout or cart payment
- [ ] No customer login, membership or account — the only login is the staff studio
- [ ] No AI-invented products, reviews or testimonials reaching production
- [ ] The order flow still opens `wa.me/917096036250` with the correct pre-filled message (a demo piece saves `isDemo` and prefixes `[DEMO] `)
- [ ] Data, filtering, search, uploads, Server Actions, auth, URLs and routes unchanged — or changed in their own justified commit, never as a side effect of a visual change

## Design and content

- [ ] Colours, spacing and motion come from the REDESIGN.md Part 3 tokens — no invented values, no raw hex in components
- [ ] Logical properties (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`), not physical ones
- [ ] Every new string goes through next-intl and exists in **all nine locales**; `npm run copy:registry` run if the registry changed
- [ ] Any new table storing a media URL joined `src/lib/media-usages.ts` **in this PR** — that rule has been broken three times, and each break was silent

## Notes for the reviewer

<!-- Where to look hardest, what you are least sure of, and anything you
deliberately left undone with the reason. A known limitation stated here is
worth more than one a reviewer finds. -->
