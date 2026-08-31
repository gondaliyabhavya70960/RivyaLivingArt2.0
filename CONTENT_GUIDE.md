# CONTENT_GUIDE.md — Content Standards + Import Templates

The single reference for how Rivya Living Art content is written, shot, and bulk-imported. The template tables below match the in-app **Download Template** buttons (Studio → Bulk Import) exactly — the templates are generated from the same definitions (`src/lib/import/templates.ts`).

## 1. Brand voice & tone

Elegant, warm, handcrafted-luxury, immersive ("An heirloom you'll keep forever"). English, `en-IN` locale. Prices in ₹ with Indian digit grouping (₹1,50,000). Honest claims only — timelines are estimates, price bands are indicative, the final quote happens on WhatsApp.

## 2. Originality rule (mandatory)

Every word, title, and image published on the site must be **100% original Rivya Living Art content**. Competitor material — including everything collected by the Product Scraper — is research reference only. Scraper imports arrive as Drafts with a publish-blocking "needs rewrite" flag for exactly this reason.

## 3. Image standards

- Format: **WebP** preferred (JPG/PNG accepted; the media library also takes AVIF — SVG is blocked for security).
- Product photos: **2000px+** — a square 1:1 main shot, a macro detail, a lifestyle shot (4:5 or 16:9), a scale-in-hand shot, and a second image for the shop-card hover.
- Hero / parallax bands: **2400px** wide.
- Blog covers: **1600×900**.
- Blue resin pieces are prioritized for heroes and featured slots (the brand is blue-led).
- Always write alt text — it feeds accessibility and image SEO.

## 4. Video standards

- MP4 (H.264) — WebM welcome as a second source.
- Hero video ≤ **6MB**, a 10–20s loop, always with a poster image.
- Product/portfolio clips 8–15s, ≤ **8MB**.

## 5. Import sources

- **Google Sheet link** — shared as **"Anyone with the link can view"** (or published to the web). The server fetches the sheet's CSV export directly; no Google API keys are needed. A private sheet produces a friendly "could not read the sheet" error.
- **Direct file upload** — `.csv` or `.xlsx`.

## 6. Import behavior

- **Upsert by slug**: a row whose slug already exists **updates** that item; a new slug **creates** one. (FAQs match on the question text; testimonials on name + quote — neither has a slug.)
- **Validation preview before anything is written** — every row is classified Create / Update / Error with per-row messages; error rows are skipped, never the whole file.
- Up to **500 data rows** per file.
- Image columns accept public URLs; images are **downloaded and re-uploaded to Rivya Living Art's own storage** (if a download fails, the original URL is kept so the row still imports).
- Blog and page `content` columns are **Markdown**, converted to the rich-editor (Tiptap) format on import.

### Cell conventions (all templates)

- Headers are case-insensitive.
- **List cells** (`images`, `image_alts`, `occasions`, `tags`, `custom*_options`) accept items separated by `|` or commas — `|` wins, so option labels may contain commas.
- **Booleans**: `TRUE`/`FALSE` (also `1`/`0`, `yes`/`no`).
- **status**: `DRAFT` or `PUBLISHED` (anything else, or empty, becomes `DRAFT`).
- **Slugs** must be URL-safe (lowercase, hyphens); the preview suggests a fix if not.
- **Prices** are whole rupees (integers), `price_min` ≤ `price_max`.

---

## CSV / Google Sheet Templates (exact headers)

### Products

| Required | Optional |
|---|---|
| `title`, `slug`, `category_slug` | `short_tagline`, `description`, `price_min`, `price_max`, `show_price`, `timeline`, `materials`, `dimensions`, `occasions`, `care_notes`, `status`, `tier`, `in_stock`, `featured`, `video_url`, `model3d_url`, `seo_title`, `seo_description`, `images`, `image_alts`, plus the customization columns below |

- `category_slug` must match an existing category (import Categories first).
- `tier` is the catalog tier 1–4 (1 owner · 2 resin goods · 3 supplies · 4 3D print) — products without a tier sort last on the shop; `in_stock` is TRUE/FALSE (defaults to in stock). Empty `tier`/`in_stock` cells leave existing values unchanged on update.
- `occasions` values must come from: **Wedding, Anniversary, Diwali, Birthday, Corporate, Housewarming, Baby** (case-insensitive; unknown values are flagged).
- **Customization fields — repeating column groups `custom1_*` … `custom6_*`** (up to 6 per product):
  `customN_label`, `customN_type`, `customN_options`, `customN_required`.
  `customN_type` is one of **SELECT, TEXT, SWATCH, SIZE, NUMBER, FILE**; `customN_options` is a `|`-separated list (for SELECT/SWATCH/SIZE); `customN_required` is TRUE/FALSE. A group is ignored unless its `label` is filled.

### Categories

| Required | Optional |
|---|---|
| `name`, `slug` | `description`, `image`, `order` |

Import categories **before** products so `category_slug` values resolve. Rows without an `order` are appended after existing categories.

### Blog posts

| Required | Optional |
|---|---|
| `title`, `slug` | `excerpt`, `content`, `cover_image`, `author_name`, `category`, `tags`, `status`, `published_at`, `seo_title`, `seo_description` |

`content` is **Markdown**. `category` and `tags` are created automatically if they don't exist yet. `published_at` is an ISO date (e.g. `2026-01-15` or `2026-01-15T10:00:00Z`).

### FAQs

| Required | Optional |
|---|---|
| `question`, `answer` | `order` |

Questions match case-insensitively — re-importing an existing question updates its answer instead of duplicating it.

### Testimonials

| Required | Optional |
|---|---|
| `name`, `quote` | `location`, `rating`, `avatar_url`, `order` |

`rating` is 1–5 (defaults to 5). A row matching an existing name + quote updates that testimonial.

### Portfolio

| Required | Optional |
|---|---|
| `title`, `slug` | `story`, `category_slug`, `before_image_url`, `after_image_url`, `video_url`, `meta_type`, `meta_material`, `meta_size`, `meta_timeline`, `status`, `images`, `image_alts` |

`category_slug` is optional but must match an existing category when set. The `meta_*` columns fill the case-study result details (Type / Material / Size / Timeline).

### Pages

| Required | Optional |
|---|---|
| `slug`, `title` | `content`, `seo_title`, `seo_description` |

`content` is **Markdown**. Re-importing an existing slug updates that page.

---

## Scraper Sheet Layout — ScrapeDeck v4 (26 columns, exact order)

Emitted identically by the CSV export (`/api/scraper/export`) and the optional Google Sheet sync:

```
sourceKey, vertical, externalId, title, slug, category, shortTagline,
description, priceMin, priceMax, currency, showPrice, timeline, materials,
dimensions, status, featured, images, imageAlts, fields, seoTitle,
seoDescription, url, firstSeen, lastSeen, contentHash
```

Serialization rules: arrays joined with `" | "` · `fields` JSON-stringified · booleans `TRUE`/`FALSE` · dates ISO 8601 · empty for null · RFC 4180 quoting, CRLF line endings. Merge key: `sourceKey|externalId`. Sheet sync writes one tab per tier: **Tier1_Owner, Tier2_ResinGoods, Tier3_Supplies, Tier4_3DPrint** (updates changed rows, appends new ones).

> ⚠️ **Scraper CSVs are for the Sheet/review workflow ONLY — never feed them through the generic Bulk Import.** Scraped competitor content may enter the catalog only via the scraper's Approve flow, which imports as DRAFT with the publish-blocking `needsRewrite` flag. Bulk Import enforces this: any file containing scraper-schema columns (`sourceKey`/`source_key`, `externalId`/`external_id`, `contentHash`/`content_hash`) is **rejected whole-file** with a pointer to the scraper review flow.
