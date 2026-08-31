# 09 — Spec Reconciliation

The uploaded *"Rivya Living Art Studio — Master CMS Spec (v2, merged)"* was written
from a **crawl of the deployed site**, not from this repository. Its Part 1
audit is careful and, where it is right, this plan adopts it wholesale. But a
crawl cannot see `messages/en.json`, cannot see `site-images.ts`, and cannot
tell a deleted section from one that never existed.

This document checks every load-bearing claim against the code, so that nothing
in it gets re-litigated later.

**Verdict key:** ✅ holds · ❌ does not hold · 🟡 partly · ⏳ not checkable from
the repo alone.

---

## 9.1 The claims

| # | Spec claim | Verdict | Evidence | What is actually true |
|--:|---|:--:|---|---|
| 1 | "**~85% of visible words live in `.tsx` files**" | ❌ | `messages/en.json` | Every user-facing string goes through next-intl: **1,149 English strings across 29 namespaces**, mirrored in all nine locale files. Even alt text is keyed (`About.materials.alt1…4`). This single fact restructures the whole plan — see `README.md`. |
| 2 | "Homepage has 17 distinct sections (19 rendered — two duplicate)"; "From liquid to light" and "Notes from the studio" render twice | ❌ | `src/app/[locale]/(v2)/page.tsx:240–858` | **13 numbered sections, no duplicates.** The v3 redesign deleted them explicitly; the file's own header lists the removals: *"the duplicate 'From liquid to light' (it rendered twice) … the standalone duplicate newsletter section"*. The crawl saw the pre-redesign deploy. |
| 3 | "Five image sources", incl. hotlinked `resinartsjaipur.com` / `i0.wp.com` raw `<img>` on 8 homepage products | ❌ | `grep -rn '"/media/\|src="/' src/app src/components` → no matches outside the slot registry | **No hardcoded image path survives in any component** and no component authors a raw `<img>` for content. Third-party catalogue URLs from sheet import are mirrored to Blob (`src/lib/catalog-mirror.ts`, `/api/cron/mirror-images`). **The crawl's observation was fair, though:** an unmirrored host renders through `next/image` with `unoptimized`, which still emits a plain `<img>` at a third-party URL — deliberate, so ~10k catalogue images cannot exhaust the optimization quota (`src/lib/image-src.ts:24`). Also, the homepage renders **4** featured products, not 8 (`page.tsx:128`, `take: 4`). |
| 4 | "**Two shells shipped**" — a home nav vs a FAQ nav, flat vs 4-column footer | ❌ | `src/app/[locale]/(v2)/layout.tsx` | **One shell.** Every storefront route renders through one layout mounting one `SiteHeader`, one `Footer`, one `AnnouncementBar`, one `MobileBottomBar`, one `WhatsAppFab`, one `SearchOverlay`. Nav can be modelled once. |
| 5 | "Footer heading casing: `explore / studio / Journal / contact`" | 🟡 | `messages/en.json` `Footer.*`; `footer.tsx:394`, `:220`; `globals.css:318` | The inconsistency is real **in the data** (`"explore"`, `"studio"`, `"contact"` lowercase, `"Journal"` capitalised) but **invisible on screen**: every column heading renders through `u-micro`, which sets `text-transform: uppercase`. All four read EXPLORE / STUDIO / JOURNAL / CONTACT. Worth tidying when Phase A makes them editable; not a rendering defect. |
| 6 | "Newsletter appears twice with different copy" | 🟡 | `footer.tsx:308`; `blog/page.tsx:584` | The *homepage* duplicate was deleted in v3. Two mounts still exist repo-wide and their copy does differ: the footer (`Footer.newsletterLabel` "Get first access to new drops." + `newsletterHint` "Three or four letters a year") on every page, and `/blog` (`Newsletter.heading` "The studio letter."). Same component, different words — a copy-level duplication Phase A makes visible and fixable. |
| 7 | "**9 locales in the switcher, 100% English content**" | ❌ | `src/i18n/routing.ts` | Real translations shipped for all nine. The routing config turned on `localeDetection` for exactly that reason: *"Real translations landed for all 9 locales (I2a/I2b-1…6 + I3 catalog localization)"*. |
| 8 | "**Custom-order dropdowns are business config living in code**" | ✅ | `src/components/sections/custom-order-form.tsx:41,49,58,65` | Correct, and worse than stated: `MATERIAL_OPTIONS`, `BUDGET_OPTIONS`, `TIMELINE_OPTIONS` and `OCCASION_OPTIONS` are **English literals that bypass next-intl entirely** — they render in English in all nine locales inside a form whose labels are translated. See `05`, §5.3. |
| 9 | "Stats (`100%`, `500+`, `1 of 1`) and marquee (`Resin Reimagined·`) hardcoded" | ❌ | `page.tsx` header; `grep -rn Marquee src/app` | The stat row was **deleted** in v3 as *"the undefendable stat row"*. The `Marquee` component is used only in `/design-lab`, not on any storefront route. Do not re-seed either. |
| 10 | "Price contradiction: exact prices on cards vs 'indicative price band' in the FAQ" | 🟡 | `Product.priceMin/priceMax/showPrice`; no "indicative" string in `messages/en.json` | The copy contradiction is gone, but the **display rule is still implicit** — three fields with no single formatter, so cards, PDP, JSON-LD and the WhatsApp message can drift. `05`, §5.6 makes the rule explicit. |
| 11 | "**No social links anywhere in the footer**" | 🟡 | `src/components/storefront/footer.tsx:33`; `settings-form.tsx:87` | The links are **fully wired** — Instagram, Facebook, YouTube and Pinterest are edited in Settings and rendered in the footer, which shows only the URLs the owner filled. Nothing renders because nothing is filled in. That is a business task, not a build task. LinkedIn has no field. |
| 12 | "The collections section is headed 'The collections' and there are 8" | ❌ | `page.tsx:56`, `COLLECTION_TILES` | **Six editorial tiles**, per REDESIGN.md §6.05, which absorbed and replaced both the eight-link list and the separate "three studios" block. |
| 13 | "Three separate step lists: homepage 3, `/about` 4, `/process` 6" | 🟡 | `Home.showcase` (`stage1–4`, ending "The polish"), `Home.how` (`step1–4`), `About` craft panels (4), `Process.timeline` (6) | The shape holds but both numbers are wrong. There are **four** lists, not three — the homepage carries two of them, the material story *and* "How it works" — and the counts are **4 / 4 / 4 / 6**. The spec's emphatic "do not add a fourth 'Polish' step; it isn't on the homepage" is exactly inverted: `showcase.stage4Title` **is** "The polish". |
| 14 | "`/faq` anchors are cuids ⇒ already DB-backed" | ✅ | `Faq` model; `/studio/faqs` | Correct. |
| 15 | "**FAQ has no `FAQPage` JSON-LD** — biggest quick win" | ❌ | `src/app/[locale]/(v2)/faq/page.tsx:91` | Already emitted, from the same localized rows the page renders, so schema cannot drift from content. Twenty structured-data types ship across the app (see below). |
| 16 | "`/privacy`, `/terms`, `/contact`, `/search` are static" | ❌ (legal) 🟡 (rest) | `privacy/page.tsx`, `contact/page.tsx:73` | `/privacy` and `/terms` are **DB-backed Tiptap documents** with per-locale translations, edited at `/studio/pages`. `/contact` already reads `SiteSettings` for phone, email, WhatsApp, maps and address. `/search` is genuinely copy-only. |

---

## 9.2 The single most important way the repo has moved on

**Content addressing.** Every word has a stable i18n key and every editorial
photograph has a stable slot key, with a registry, a bundled default, an
override table and a tag-invalidated resolver already shipped for the pictures
(`src/lib/site-images.ts` → `SiteImage` → `getSiteImages()`).

The spec's plan is written for a codebase where content has no addresses, so it
must invent them — hence 24 section schemas holding the content itself. This
repo already has the addresses. Extending the proven picture pattern to words
delivers the same outcome in a fraction of the work and with a fraction of the
risk.

---

## 9.3 What the spec gets right, and this plan adopts

Being wrong about the starting point does not make the spec wrong about the
destination. Adopted essentially unchanged:

| Adopted | Where it lands |
|---|---|
| **Fixed registry, editable content** as the governing rule | `README.md`, `04` §4.3 |
| Rejecting a "Custom HTML" block — XSS vector, guaranteed layout rot | `README.md` |
| Rejecting Sanity in favour of the existing Auth.js + Prisma studio | Implicit throughout |
| Rejecting `revalidatePath('/', 'layout')`; tag-scoped only | `06` §6.8 — and the repo does **not** fully follow this yet: `src/actions/settings.ts:170` still busts the whole tree. See `10` §10.4 |
| Separate desktop / mobile crops per slot | `03` §3.2, Gap 2 |
| Focal point per image | `03` §3.2, Gap 4 |
| Non-destructive image edits (original never overwritten) | `03` §3.5 — deferred, with reasoning |
| Automatic SEO filenames on upload | `03` §3.4 |
| Media "Used in" list, delete guard, missing-alt and unused filters | `03` §3.4 |
| The renderer that never crashes production on a bad payload | `04` §4.4 |
| "Edit this section" via Alt+click from the preview | `06` §6.3 |
| Version history with restore **to draft, never to live** | `06` §6.5 |
| Publish checklist split into blockers and warnings | `06` §6.4 |
| An explicit "what must NOT be editable" list | `01` §1.5, `README.md` |
| Studio keeps a neutral SaaS design language, not the site's dark theme | Already true (`.studio-v2`) |
| Custom landing pages for seasonal drops, same registry, `/p/[slug]` | `04` §4.8 |
| `NavMenu` / `NavItem` for header and footer | `05` §5.4 |
| Commission form options as data | `05` §5.3 — the spec's single most valuable operational finding |
| Business hours / response time as fields | `05` §5.2 |
| Workshop entity with seats, price, status | `05`, future phase |
| Occasion taxonomy as a third axis | Deferred — `Product.occasions` is a JSON array today |
| Bulk product actions and CSV import/export | **Already built** — `/studio/import`, `/studio/sheet-import`, `src/lib/import/templates.ts`, documented in `CONTENT_GUIDE.md` |

---

## 9.4 Where this plan deliberately departs

| Spec says | This plan | Why |
|---|---|---|
| Sections hold their content in `data` JSON, validated by 24 Zod schemas | Sections hold **order, visibility and switches only**; copy stays keyed, images stay slotted | The content already has addresses. Duplicating it into a blob creates two sources of truth for the same string |
| Rewrite 40+ components as props-driven | **Zero** component rewrites for system pages | A manifest walk gets order and visibility without touching the render |
| New `MediaAsset` / `MediaFolder` tables beside `Media` | Extend `Media` | Two asset tables is the two-datastore mistake the spec itself rejects for Sanity |
| Five roles (`OWNER/ADMIN/EDITOR/MEDIA/VIEWER`) | Keep the existing **two** | Five roles for a two-person studio is an unmaintained permission matrix |
| Ship `en / hi / gu`, hide the other six | Keep all nine | They are genuinely translated; hiding shipped translations is a regression |
| First editable headline: day 14 | Day 5 | See `07` |
| Phase 2 "delete `/public/media`, prune `remotePatterns` to one entry" | Keep the bundled defaults; treat `remotePatterns` reduction as a separate catalogue task | The bundled files are what makes "Reset to default" possible and what guarantees a DB outage degrades instead of breaking |
| FAQ `FAQPage` schema as the "biggest quick win" | Already shipped | — |

---

## 9.5 Claims that cannot be settled from the repository

| Claim | Why | How to settle it |
|---|---|---|
| "312 products" / "collection counts sum to 378" | Product rows live in the production database | `SELECT count(*) FROM "Product" WHERE status = 'PUBLISHED';` — the spec is right to insist nobody quotes a number before running this |
| Whether the live deploy matches `Main` | Three routes to the rendered site were tried and all are closed from this environment: the production domain returns 403 at the egress proxy (`store.bhavyagondaliya.co.in`), the branch's Vercel preview domain is blocked by the same policy, and the preview is additionally behind Vercel deployment protection (302 → `vercel.com/sso-api`) | Compare the deployed commit in Vercel against `origin/Main`, or open the site yourself. **If the live site still shows duplicated sections, a stat row or an eight-link collections list, the deploy is behind the repository** — and several ❌ verdicts above would be accurate descriptions of what is *deployed*, though not of what is *committed* |

That last row is the one caveat worth holding onto: this document is a
reconciliation against the **code**. Where the crawl and the code disagree, the
most likely explanation is that the crawl predates the v3 redesign — but
confirming which commit is live takes thirty seconds and removes the doubt.
