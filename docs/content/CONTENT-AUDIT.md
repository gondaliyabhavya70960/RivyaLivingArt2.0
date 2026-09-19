# Content audit — why the demo content is not on the site

_2026-09-19. Measured against production (`www.rivyalivingart.com`) and the
`db.prisma.io/postgres` database the Studio reports, not inferred from source._

## The short answer

**The demo content was never written to production, and that is the system
working as designed rather than a bug.** Separately, and more usefully: **the
live site is not empty.** It carries 55 journal articles and 23 portfolio
cases. The thing that is genuinely thin is the FAQ page, which has six
questions.

Those are two different findings and they were nearly conflated. The Content
Lab screen showing `0` in every row is what prompted the question, and the
obvious reading of that screen — "the content is missing" — is wrong.

## Why Content Lab shows zero

`src/lib/demo/guard.ts` derives a host from `DATABASE_URL` and allow-lists
only `localhost`, `127.0.0.1` and `rivya_ci`. Everything else is treated as
production. Both writers ask it first:

- `scripts/seed-demo.ts` exits unless `--allow-production` is passed **and**
  the phrase `DEMO INTO PRODUCTION` is typed at an interactive prompt. A
  non-interactive shell has no prompt to answer, so CI and cron cannot do it
  at all.
- `seedDemoData` in `src/actions/demo.ts` refuses outright — a Server Action
  is a public POST endpoint, so the same guard runs there too.

The Studio screen reports exactly this: **Allow-listed for demo writes: No ·
Looks like production: Yes**, the Seed button disabled with the reason
printed under it, and **Last seeded: Never**. Nothing has ever written a demo
row to this database, so every count is zero and the "Show demo content on the
live site" switch has nothing to reveal.

This guard should stay. Seeding the Content Lab writes 400+ synthetic rows
across eleven tables — products, inquiries, testimonials — into the database
holding the real catalogue.

## What the live site actually has

| Surface | Live now | Source | Verdict |
| --- | ---: | --- | --- |
| Journal | **55 articles** | `prisma/blog-content/*.md` → `seed-blogs.ts` | Healthy |
| Portfolio | **23 cases** | `prisma/seed-portfolio-cases.ts` | Populated, but see below |
| FAQ | **6 questions** | `FAQS` in `prisma/seed.ts` | **The real gap** |
| Testimonials | **0 rendered** | — | Correct — see below |
| Demo rows | **0** | never seeded | By design |

The journal and portfolio counts were nearly misread in the opposite
direction. `/blog` lists 12 articles, which looks like "12 of the 55 made it".
It is pagination: `publishedAt` is staggered in file order, the listing sorts
newest first, and the 12 on page 1 are the alphabetically-last 12 files.
Fetching `/blog/baby-milestone-keepsakes-in-resin` — a mid-alphabet slug not
on page 1 — returns `200`. All five pages exist. The portfolio is the same
shape with two pages.

## The gaps that are real

**1. FAQ — six questions.** The six that exist are good and are the factual
basis for everything added: delivery and timelines, packing, photo quality,
care, pricing and payment, returns. But six questions cannot cover resin as a
material, commissioning furniture, 3D printing, personalisation, preservation
and logistics. This is the single highest-value content gap on the site.

**2. The portfolio contradicts the positioning.** All 23 cases are small
items — bookmarks, earrings, coasters, bangles, placemats, a puja thali,
fridge magnets. The business positions itself as a large-format resin art and
furniture studio. A visitor looking for a dining table sees jewellery.

**3. Testimonials are zero, and must stay zero until real ones exist.** The
homepage testimonial band renders nothing, which is correct behaviour rather
than a fault. `describeTestimonialProblem` refuses to publish a testimonial
without `permissionStatus: GRANTED`, and the Review JSON-LD only counts
published, permitted, non-demo rows. **Nothing in this change writes a
testimonial.** Inventing customer words is the one content gap that cannot be
filled by writing, and filling it would be fabricating evidence of business
Rivya has not done.

**4. Research records are empty.** The `ResearchRecord` table is internal —
never published, never in the sitemap — and had nothing in it.

## Why `prisma/seed.ts` cannot close the FAQ gap

Two independent reasons, and both had to be found before the fix made sense.

**It does not run.** `prisma/bootstrap.ts` sets
`alreadySeeded = (await db.category.count()) > 0` and skips the base seed when
true. Production has categories, so `seed.ts` has not run there since the very
first deploy. Adding questions to its `FAQS` array would change nothing on the
live site.

**And if it did run, it would overwrite the owner.** Its FAQ loop matches on
`question` and then `db.faq.update({ data: { answer, order } })` — it rewrites
the answer every time. That is safe exactly once. The moment an answer is
improved in the Studio, the next run reverts it silently.

So the fix is not a bigger `seed.ts`. It is a separate, explicitly-run,
strictly-additive seeder: `npm run seed:starter`, and the **Content Health**
screen in the Studio. It is dry-run by default, it only ever creates rows that
do not exist, and it has no update branch at all — a row that is already there
is the owner's, edited or not.

## What changed, and what deliberately did not

| Added | Not touched |
| --- | --- |
| FAQ library (starter content, additive) | The six existing FAQ answers |
| Portfolio concept studies, clearly labelled, DRAFT | The 23 existing cases |
| Internal competitor research records | The journal — 55 articles is healthy |
| Demo inquiries across all nine statuses | Testimonials — zero, and staying zero |
| Demo Data Manager with per-type selection | The demo host guard |
| `/studio/content-health` | The WhatsApp order flow |

No migration ships with this work, so nothing here reaches the production
database on push. The starter content reaches production only when the owner
runs it.

## Related

- `docs/content/DEMO-DATA-MANAGEMENT.md` — the demo architecture and the manager
- `docs/content/CONTENT-INVENTORY.md` — counts, entity by entity
- `docs/content/COMPETITOR-RESEARCH.md` — what the research found
- `docs/content/OWNER-REVIEW.md` — facts only the owner can confirm
