# Antigravity prompt deck — finishing Rivya Living Art

Nine prompts that complete the remaining work, in dependency order. Written to be pasted
into Google Antigravity (or any agentic IDE), **one task per conversation**.

Two ways to use this file:

- **Paste** the fenced block for a task into a fresh conversation, or
- **Point at it** — `do task 03 from docs/antigravity-prompts.md` — now that the file lives
  in the repository.

**Run them one at a time.** Antigravity's quota is compute-based and scales with chat
length, so one long conversation gets expensive and drifts. Each task also wants its own
branch and pull request: if a design audit goes red, it has to be obvious which change
caused it.

`AGENTS.md` is on `main`, so every conversation picks up the hard rules automatically.
The prompts below deliberately do not repeat them.

> **Task 02 contains a placeholder you must fill in** before pasting. Everything else is
> ready as written.

**State this was written against:** `main` at `f0ae822`, after PR #12 merged.

---

## Contents

| # | Task | Status |
|---|---|---|
| 00 | Working agreement | run once, first |
| 01 | Fix `.env.example` — it ships the retired domain | ready |
| 02 | Retire the superseded tagline | **needs your sentence** |
| 03 | Close the media-delete hole | ready · data loss |
| 04 | Wire the LQIP placeholders | ready |
| 05 | Make the reference documents true | ready · parallel-safe |
| 06 | Three security hardening items | ready · parallel-safe |
| 07 | The first database-backed tests | ready · do with or before 03 |
| 08 | Enforce the CSP, in the right order | ready · parallel-safe |

Tasks 05–08 touch no shared files, so Antigravity's Agent Manager can run them
concurrently with the sequential ones.

---

## 00 · Working agreement

Run this **once**, in a fresh conversation, before any task. It ends by making the agent
prove it read the documentation — if the answer is vague, start over rather than
proceeding.

```
Read AGENTS.md and PROJECT_STATE.md in full before doing anything else. Follow AGENTS.md's hard rules for every task in this repository — they are business constraints set by the owner, not preferences.

Three things about how I want you to work here:

1. CI only started working on 1 September 2026. Before that, GitHub Actions could not allocate a runner on this repository — an account billing condition — so every check that passed across twelve merged pull requests was run on someone's laptop. Billing is fixed and CI now runs green. Trust it going forward, but treat anything merged before that date as self-verified. And still never report a gate as passing unless you saw the output yourself.

2. Prove a defect before you fix it. Reproduce the failure, show me the failing output, then fix it and show the same check passing. This project has a history of "fixes" that never addressed the actual fault, and of confident false reports of completion.

3. One task, one branch, one pull request. Do not batch unrelated work together — if a design audit goes red, it must be obvious which change caused it.

Now, before you touch any code, answer two questions so I know you have actually read the material:
- What does PROJECT_STATE.md say the next task is?
- Which entries in AGENTS.md's trap list are most likely to bite on that task, and why?
```

---

## 01 · Fix `.env.example` — it ships the retired domain

Smallest task, real consequence, and a good calibration run for a new tool.

```
Task: fix .env.example.

It still ships the RETIRED production domain on two lines — AUTH_URL and NEXT_PUBLIC_SITE_URL both point at store.bhavyagondaliya.co.in. This matters because src/lib/constants.ts prefers the environment variable over its correct fallback (https://www.rivyalivingart.com), so anyone who copies this file into a real deployment inlines the wrong origin into every canonical URL, every sitemap entry, every JSON-LD @id and every OG image URL. The rest of the tree is clean of that host — this file is the last carrier.

Three variables are also missing entirely:
- DATABASE_URL_UNPOOLED — read by prisma.config.ts for migrations, because pgbouncer and advisory locks do not mix
- RESEND_FROM — read by src/lib/email.ts and typed in src/lib/env.ts
- CRON_SECRET — read by both cron routes and absent from the Zod schema altogether

And three variables that ARE in the file — AUTH_URL, ADMIN_EMAIL, ADMIN_PASSWORD — are never validated by src/lib/env.ts, so the fail-fast-at-boot guarantee that file advertises does not actually cover them. Either add them to the schema or annotate them clearly as seed-only.

Use placeholder values only. Never put a real credential in an example file.

Verify: grep the whole repository for store.bhavyagondaliya.co.in and show me the results — the only remaining hits should be historical notes in CHANGELOG.md and PROJECT_STATE.md. Then run npm run typecheck.
```

---

## 02 · Retire the superseded tagline

**Live on every page, in nine languages.** Replace `«PUT YOUR SENTENCE HERE»` before
pasting. Suggested: *"Large-format resin work, made to commission in India."*

```
Task: retire the superseded brand proposition from the places that still render it.

This site repositioned to commission-led work, but the tagline never moved with it. Every page still reads "Luxury custom resin art & 3D printing, made to order in India" — and because it bypasses next-intl entirely, it renders in English in all nine locales. A previous audit recorded the footer as consistent with the new positioning; that check read the wrong thing and was wrong.

Replace it with exactly this sentence:

    «PUT YOUR SENTENCE HERE»

Six places carry the old string. All of them need to change:
- src/lib/constants.ts:24 — SITE.tagline, the footer's fallback
- prisma/seed.ts:327 — seeds the SiteSettings row on every fresh environment
- src/app/manifest.ts:30 — the PWA description
- src/app/[locale]/(v2)/blog/[slug]/opengraph-image.tsx:45
- src/app/[locale]/(v2)/product/[slug]/opengraph-image.tsx:49
- the live SiteSettings.tagline row in the database — update it, do not only change the seed

Then decide one thing and explain your reasoning before you do it. messages/*.json contains a Footer.tagline key ("Handcrafted resin art, made to order.") that is registered in the copy system, translated into nine languages, editable by the owner at /studio/site-copy — and read by NOTHING. Either wire the footer to render it properly, so the owner's edits work and the line actually translates, or remove it from the registry so copy:check stops advertising a field that changes nothing. Do not leave it dead.

If you wire it, regenerate the copy registry (npm run copy:registry) and make sure npm run copy:check passes.

Verify: start the app, load /, /hi and /ar, and show me the footer text on each.
```

---

## 03 · Close the media-delete hole

The only unrecoverable bug left — Blob deletion cannot be undone. Do task **07** with or
before this one, so there is a harness to write the regression test in.

```
Task: close a data-loss hole in the media delete guard.

src/lib/media-usages.ts does not scan Tiptap rich-text JSON. So images embedded in blog post bodies (BlogPost.content, 55 rows), in the privacy and terms pages (Page.content), and in richText custom blocks are invisible to the guard. The rich-text editor lets an author paste any image URL, and /studio/media offers unreferenced files in a bulk "unused" sweep. Vercel Blob deletion is not recoverable, and the page then renders a broken image with nothing surfacing the problem.

This is the fourth time that file's header rule — "every new table that stores a media URL goes into media-usages.ts in the same commit" — has been broken, and every previous break was silent. That is why the fix must come with a test.

Prove it first: create a Media row, reference its URL from a BlogPost body, and show findMediaUsageDetails returning nothing for that URL. Then fix it and show the same call naming the post.

Implementation note: Json columns cannot be filtered in SQL, so follow the shape the file already uses for customBlocks — read the rows and match in JS. BlogPost is 55 rows and Page is 2, so the cost is irrelevant for a delete batch.

Do NOT add ContentRevision.payload to the scan. Revisions are append-only with no pruning, so blocking on them would make every URL that was ever published permanently undeletable and the unused-media sweep useless.

Verify: the before/after demonstration above, then npm run typecheck && npm test.
```

---

## 04 · Wire the LQIP placeholders

The last real feature work. The four constraints below are each load-bearing — leaving any
one out produces a subtly wrong result rather than an obviously broken one.

```
Task: wire the LQIP blur placeholders required by REDESIGN.md section 15.5.

src/lib/media-v3-blur.json holds 25 real {src, width, height, blurDataURL} entries and is imported by nothing except its own test. The 20px LQIP was generated and committed but never connected to anything.

It is smaller than the notes suggest: there are exactly TWO chokepoints, not eleven call sites — SlotImage (6 render sites) and MeniscusImage (28). One helper covers all 34.

Four constraints, each of which matters:

1. Key the lookup on the RESOLVED url, never on slot.fallback. getSiteImages() returns the owner's override when a SiteImage row exists, so a fallback-keyed lookup would paint master A's blur underneath the owner's uploaded photograph B. Keying on the resolved URL also makes three guards free: an override, an /uploads/ file and a supplier catalog URL all simply miss and render exactly as they do today.

2. Skip when `priority` is set. REDESIGN.md Part 14 forbids anything that delays the LCP element. That is 12 slots.

3. Skip when the slot has a mobile crop. A <picture> swaps the srcset, not the style, so the desktop blur would sit under the mobile image.

4. Merge objectFit: "cover" into the inline style wherever the blur applies. Next derives the placeholder's background-size from imgStyle.objectFit and cannot see a Tailwind object-cover class, so without this the blur letterboxes with visible bands. Two call sites already declare a ratio that mismatches their container.

Put this caveat in the new file's header: prisma/bootstrap.ts repoints every slot at a random-suffixed Blob URL on a fresh production deploy, after which every lookup misses and the feature is silently inert in production while it still works in local development. The durable fix is a blurDataUrl column on Media, already specified in docs/studio-cms/03-image-layer.md, and belongs to media-ingest work rather than here. Do not try to strip the Blob suffix.

Before you build, check section 2.7 ("No image on this site fades in") yourself: read Next's image modules in node_modules and tell me whether placeholder="blur" emits any CSS transition. Quote what you find.

Verify: a test asserting that a Blob URL, an /uploads/ URL and a supplier host all return undefined; then load /about and /process at 1440 and 390 and show me the blur filling its frame with no transparent bands.
```

---

## 05 · Make the reference documents true

Highest value per line changed, because these are what the *next* agent reads first.

```
Task: make the reference documents true.

A fresh agent reads PROJECT_STATE.md before anything else, and several of its numbers are frozen at Phase 0 while the project is now well past it. Check each of these against the repository and correct it:

- "No source file has been modified yet" — twelve pull requests have merged
- the migration count, and the test count (should be 352 tests across 33 files)
- "public/ is empty" — there are 242 tracked files
- the LAST COMMIT section
- "Resume by answering D1 and D2" — both are answered further down the same file
- CLAUDE.md's copy-slot count, and its "12 public routes" (ci.yml covers 13)

Separately, docs/studio-cms/ says 57 image slots in eleven places across six files; the real number is 62. Do not chase every instance. Put a banner at the top of docs/studio-cms/README.md saying these are plan documents frozen at their writing date and that CLAUDE.md is the current-state authority.

One rule for this task: verify every number with a command before you change it, and put the command you used in the commit message. Do not replace one wrong number with another wrong number.
```

---

## 06 · Three security hardening items

All three are contained rather than exploitable today. One commit each.

```
Task: three security hardening items. One commit each, please.

1. src/app/uploads/[...path]/route.ts — path traversal is rejected by comparing each path segment for exact equality against ".." and ".", and then calling path.join. Replace that with path.resolve followed by an assertion that the result starts with the root directory plus a separator. This route is development-only (production serves from Blob), but it is two lines to make correct.

2. src/app/api/upload/route.ts — the allowed-type check trusts the client-declared MIME type with no magic-byte verification. sharp is already a dependency, so a metadata() round-trip is cheap. This is contained today by a server-side extension map, a nosniff header and the exclusion of SVG, so treat it as storage pollution rather than code execution — but fix it.

3. src/lib/rate-limit.ts — clientIp takes the first x-forwarded-for hop. That is correct on Vercel, because the edge overwrites the header, but anywhere else a client can mint a fresh bucket per request and defeat every per-IP limit, including the studio login throttle. Either add a trusted-proxy-count setting, or document the Vercel-only contract explicitly in the file so nobody deploys it elsewhere assuming it holds.

For each one, show me the failing behaviour before the fix wherever you can construct it.
```

---

## 07 · The first database-backed tests

Do this **with or before task 03** — that fix has no failing test to write against
without it.

```
Task: build the first test slice that touches the database.

All 352 existing tests cover pure functions. Nothing covers server actions (each one is a public POST endpoint), the cron routes, uploads, src/proxy.ts, or any Prisma query. Full coverage is a large job; build the narrow slice that pays for itself first:

- findMediaUsages / findMediaUsageDetails
- buildProductWhere

Those two would have caught the two most expensive bugs this project has had.

CI already stands up a throwaway Postgres — see .github/workflows/ci.yml — so follow that pattern rather than inventing a new one. Keep the existing pure-function suite fast and separate: do not make every test require a database to run.
```

---

## 08 · Enforce the CSP, in the right order

Renaming the header first would break Blob video and uploads. The ordering *is* the task.

```
Task: move the Content-Security-Policy from report-only to enforced — but in the right order.

next.config.ts currently emits Content-Security-Policy-Report-Only, so nothing is ever actually blocked. Renaming the header key is a real gain for frame-ancestors, object-src and form-action. But the policy is missing three things, and renaming before adding them would break working features:

- media-src — a Blob-hosted heroVideoUrl would fall through to default-src 'self'
- connect-src entries for Blob uploads
- worker-src blob: — browser-image-compression is a dependency

Add those first. Deploy. Watch /api/csp-report for a clean window. Only then rename the header key.

Two things NOT to do in this task. Do not narrow img-src https: — the catalog carries product imagery on many supplier hosts and the mirroring cron is still draining them. And do not attempt to remove 'unsafe-inline'; that needs a nonce strategy for Next's hydration payload and the JSON-LD blocks, and is its own project.

Never describe the CSP as enforced until the header key has actually changed.
```

---

## Still the owner's to answer

Three questions no agent should decide alone. Once answered, each is a few lines — paste
the answers into one conversation and ask for them together.

1. **Should `/shop?q=` search descriptions?** It matches titles only, so "resin" returns
   23 of 1,668 matches. The GIN trigram index already exists, so it is one OR clause — but
   it changes what the shop returns, which REDESIGN.md §1.1 puts off-limits without a
   human. *Recommendation: yes.*
2. **The "Show all N pieces" label.** Every locale uses an art word (`कृतियाँ`, `કૃતિઓ`,
   `作品`) while N counts pigments and filament too. Keep the number, or move to a
   non-quantified label? *Recommendation: non-quantified.*
3. **Breadcrumbs on supplies and print pages** point "Shop" at the art shelf, so the trail
   does not walk back up. *Recommendation: make the visible crumb group-aware and leave the
   BreadcrumbList structured data on `/shop`, since the filtered URL declares itself
   non-canonical.*

## CI works now

GitHub Actions billing was restored on 1 September 2026 and run #30 went fully green — the first
in the project's history. It checks more than the local sweep did: the Studio audit over 30 staff
routes and the Lighthouse budget were not part of the routine local run, and both pass.

So every task above now gets an independent check. Worth knowing anyway: the twelve pull requests
merged before that date were verified only by the agent that wrote them.
