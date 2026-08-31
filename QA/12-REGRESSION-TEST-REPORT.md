# Regression test report

## Executed locally by this session: nothing

| Command | Status | Reason |
|---|---|---|
| `npm ci` | **PASS** | Completed, exit 0, before execution became unavailable |
| `npm run typecheck` | **BLOCKED locally** | Command execution unavailable — but see CI below |
| `npm run lint` | **BLOCKED locally** | ″ |
| `npm test` | **BLOCKED locally** | ″ |
| `npm run build` | **BLOCKED locally** | ″ |
| `npm run test:e2e` | **BLOCKED** | Needs a running server and a populated catalog |
| `npm run copy:check` | **BLOCKED locally** | ″ |
| `node scripts/i18n-missing.mjs` | **BLOCKED locally** | ″ |
| `node scripts/redesign-audit.mjs` | **BLOCKED locally** | Needs server + Chromium |
| `node scripts/a11y-audit.mjs` | **BLOCKED locally** | Needs server + Chromium |
| `npm audit` / `npm outdated` | **BLOCKED** | Command execution unavailable |

A local Postgres 16 instance **was** started and a `resinriva_qa` database
created, before execution became unavailable. Nothing was run against it.

## CI results — the verification that did happen

The fix was pushed and opened as draft PR #138, making **CI its first and only
execution**.

### Job 1 — `Typecheck · lint · unit tests`: **PASS**

Run `32935438940`, commit `c377bf9`, completed `success`. Every step green:

| Step | Result |
|---|---|
| `npm ci` | PASS |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run copy:check` | **PASS** |
| Translation coverage (`i18n-missing.mjs`) | **PASS** |
| `npm run test` | **PASS** — includes the 6 new assertions |

So the change compiles under `tsc --noEmit`, satisfies the lint rules (including
import ordering and `react-hooks/set-state-in-effect`), introduces no
un-translated key, and the new regression test passes.

### Job 2 — `Production build · design & a11y audits`: **BLOCKED**

Still in progress when the session ended. Covers the real `npm run build`
against a throwaway Postgres, then `redesign-audit.mjs`, `a11y-audit.mjs`,
`studio-audit.mjs` and `lighthouse-audit.mjs`.

**Read this job's result on the PR before merging.** It has not been observed.

## Pre-push verification that was performed

Code correctness could not be executed locally, so transfer correctness was
verified instead:

- The full post-edit `src/actions/order.ts` was written to a scratch file and
  `diff`ed against the working tree — **identical**, byte for byte.
- After pushing, the file was fetched back from the branch and compared against
  that verified copy — **identical**, including the em-dashes, the Devanagari
  in the I18N-902 comment, the box-drawing section rules, and the `\-` escape
  inside the phone regex.

That proved the pushed bytes were the intended bytes. CI then proved they
compile and pass.

The API usage was also checked against the bundled Next 16 documentation
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/draft-mode.md`),
per the repo convention: `draftMode()` is async and `isEnabled` is readable
outside a Route Handler — only `enable()`/`disable()` are restricted. The same
page notes the bypass cookie value is regenerated on every `next build` and
cannot be guessed, which is what makes it sound as an authorization signal.

## Tests added

`src/lib/order-visibility.test.ts` — 6 assertions, all passing on CI:

| Case | Expected |
|---|---|
| published + no preview | orderable |
| **draft + no preview** | **refused** (the regression) |
| draft + preview | orderable |
| published + preview | orderable |
| `ARCHIVED`/`SCHEDULED`/`published`/`""`/`draft` + no preview | refused — fails closed |
| availability is not orderability | published stays orderable |

The fail-closed case is the one that matters longest: if `ContentStatus` ever
grows a third member, it is not orderable until someone decides it should be.

## Coverage gaps in the automated suite

The suite covers pure `src/lib` functions — good for rules, blind to wiring.
Still uncovered:

| Gap | Suggested location | Priority |
|---|---|---|
| SSRF host classification table | `src/lib/scraper/ssrf.test.ts` | **High** — highest-value missing test |
| Server-action authorization | needs an integration harness | High |
| Upload MIME/extension rejection | `src/app/api/upload/` | Medium |
| CSV/sheet export escaping | `src/lib/import/` | Medium |
| Cache revalidation after publish | integration | Medium |
| Published-image hostname allow-list | CI build job (needs DB) | Medium |

The first is achievable today as a pure table test with no network.
