# Troubleshooting

Symptoms, causes, and what to do — in rough order of how often they happen.

---

## "Sheet sync not configured"

**Cause.** No `GOOGLE_SERVICE_ACCOUNT_JSON` (or `_KEY_B64`) and
`SCRAPE_SHEET_ID` in this environment.

**Do.** Set them, server-side. Nothing else is broken: sync is optional by
design, scraping and the studio work without it, and the CSV export covers the
workflow.

---

## The scrape button does nothing / shows another run

**Cause.** That source already has a `QUEUED` or `RUNNING` job. You were handed
it rather than given an error.

**Do.** Watch it. If it is stuck, check the job's `error` on
`/studio/scraper` and resume or delete it there.

---

## A source is paused

**Cause.** Five consecutive failed jobs tripped the circuit breaker.

**Do.** Open the site. Usually one of: it is down, it has redesigned (see
below), or it is blocking our user agent. Fix the cause, then **Resume** —
which clears the pause and the failure counter.

Do not raise `BREAKER_THRESHOLD` to get past it. The breaker firing means the
site said no five times.

---

## Suddenly thousands of validation failures from one source

**Cause.** The site changed shape and the adapter's selectors no longer match.
One field across every product is the signature.

**Do.** `/studio/scraper/quality` → the "worst sources" panel names it. Fix the
adapter, re-scrape, and the failures resolve themselves — the condition that
raised them has stopped holding. Do not bulk-resolve them first; that hides the
evidence you need.

---

## My edits came back as the scraped version

**This should be impossible now** — it was a real bug, fixed in Phase 9. Every
studio save sets `ownerTouched`, and both writers refresh availability only for
those rows.

**If it happens:** check `ownerTouched` and `studioEditedAt` on the product. If
`ownerTouched` is false, the save did not go through the studio path. That is
worth reporting with the product id.

---

## A deleted product is back

**Cause.** Almost always a re-import of a sheet row.

**Do.** Check `DeletedImport` for the `(importSource, importRef)` pair. The
tombstone should stop it. If the row returned under a *different* key — a
re-keyed sheet, a changed external id — the tombstone cannot match it, and the
duplicate is a new product as far as the system can tell.

---

## The auto-fill refused to run

**"Would create N products, over the limit of M."** The blast-radius cap fired
and **nothing was written**. Usually a sheet that was sorted, re-keyed, or had
its id column changed — the importer sees the rows as new.

**Do.** Check the sheet before raising the cap. Raising it is right when the
run genuinely is that large; it is wrong when the sheet has shifted under you.

---

## A scrape "succeeded" but the sheet has nothing

**Cause.** The source's sync policy is `MANUAL` (the default) — rows are staged
and waiting for you to press **Sync to Sheet** on the job.

Or: the push failed and the rows are `SYNC_PENDING`. Those look different in
the studio on purpose. Use **Retry sync**, which re-pushes whole jobs and
cannot double-write.

---

## A fresh environment came up with an empty catalogue

**Cause.** `sheetFillEnabled` or `sheetFillOnDeploy` is off, or
`data/tiers/*.csv.gz` are missing so the importer had nothing to read.

**Do.** Both settings default to **on** precisely so a new environment
self-populates. If they were turned off deliberately, the fill can be run from
`/studio/sheet-import`.

---

## CI is red on a scraper change

Run the same gate locally first — it is the whole gate, not a subset:

```
npx tsc --noEmit && npm run lint && npm run test && npm run copy:check
node scripts/i18n-missing.mjs
npm run build
BASE_URL=… node scripts/redesign-audit.mjs "$ROUTES"
BASE_URL=… node scripts/a11y-audit.mjs "$ROUTES"
LH_BASE=… node scripts/lighthouse-audit.mjs
```

A gate you have never watched fail is not yet a gate. Before trusting a new
one, make it fail on purpose once.
