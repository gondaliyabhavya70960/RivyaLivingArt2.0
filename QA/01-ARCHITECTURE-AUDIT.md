# Architecture audit

Derived by reading the repository. Counts are from file enumeration.

## Stack

Next.js 16.3 App Router · React 19.2 · TypeScript strict · Prisma 7 + Postgres ·
Auth.js v5 beta (staff only) · next-intl (9 locales, incl. RTL Arabic) ·
Tailwind v4 · Vercel Blob · Vitest.

## Shape

```
src/
  app/[locale]/(v2)/   storefront, 9 locales, localePrefix "as-needed"
  app/studio/          staff CMS (English-only by design)
  app/api/             9 route handlers
  app/uploads/[...path]  dev-only local media serving
  actions/             30 files, 40 modules carrying "use server"
  lib/                 128 files — the rule layer, where the unit tests live
  proxy.ts             route guard (Next 16.3 renamed middleware -> proxy)
```

## Business-model constraints (`CLAUDE.md` §1.1 — not defects)

- No payment gateway, no cart checkout, no online payment.
- No customer accounts. The only login is staff `/studio` (ADMIN | EDITOR).
- Every order ends as a WhatsApp deep link after saving an `Inquiry`.

An audit that reports "no checkout" or "no customer auth" is reporting the
product, not a bug.

## Authorization boundaries

| Boundary | Enforced by | Verified |
|---|---|---|
| `/studio/**` | `src/proxy.ts` — JWT check, fails **closed** on a session without a user | Read |
| Studio server actions | `requireStaff(roles)` — re-reads the user **per call**, checks `tokenVersion` + role | Read |
| Studio pages | `requireStaffPage(roles)` — redirects rather than throws | Read |
| Draft preview | `/api/draft` mints the cookie only behind `requireStaff()` | Read |
| Public actions | zod + honeypot + signed form token + per-IP rate limit | Read |

`requireStaff` hitting the database on every call is what makes a deleted user,
a demoted user, and a password-reset-invalidated session lose access
immediately rather than at JWT expiry. One indexed PK lookup. Correct trade.

## API routes

| Route | Public? | Auth | Notes |
|---|---|---|---|
| `/api/auth/[...nextauth]` | Yes | — | Auth.js |
| `/api/draft` | Enable: **staff** · Disable: anyone | `requireStaff()` | Redirect target constrained to same-origin paths |
| `/api/form-token` | Yes | — | Issues the signed mount timestamp |
| `/api/upload` | **Yes** | — | Rate-limited 30/10min per IP; `refs/` prefix only |
| `/api/csp-report` | Yes | — | Report sink |
| `/api/cron/mirror-images` | No | `CRON_SECRET` (timing-safe) **or** `requireStaff()` | Fails closed when secret unset |
| `/api/cron/publish-scheduled` | No | same | Never writes — warms cache only |
| `/api/scraper/export` | No | staff | Emits catalog data |
| `/api/subscribers/export` | No | staff | Emits subscriber PII |
| `/uploads/[...path]` | Yes | — | Dev-only; production serves from Blob |

## Public (unauthenticated) server actions

`order.ts` (product + custom order), `public.ts` (contact, subscribe),
`search.ts`, `shop.ts`, `auth-public.ts` (login, first-admin bootstrap,
password reset).

Shared abuse protection: honeypot, **server-signed** fill-time token
(`/api/form-token` — the fill time cannot be forged from a client clock), and a
per-IP sliding window. Security-sensitive keys (login, reset) use
`rateLimitDurable`, backed by Postgres so counts survive serverless cold starts.

## Data model highlights

- `ContentStatus = DRAFT | PUBLISHED` on Product, BlogPost, Portfolio, CustomPage.
- `Role = ADMIN | EDITOR`.
- `Product` indexes: `[categoryId,status]`, `[status,featured]`,
  `[status,createdAt]`, `[status,priceMin]`, `[tier,status]` — the hot filter
  and sort paths are covered.
- `Inquiry` carries `claimTokenHash`, so only the submitter can re-read their
  own PII from the public fallback page.

## The Studio CMS pattern

    registry in code  ->  overrides in the database  ->  a TOTAL resolver

Eight surfaces, one shape. The resolver being total is why an empty table, a
fresh database and an unreachable one all render what the repo ships rather
than a blank page. Saves are drafts; publishing is per-surface.

**Not verified:** that every resolver is genuinely total under a database
outage. That needs execution.

## CI (`.github/workflows/ci.yml`)

Two jobs on every PR to `Main`:

1. `npm ci` · typecheck · lint · `copy:check` · `i18n-missing.mjs` · `npm test`
2. Real `npm run build` against a throwaway Postgres, then **starts the built
   server** and runs: `redesign-audit.mjs`, `a11y-audit.mjs` (both at 1440px and
   390px over 12 routes), `studio-audit.mjs` (signs in, sweeps 30 staff routes),
   and `lighthouse-audit.mjs`.

This is a strong gate. It is why pushing a change and reading CI is a
legitimate substitute for local verification — which is exactly what this
branch had to rely on.

Not in CI: `scripts/e2e-smoke.mjs` (needs a populated catalog).
