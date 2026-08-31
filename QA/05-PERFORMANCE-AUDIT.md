# Performance audit — NOT AUDITED

No profiling, no query analysis, no bundle measurement was performed. Execution
was unavailable. This is a runbook, not a result.

## The one positive observation from source

`prisma/schema.prisma` indexes the hot catalog paths — `[categoryId,status]`,
`[status,featured]`, `[status,createdAt]`, `[status,priceMin]`, `[tier,status]`.
At ~4,300 products the common filter and sort combinations are covered. This is
frequently the finding at this scale; here it appears already handled.

`catalog-mirror.ts` deliberately keeps mirrored images out of next/image
optimization (the `catalog/` prefix is excluded by `isOptimizableImageSrc`) so
~10k files cannot exhaust the Vercel optimizer quota.

## What to run

```bash
npm run build        # then read the route-size table
node scripts/lighthouse-audit.mjs   # CI already gates this
```

CI enforces Lighthouse on `/` and `/shop` (perf >= 85, a11y >= 95; the site has
measured 98/100/96/100). **Those numbers are from the repository's own notes,
not from this pass.**

## What to look for

1. **N+1 queries.** Grep for `await` inside `.map(`/`for` over collections in
   `src/actions/` and `src/lib/`. Enable Prisma query logging and load `/shop`,
   a PDP, and the Studio product list.
2. **Unbounded reads.** Any `findMany` without `take` on a listing route.
   Confirm shop filtering happens in the database, not in JS after loading all
   4,300 rows.
3. **Select width.** Card grids should not be fetching description bodies.
4. **Client bundle.** Confirm `three`, `@google/model-viewer`, `gsap`,
   `recharts` and `exceljs` are dynamically imported or server-only. `exceljs`
   or `recharts` in the shared storefront bundle would be a genuine P2.
5. **Search.** Check whether it is an unindexed `ILIKE` scan across the catalog.

## Note on the CI Lighthouse budget

The workflow comment records that perf once measured 43 on the runner, and the
cause was requesting a desktop form factor while leaving Lighthouse's mobile
throttling default in place — 59 -> 98 after correcting it. Worth knowing
before treating a bad number as a site regression.
