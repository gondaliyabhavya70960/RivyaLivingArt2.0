# INSTALL.md — Local Development Setup

Everything you need to run Rivya Living Art on your own machine: the Next.js app, a Postgres database, the admin studio, and file uploads — no Vercel credentials required for day-to-day development.

## 1. Prerequisites

- **Node.js 20+** (LTS) and **npm**
- **Git**
- **Postgres** — either a local Postgres 16 instance **or** the project's Neon database via the Vercel CLI (see step 3)
- Optional: a **Vercel account** (owner: gondaliyabhavya70960@gmail.com) with the project linked — only needed if you want to pull the real Neon `DATABASE_URL` / Blob token instead of running fully local

## 2. Clone and install

```bash
git clone https://github.com/gondaliyabhavya70960/RivyaLivingArt2.0.git
cd RivyaLivingArt2.0
npm install
```

`npm install` runs `prisma generate` automatically via the `postinstall` hook, so a fresh clone typechecks right after install. The generated client lives in `src/generated/prisma/` and is gitignored; you only need to regenerate manually after schema edits (`npx prisma generate`, or `prisma migrate dev` which generates too).

## 3. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

> **Why `.env` and not `.env.local`?** Prisma 7 does not read env files by itself — `prisma.config.ts` loads them via `dotenv`, which only reads `.env`. Next.js reads `.env` too, so keeping everything in `.env` makes both the app and the Prisma CLI (`migrate`, `db seed`, `studio`) see the same values.

| Variable | How to set it |
|---|---|
| `DATABASE_URL` | **Option A — local Postgres:** create a database and use e.g. `postgresql://rivya:rivya_dev@localhost:5432/rivya`. **Option B — Neon via Vercel:** `vercel link`, then `vercel env pull .env` (auto-injected by the Neon native integration). |
| `AUTH_SECRET` | Generate with `npx auth secret` (it appends the value to `.env.local` — move it into `.env`). |
| `AUTH_URL` | Leave unset (or `http://localhost:3000`) for local dev; Auth.js detects localhost. Production uses `https://store.bhavyagondaliya.co.in`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Your studio login. **Used only by the seed script** to create the admin user. |
| `BLOB_READ_WRITE_TOKEN` | Leave empty locally — uploads fall back to local disk automatically (see §7). |
| `RESEND_API_KEY` | Optional — email via Resend: contact-form + order notifications and password-reset delivery. Skipping it is fine; forms still save inquiries and reset links are logged to the server console. |
| `RESEND_EMAIL_DOMAIN` / `RESEND_FROM` / `EMAIL_FROM` | Optional — sender address for Resend emails. |
| `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GA_ID` | Optional — Meta Pixel / GA4 ids; both tags stay off unless set. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` (or `GOOGLE_SERVICE_ACCOUNT_KEY_B64`) / `SCRAPE_SHEET_ID` (or `SHEET_ID`) | Optional — direct Google Sheet sync from the Product Scraper. Without them, the scraper's CSV export covers the same workflow. |
| `SCRAPER_USER_AGENT` | Optional — custom User-Agent for scraper requests. |
| `CRON_SECRET` | Optional locally — Bearer token for the `/api/cron/mirror-images` route (required in production). |
| `AUTH_TRUST_HOST` | Not needed locally or on Vercel; set `true` for any other production host (boot fails without it). |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `917096036250` |
| `NEXT_PUBLIC_SITE_URL` | `https://store.bhavyagondaliya.co.in` (or `http://localhost:3000` if you want local wa.me messages to say so) |

## 4. Database setup

```bash
npx prisma migrate dev   # applies migrations + regenerates the client
npx prisma db seed       # runs tsx prisma/seed.ts (configured in prisma.config.ts)
```

The seed is idempotent (safe to re-run) and creates:

- the **admin user** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (bcrypt-hashed)
- the **16 real categories** (Resin Furniture & Surfaces … Workshops), empty of products
- **6 FAQs** (delivery, packaging, photo quality, care, price/payment, returns)
- the **SiteSettings** singleton with the exact business values (phone, WhatsApp, email, maps link)
- **2 legal pages** — full original Privacy Policy and Terms & Conditions (re-seeding refreshes their canonical text)
- **0 products.** The catalog is 100% owner-fed via the studio, Bulk Import, or the Product Scraper — nothing is ever auto-invented.

## 5. Run the dev server

```bash
npm run dev
```

- Public site: http://localhost:3000
- Admin studio: http://localhost:3000/studio — log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## 6. Useful scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / serve. **Note:** `npm run build` is `prisma migrate deploy && tsx prisma/bootstrap.ts && next build` — it needs a reachable `DATABASE_URL` |
| `npm run lint` | ESLint 9 |
| `npm run typecheck` | Typecheck (`tsc --noEmit`, strict) |
| `npm run db:seed` | (Re-)seed structure content (`tsx prisma/seed.ts`) |
| `npm run db:seed:blogs` | Seed the 55 blog posts |
| `npm run db:bootstrap` | Run the deploy-time bootstrap (tier catalog import + reconciliation) on demand |
| `npx prisma studio` | Browse the database |
| `npx prisma migrate dev` | Create/apply migrations after schema changes |
| `npx prisma db seed` | Same as `npm run db:seed` |

## 7. File uploads without Vercel Blob (local storage driver)

`src/lib/storage.ts` is a storage abstraction:

- **`BLOB_READ_WRITE_TOKEN` set** → files go to **Vercel Blob** (public CDN URLs). This is automatic — no code change.
- **Token absent (local dev)** → files are written to **`public/uploads/`** and served at `/uploads/...`. Because `next start` won't serve files added to `public/` after the build, a dev fallback route at `src/app/uploads/[...path]/route.ts` streams them instead.

Every upload is recorded in the `Media` table (`url` + `pathname`), so the driver can always list and delete files regardless of backend.

## 8. Troubleshooting

- **First request is slow after idle (Neon):** the free Neon plan scales to zero and auto-wakes on request. A brief cold start is normal — no action needed.
- **`vercel env pull` overwrote my file:** the pull rewrites the target env file completely. Re-add local-only values (e.g. a local `DATABASE_URL`, empty `BLOB_READ_WRITE_TOKEN`) after pulling — or pull into a scratch file and copy only what you need.
- **Prisma errors like "Cannot find module '@/generated/prisma/...'" or a stale client after editing `prisma/schema.prisma`:** run `npx prisma generate` (or `npx prisma migrate dev`, which generates too). The client is generated code and is not committed.
- **`Environment variable not found: DATABASE_URL` from the Prisma CLI:** your values are in `.env.local` but Prisma only reads `.env` (via the `dotenv` import in `prisma.config.ts`). Move/copy them to `.env`.
- **Build or import errors mentioning `document is not defined` around Tiptap/Markdown conversion:** the server converts Markdown → Tiptap JSON using `@tiptap/html/server`, which needs the `happy-dom` package. It is a regular dependency — if it's missing, re-run `npm install`; don't remove it as an "unused" package.
- **Port already in use / broken chunks after rebuilding:** kill any old Next server (`pgrep -f 'next-serve[r]' | xargs -r kill`) before rebuilding — rebuilding `.next` under a live server serves broken chunks.
