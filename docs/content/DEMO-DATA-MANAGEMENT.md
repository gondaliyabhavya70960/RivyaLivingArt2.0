# Demo data — how it is classified, shown, counted and removed

_2026-09-19._

## Classification

Every row the Content Lab writes carries `isDemo: true`. Twelve tables have
the column: `BlogCategory`, `BlogPost`, `Media`, `Product`, `Portfolio`,
`Testimonial`, `Faq`, `CustomPage`, `Inquiry`, `ResearchRecord`, `ScrapeJob`,
`ImportRun`. `ScrapedProduct` has none of its own — it cascades with its
`ScrapeJob`.

`isDemo` is the only thing that marks demo data. There is no naming
convention, no id prefix and no separate schema to fall back on, which is why
every delete below carries `isDemo: true` in its WHERE clause rather than
trusting a list of ids.

## Public visibility

Public readers spread `demoWhere()`. Demo rows render only when
`SiteSettings.demoContentPublic` is on **or** `VERCEL_ENV` is not
`production`. When they do render they carry `<DemoMark/>` and `noindex`, and
the sitemap, the Product/Article/Review JSON-LD and the image mirror exclude
them **by clause** regardless of the switch. A demo order saves
`Inquiry.isDemo` and its WhatsApp message is prefixed `[DEMO] `.

## Analytics

Demo rows are excluded from genuine analytics by the same `demoWhere()`
clause. The Content Health screen counts `isDemo: false` for every figure it
reports, and names the demo inquiry count separately so the two are never
added together by accident.

## Seeding is refused on production

`describeDemoHost` allow-lists `localhost`, `127.0.0.1` and `rivya_ci`.
Everything else is production, and both writers refuse:

- the CLI needs `--allow-production` **and** the typed phrase
  `DEMO INTO PRODUCTION` at an interactive prompt — a non-interactive shell
  has no prompt, so CI cannot do it at all;
- the Server Action refuses outright.

`DEMO_DB_ALLOW` names one extra host for a sandbox the pattern cannot
anticipate.

**Removal is NOT host-guarded**, and that asymmetry is deliberate: deleting
demo rows from production is the thing you want to be easy.

## Removing it — two tools

### Remove all demo data

`removeDemoData(confirmation)` deletes every `isDemo: true` row in all twelve
tables, in child-before-parent order. Requires the typed phrase
`REMOVE DEMO DATA`. Lives on **Studio → Content Lab**.

### The Demo Data Manager

**Studio → Content Lab → Demo data manager.** The scoped version:

- per-content-type counts, each with a checkbox to clear that whole type;
- **Pick rows** expands a type and lists up to 100 individual rows with their
  own checkboxes, labelled so they can be told apart;
- **Select all demo data** ticks every type that has rows;
- a running `N of M selected` count;
- a result panel: selected · deleted · protected · already gone, per type.

The row list is capped at 100 with `truncated` stating so. A seeded database
holds 4,000+ demo products; shipping all of them into a checkbox list would
make the screen heavier than the data it manages. Clearing a whole type does
not need the list.

## The four safety rules

**1. The typed phrase is scoped to what is unbounded.** Clearing a whole
content type asks for `REMOVE DEMO DATA`; rows ticked individually do not.
Ticking four rows you can see is a different decision from agreeing to lose
however many a table happens to hold. `requiresTypedConfirmation` owns the
rule and both the screen and the action call it, so they cannot disagree.

**2. `isDemo` is re-checked server-side, per row, before every delete.** Ids
arriving from the browser are re-read with `isDemo: true` in the WHERE clause,
and the delete carries the same clause. A row that is no longer demo is
reported as **protected** — not silently skipped, and not an error. A row that
has already gone is reported as **already gone**. Those are different facts
and the screen shows both. Telling them apart needs a second lookup **without**
the `isDemo` clause; asking again with it returns the same empty set and would
report every protected row as missing.

**3. Shared media keeps its file.** Media is deleted **last**, after every
content row in the selection has gone. Whatever `findMediaUsageDetails` still
reports at that point is a genuine referrer by definition, so the media pass
needs no demo/genuine test of its own. A file still in use is kept and listed
in the result with what is using it; a demo file whose last referrer was a
demo product is free and is removed. Physical deletion of a file that genuine
content uses cannot happen through this path.

**4. Nothing runs by itself.** No cron, no deploy hook, no migration and no
"cleanup" job calls any of this. `prisma/bootstrap.ts` does not touch demo
data. Every removal starts with a person and is written to `ActivityLog`
(`entity: "demo"`, action `remove` or `remove-selection`) with the counts.

## Permissions

ADMIN only — `requireStaff([Role.ADMIN])` on every action, seeding and
removal alike.

## Where the code is

| Concern | File |
| --- | --- |
| Host guard | `src/lib/demo/guard.ts` |
| Fixtures, seed, remove-all, counts | `src/lib/demo/apply.ts` |
| Scoped removal rules | `src/lib/demo/selective.ts` |
| Server actions | `src/actions/demo.ts` |
| Manager UI | `src/components/studio/content-lab/demo-manager.tsx` |
| CLI | `scripts/seed-demo.ts` |

## What this is not

Demo content is not starter content. Starter content is genuine editorial copy
written for this studio, carries `isDemo: false`, belongs on production and is
added by `npm run seed:starter` or **Studio → Content Health**. It is not
managed here and is not removable in bulk — it is the site's content, and it
is deleted the way any other content is. See
`docs/content/CONTENT-AUDIT.md`.

**Flipping `isDemo` does not promote a demo row to real content.** The rows
are synthetic: invented products, invented customers, invented inquiries.
Promoting one would publish a fabrication.
