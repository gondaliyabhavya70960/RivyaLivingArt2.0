# Troubleshooting

Symptoms, causes, and what to do — in rough order of how often they happen.

---

## /studio answers "Internal Server Error" while the public site is fine

**Cause.** `AUTH_URL` (or the legacy `NEXTAUTH_URL`) is set to a bare host —
`rivyalivingart.com` — rather than a full origin. That is the form a hosting
dashboard displays a domain in, so it is the form that gets pasted. Auth.js
calls `new URL()` on the raw value in the middleware, `new URL()` needs a
scheme, and the middleware is what guards `/studio/:path*` — so every studio
route 500s and nothing else on the site changes. The public routes take the
next-intl branch of `src/proxy.ts`, which never constructs an auth URL.

**Confirm it.** Vercel → Project → **Logs** (or Observability → Errors):
`Error running the exported Web Handler: TypeError: Invalid URL` on route
`/middleware`, with `input: '<your domain>'` naming the pasted value.

**Do.** Project → Settings → Environment Variables → set `AUTH_URL` to
`https://www.rivyalivingart.com` (scheme included) in **every** environment
that has it, delete any `NEXTAUTH_URL`, and redeploy. Deleting `AUTH_URL`
outright also works on Vercel: with no value Auth.js reads the origin from
`x-forwarded-host`.

Since this shipped, `src/lib/auth.config.ts` repairs the value at module load
— a pasted bare host is read as `https://<host>` and an unusable one is
ignored, each with a warning in the runtime log naming the variable. The env
var is still worth fixing so the warning stops; it can no longer take the
studio down.

---

## "Sheet sync not configured"

**Gone.** Google Sheets was removed on 2026-09-15 (plan C). There is no sync to
configure and no Google credential to set. If you still see this string, you are
looking at a deployment built before that date.

**Do.** Export the confirmed list from `/studio/exports` as CSV or XLSX. The
history of the old integration is in `docs/archive/google-sheets.md`.

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

**Cause.** Almost always a re-import of a tier CSV row.

**Do.** Check `DeletedImport` for the `(importSource, importRef)` pair. The
tombstone should stop it. If the row returned under a _different_ key — a
re-keyed CSV, a changed external id — the tombstone cannot match it, and the
duplicate is a new product as far as the system can tell.

---

## The auto-fill refused to run

**"Would create N products, over the limit of M."** The blast-radius cap fired
and **nothing was written**. Usually a tier CSV that was sorted, re-keyed, or
had its id column changed — the importer sees the rows as new.

**Do.** Check the CSV before raising the cap. Raising it is right when the run
genuinely is that large; it is wrong when the file has shifted under you.

---

## A scrape "succeeded" but nothing left the studio

**There is nowhere for it to go, and that is the design.** A scrape stages rows
in `ScrapedProduct`; they reach the catalogue only when you promote them, and
they reach a file only when you export. Google Sheets used to be a third
destination and was removed on 2026-09-15 (plan C) — nothing pushes anywhere on
its own any more.

**Do.** Review the job in `/studio/scraper`, promote what you want, and export
the confirmed list from `/studio/exports`.

---

## A fresh environment came up with an empty catalogue

**Cause.** `catalogFillEnabled` or `catalogFillOnDeploy` is off, or
`data/tiers/*.csv.gz` are missing so the importer had nothing to read.

**Do.** Both settings default to **on** precisely so a new environment
self-populates. If they were turned off deliberately, the fill can be run from
`/studio/catalog-fill`.

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
