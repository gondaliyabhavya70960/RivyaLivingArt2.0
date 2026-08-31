# SEO_GUIDE.md — Rivya Living Art SEO System

How Rivya Living Art is found on Google — the metadata system, structured data, sitemaps, and the content strategy that compounds on top of them. Editable SEO fields have shipped since Phase 5; the site-wide plumbing (sitemap, robots, manifest, JSON-LD, OG images) lands with the Phase 10 launch work and is documented here as the launch state.

## 1. Metadata system

- Every route uses the **Next.js Metadata API**. The root layout sets `metadataBase` to `https://www.rivyalivingart.com`, a default title ("Rivya Living Art — Luxury Custom Resin Art & 3D Printing"), a `%s · Rivya Living Art` title template, and the default description.
- **Per-entity SEO fields**, editable in the Studio on each item's form:
  - **Products** — `seoTitle`, `seoDescription`, `ogImage` (custom share image)
  - **Blog posts** — `seoTitle`, `seoDescription`
  - **Pages** (Privacy, Terms, custom pages) — `seoTitle`, `seoDescription`
  - Portfolio items, categories, and other public pages derive their metadata from their own content (title, story/description, first image) — they carry no separate SEO fields.
- **Site-wide defaults** live in Site Settings (`defaultSeo`) and are edited at **/studio/seo**. Anything left blank on an item falls back to these, then to the layout defaults.
- Dynamic pages (`/shop/[category]`, `/product/[slug]`, `/blog/[slug]`, `/portfolio/[slug]`) build their metadata from the database via `generateMetadata`.
- **Canonical URLs** are set on all indexable pages, pointing at the `https://www.rivyalivingart.com` domain, so preview deployments and query-string variants never split ranking signal.
- Noindex where it belongs: `/whatsapp-order` (private landing pad) is `robots: noindex`; `/api` is blocked in robots and `/studio` is de-indexed via header (both below); draft previews (staff-only Next draft mode via `/api/draft`) are never linked publicly.

### Localized SEO (9 locales)

- Every indexable page emits a **per-locale canonical plus a reciprocal `hreflang` cluster** covering all 9 locales, incl. RTL Arabic (`localeCanonical`/`localeUrlMap` in `src/i18n/seo.ts`). The default locale uses an **as-needed prefix** — English URLs have no `/en/` segment; other locales are prefixed.
- The **sitemap** emits per-locale entries with language alternates for static pages, but **single default-locale entries for the ~4,400 products** — products declare their alternates in `generateMetadata` instead, keeping the sitemap bounded (SEO-510).

## 2. Open Graph & Twitter Cards

- Default branded OG image (blue, logo + tagline) for every page.
- **Dynamic OG images via `next/og`**: a branded Midnight Gild template (void-blue → midnight-navy → royal-blue gradient with gold accents) that renders the product or post title — so every share on WhatsApp/Instagram/X shows a designed card, not a gray link.
- Per-product override: the `ogImage` field on the product form wins when set; blog posts use their cover image.

## 3. Schema markup (JSON-LD)

Structured data rendered server-side, using **only the exact business facts**:

| Schema type | Where | Notes |
|---|---|---|
| `Organization` | site-wide | Rivya Living Art, logo, `https://www.rivyalivingart.com`, social profiles |
| `LocalBusiness` | site-wide / contact | phone `+91 7096036250`, email `gondaliyabhavya70960@gmail.com`, maps `https://maps.app.goo.gl/L2NHDt9Akgqs2ZoT6` |
| `Product` | product pages | name, images, description, INR price range (`priceCurrency: INR`) matching the visible band; omitted when the product hides its price |
| `Article` | blog posts | headline, cover, author, publish date |
| `BreadcrumbList` | shop / category / product / portfolio / blog | mirrors the visible breadcrumbs |
| `FAQPage` | FAQ page (and contact accordion) | seeded + owner-managed FAQs |

## 4. Sitemap, robots, manifest

- **`sitemap.ts`** — dynamic: home and the static public pages, plus every **published** product, category, blog post, portfolio item, and page, with `lastModified` from the database. Drafts and needs-rewrite items never appear.
- **`robots.ts`** — allows everything public; disallows **`/api`** only; links the sitemap. `/studio` is deliberately **not** robots-disallowed: `next.config.ts` sets an `X-Robots-Tag: noindex, nofollow` header on `/studio/:path*`, and bots must be allowed to crawl it to see that header (a robots disallow would leave URL-only indexing possible).
- **`manifest.ts`** — app name Rivya Living Art, `theme_color` **#1E4FD8** (Midnight Gild royal blue), and the app icon set.

## 5. Content strategy (the blog engine)

The blog is the topical-authority engine. Phase 11 seeds **50+ original posts** — resin care, gift guides, varmala preservation, 3D-printing explainers, festival gifting — with staggered publish dates, internal links into category and product pages, and original photography. Ongoing rule of thumb: every post links to at least one category page; every category is linked from at least two posts. All content obeys the originality rule in CONTENT_GUIDE.md.

## 6. Beating competitor SEO

The researched competitors (e.g. Poonam Shah Art) ship brand-name-only titles, no structured data, and no content engine. Rivya Living Art ships full per-page metadata, JSON-LD on every entity type, dynamic OG cards, a real sitemap, and a growing blog — each one a gap the competition leaves open.

## 7. Performance = SEO

Core Web Vitals are a ranking input, and the budgets are hard: **LCP < 2.5s, INP < 200ms, CLS < 0.1**.

- `next/image` everywhere on public pages (WebP/AVIF, responsive sizes, lazy below the fold).
- Fonts via `next/font` with `display: swap` — no layout shift, no FOIT.
- The hero is a settings-driven video (≤6MB, always with a poster) plus the pinned canvas pour→cure sequence; reduced-motion users get the static poster — LCP content (headline, CTAs) is server-rendered regardless.
- Below-the-fold media is lazy-loaded; hero video capped at 6MB.
- Verify with Vercel Speed Insights (enabled in the dashboard) and Lighthouse before/after major changes.

## 8. Editing SEO in /studio

- **/studio/seo** — the site-wide default title + description (used by search results and link previews whenever an item has no override), plus a checklist linking to where per-item SEO lives.
- **Per item** — the SEO section at the bottom of every product, blog post, and page form.
- Practical guidance: titles ≤ 60 characters with the key phrase first ("Ocean Wave Resin Serving Tray | Rivya Living Art"); descriptions 140–160 characters that read like an invitation, not a keyword list; one target phrase per page.
