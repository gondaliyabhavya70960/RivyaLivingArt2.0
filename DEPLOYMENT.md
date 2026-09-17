# DEPLOYMENT.md — Vercel Deployment Guide

Everything runs Vercel-native: hosting, Neon Postgres (Marketplace), Blob storage, Analytics, and optional Resend — one dashboard, one bill. Follow the steps in order; the whole walkthrough takes about 30 minutes.

## 1. Import the repository

1. Go to https://vercel.com/new (signed in as the project owner, gondaliyabhavya70960@gmail.com).
2. Import the GitHub repo **`gondaliyabhavya70960/RivyaLivingArt2.0`**.
3. Framework preset: **Next.js**. Keep the default build settings (the repo's `npm run build` runs `scripts/migrate-deploy.mjs && tsx prisma/bootstrap.ts && next build` — migrations and catalog bootstrap happen inside the build). No overrides are required.
4. **Connect storage and set env vars BEFORE the first deploy** — the build requires `DATABASE_URL` and fails at `migrate deploy` without it.

## 2. Storage — Neon Postgres (native integration)

1. Vercel Dashboard → your project → **Storage** tab → **Create Database** → **Neon (Postgres)**.
2. Connect it to the project. `DATABASE_URL` (pooled connection string) is **auto-injected** into all environments — never paste it by hand.
3. The Neon Free plan is fine to start: it auto-suspends when idle and auto-wakes on request (the first request after idle may be briefly slow — normal).

## 3. Storage — Vercel Blob

1. Storage tab → **Create** → **Blob** → connect to the project.
2. `BLOB_READ_WRITE_TOKEN` is **auto-injected**. All media (product galleries, blog covers, customer reference images) is stored here and served publicly from Vercel's CDN.
3. The app's storage driver (`src/lib/storage.ts`) switches from local disk to Blob automatically when the token is present — no code change.

## 4. Environment variables

Project → **Settings → Environment Variables** (all environments unless noted). See `.env.example` for the full list:

| Variable                                             | Value                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                                        | Output of `npx auth secret` (any strong random string)                                                                                                                                                                                                                                                                                                                                      |
| `AUTH_URL`                                           | `https://www.rivyalivingart.com` (Production) — **the scheme is not optional**: Auth.js calls `new URL()` on this value inside the middleware, so a bare `rivyalivingart.com` used to 500 every `/studio` route while the public site stayed up. It is repaired and warned about now (`src/lib/auth.config.ts`); set it correctly anyway, or leave it unset and let the request host answer |
| `ADMIN_EMAIL`                                        | `gondaliyabhavya70960@gmail.com` — seed-only: creates the admin login                                                                                                                                                                                                                                                                                                                       |
| `ADMIN_PASSWORD`                                     | A strong password — seed-only                                                                                                                                                                                                                                                                                                                                                               |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`                        | `917096036250`                                                                                                                                                                                                                                                                                                                                                                              |
| `NEXT_PUBLIC_SITE_URL`                               | `https://www.rivyalivingart.com`                                                                                                                                                                                                                                                                                                                                                            |
| `RESEND_API_KEY`                                     | _(optional)_ — email delivery via Resend: contact-form + order notifications and password-reset emails (install from the Vercel Marketplace; WhatsApp remains the primary channel)                                                                                                                                                                                                          |
| `RESEND_EMAIL_DOMAIN` / `RESEND_FROM` / `EMAIL_FROM` | _(optional)_ — sender address for Resend emails (domain shorthand, or a full from address)                                                                                                                                                                                                                                                                                                  |
| `NEXT_PUBLIC_META_PIXEL_ID`                          | _(optional)_ — Meta Pixel id; the pixel stays off unless set                                                                                                                                                                                                                                                                                                                                |
| `NEXT_PUBLIC_GA_ID`                                  | _(optional)_ — GA4 measurement id; GA stays off unless set                                                                                                                                                                                                                                                                                                                                  |
| `CRON_SECRET`                                        | Bearer token Vercel sends on every cron call — `/api/cron/scrape-drain`, `/api/cron/publish-scheduled`, `/api/cron/mirror-images` (see §12). **Without it every cron answers 401 and nothing is collected**; production ran that way from B1 until 2026-09-17. Any long random string; redeploy after setting it                                                                                                                                                                                                                                                                                                 |
| `AUTH_TRUST_HOST`                                    | `true` — **required for any production deploy outside Vercel** (boot fails without it; on Vercel it's unnecessary, `VERCEL=1` is auto-trusted)                                                                                                                                                                                                                                              |
| `SCRAPER_USER_AGENT`                                 | _(optional)_ — custom User-Agent for scraper requests                                                                                                                                                                                                                                                                                                                                       |
| `DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING` | _(auto-injected by Neon)_ — direct (non-pooled) connection preferred by the Prisma CLI for migrations                                                                                                                                                                                                                                                                                       |

`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are already there from steps 2–3.

## 5. First deploy

Trigger a deploy (push to the default branch, or the **Deploy** button). The build runs `scripts/migrate-deploy.mjs && tsx prisma/bootstrap.ts && next build` with the injected env — it should complete green, and by then the database is already migrated and bootstrapped (four-tier catalog import, portfolio cases, 55 blog posts on an empty DB). Step 6 covers the remaining one-time seed details.

## 6. Run migrations + seed against Neon (once)

From your local machine, in the repo:

```bash
npm i -g vercel                                # if not installed
vercel link                                    # link the folder to the Vercel project
vercel env pull .env --environment=production  # pulls the production DATABASE_URL
npx prisma migrate deploy                      # applies all committed migrations
npx prisma db seed                             # admin user, 16 categories, FAQs, settings, legal pages — 0 products
```

Notes:

- The Prisma CLI reads `.env` (loaded by `prisma.config.ts`), which is why the pull targets `.env`. Make sure `ADMIN_EMAIL` / `ADMIN_PASSWORD` are present in that file before seeding — the seed refuses to run without them.
- The seed is idempotent; re-running it refreshes categories/FAQs/legal text and never touches products.
- **Alternative (set-and-forget):** in Project → Settings → Build & Development, set the Build Command to `npx prisma migrate deploy && next build` so every deploy applies pending migrations automatically. Seeding still happens once, manually, as above.
- After seeding, restore your local `.env` if you develop against a local database (the pull overwrote it).
- **Blog + category covers (Step-4 generated imagery):** also run `npm run db:seed:blogs` once (55 posts, each with a cover) — the category covers reconcile automatically on deploy. Covers initially point at the public Higgsfield CDN (`d8j0ntlcm91z4.cloudfront.net`, allow-listed in `next.config.ts`). To move them first-party, run `node scripts/mirror-generated-images.mjs` on any machine with open internet, commit the resulting `public/images/` files, re-run both seeds (they prefer local files and never overwrite covers you've set in Studio), then drop the cloudfront entries from `next.config.ts`.

## 7. Custom domain — www.rivyalivingart.com

1. Project → **Domains** → Add → `www.rivyalivingart.com`.
2. At the DNS provider for `bhavyagondaliya.co.in`, add the **CNAME** record Vercel shows: host `store` → `cname.vercel-dns.com` (Vercel displays the exact target — use what the dashboard says).
3. Wait for DNS + automatic HTTPS to go green in the dashboard.
4. Confirm `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` both say `https://www.rivyalivingart.com`, **with the `https://`** — login and wa.me messages depend on them, and a scheme-less host is what took `/studio` down (docs/troubleshooting.md).

## 8. Verify the deployment

1. Open `https://www.rivyalivingart.com/studio` → log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → dashboard loads, 16 categories listed.
2. Create a quick test product (Draft → use the draft preview link → Publish).
3. On the public product page, fill the order form and press **Place Order**: WhatsApp must open with the pre-filled message to `wa.me/917096036250`, and the order must appear under **Studio → WhatsApp Orders**.
4. Delete the test product (and its inquiry) afterwards.

## 9. Analytics & Speed Insights

The components (`@vercel/analytics`, `@vercel/speed-insights`) already ship in the root layout — you only need to switch them on: project → **Analytics** tab → Enable, and **Speed Insights** tab → Enable. Custom events tracked by the app: `order_submitted`, `whatsapp_redirected`, `whatsapp_cta_click`, `custom_order_submitted`, `contact_submitted`, `newsletter_subscribe`, `share_product`. Lead events (`order_submitted`, `custom_order_submitted`, `contact_submitted`, `newsletter_subscribe`) also fire Meta Lead + GA4 `generate_lead` conversions when `NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GA_ID` are set.

## 10. Pre-launch checklist

- [ ] **DEMO purge** — the seed no longer creates any DEMO products, so a fresh database ships clean. If this database ever held build-time DEMO items, confirm none remain: Studio → Products, search "DEMO" → delete all hits (public pages filter them out, but they must not exist at launch).
- [ ] Replace every placeholder image with real Rivya Living Art photography (see CONTENT_GUIDE.md standards).
- [ ] Set the real **Instagram handle** in Studio → Site Settings → Socials (the footer icon links from there).
- [ ] Review Site Settings: announcement bar text, hero video, logo, default SEO, default care notes.
- [ ] Test the WhatsApp order flow on **iPhone, Android, and desktop WhatsApp Web** (see WHATSAPP_ORDER_GUIDE.md testing checklist).
- [ ] Lighthouse pass against budgets: **LCP < 2.5s, INP < 200ms, CLS < 0.1**.
- [ ] Take a database backup (see BACKUP_GUIDE.md) once real content is in.

## 11. Plan upgrade path

The Vercel **Hobby** plan is officially non-commercial. When the store goes commercial, upgrade to **Vercel Pro ($20/mo)** — the entire Vercel-native stack (Neon, Blob, Analytics) carries over with **zero re-architecture** and billing stays on one Vercel invoice. Keep media web-optimized (WebP images, hero video ≤ 6MB) to stay inside the Blob/Image-Optimization allowances.

## 12. Cron jobs

Three Vercel crons ship in `vercel.json`: `/api/cron/scrape-drain` every ten minutes (drives unattended scrape jobs forward — the review inbox fills through it), `/api/cron/publish-scheduled` hourly (scheduled content goes live), and `/api/cron/mirror-images` daily at 02:30 UTC (mirrors imported catalog images into Blob in batches; the Catalog fill page shows the backlog and can run a batch on demand). Every route authenticates via a `Bearer` header — set the `CRON_SECRET` env var (§4) **and redeploy**. Vercel sends the header automatically on cron invocations, but only when the variable exists: without it each tick is a silent 401 — no dashboard error, no email, no collection. That was production's state from 2026-09-15 to 2026-09-17, found only in the runtime logs. A staff session is accepted too, so the owner can kick any of the three from the browser while logged into the Studio.
