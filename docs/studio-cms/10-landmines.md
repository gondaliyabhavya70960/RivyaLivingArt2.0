# 10 — Landmines

Ten hazards that a content CMS walks into in *this* repository. Each is
verified against source, and each would be discovered in production rather than
in review. Read this before Phase A, not after.

Ordered by cost of getting it wrong.

---

## 10.1 A short cache TTL silently caps ISR site-wide

**The rule:** a route's ISR interval is `min(segment revalidate, every cached
read it performs)`.

**The repo has already been burned by it.** `src/lib/catalog-nav.ts:97`:

> *"24h, not 300: a route's ISR interval is min(segment revalidate, every
> cached read it performs) … a 300s TTL here silently capped the PDP's
> revalidate=86400 (M-P6)."*

`site-settings.ts:126` and `site-images-server.ts:33` repeat the reasoning;
both use `revalidate: 86400`.

**Why it is worse for copy than for anything before it.** `getSiteCopy` is read
on *every* route, so a 300s TTL would drop `/product/[slug]` from 86,400s to
300s across **4,373 products × 9 locales**. Nothing fails; the bill and the
origin load simply move.

**Mitigation.** Every new resolver — `getSiteCopy`, `getPageSections` — gets
`revalidate: 86400` and its own tag. Freshness comes from
`revalidateTag(TAG, "max")` in the save action, never from a short TTL. This is
already how §2.4 and §6.8 are written; the point of this entry is that it is
not a stylistic preference.

---

## 10.2 A malformed override renders as its own key path

`src/i18n/request.ts` sets **no `onError` and no `getMessageFallback`**. In
next-intl, a message that fails to resolve or parse renders as the key path —
so a bad override does not fail loudly, it prints `Home.hero.headline` on the
homepage of a luxury brand.

The exposure is real: **90 keys carry ICU placeholders** and one carries a
`t.rich` tag.

**Mitigation, in two layers.**

1. **Reject at save.** Parse both the default and the candidate, compare
   argument names and types, refuse the difference in plain language (§2.6).
2. **Fall back at render.** Add `getMessageFallback` to `getRequestConfig` so
   that when a message is missing or unparseable it returns the **file** value
   rather than the key path:

```ts
getMessageFallback({ key, namespace }) {
  const path = namespace ? `${namespace}.${key}` : key;
  return readFromBundle(path) ?? "";      // the shipped default, never the path
},
onError(error) {
  console.error("[i18n]", error);          // never swallow — see 10.9
},
```

The second layer is what makes the first safe to get wrong once.

---

## 10.3 The plan touches three of the four things REDESIGN.md §1.1 freezes

§1.1 puts **database content**, **Studio/CMS functionality**, **custom-order
form fields** and **backend/API behaviour** out of scope for the redesign. A
content CMS touches three of them.

That is not a reason to stop — §1.1 scopes *the redesign*, and this is a
different piece of work. It is a reason to **open the CMS as its own contract**:
amend `CLAUDE.md` with the boundary from `README.md`, and state explicitly that
the commission-form option lists (§5.3) and the WhatsApp message construction
are in and out of scope respectively. Otherwise the first reviewer to quote
§1.1 is right and the work stalls.

---

## 10.4 Revalidation is locale-blind — eight languages serve stale content

`localePrefix: "as-needed"` (`src/i18n/routing.ts`) gives every non-English
locale its own cache entry: `/hi/privacy`, `/ar/privacy` and seven more are
distinct from `/privacy`.

But `revalidatePublic()` (`src/actions/helpers.ts:84`) pushes **unprefixed
paths only** — `"/"`, `"/shop"`, `` `/blog/${slug}` `` — and
`src/actions/pages.ts:122` does `revalidatePath(`/${page.slug}`)`. So today a
studio save refreshes English and leaves eight locales stale for up to 300s, or
86,400s on the PDP.

A copy CMS makes this the **primary** freshness path rather than a corner case:
the owner edits Hindi, presses save, and sees no change.

**Mitigation.** Revalidate by **tag**, not by path, for every content layer.
Where a path is unavoidable, loop `routing.locales` through `getPathname()`.

**Related, and a correction to `06`, §6.1:** the repo does *not* categorically
avoid full-tree busts — `src/actions/settings.ts:170` calls
`revalidatePath("/", "layout")`. Worth replacing with the settings tag while
this area is open.

---

## 10.5 Deleting a media file can silently break a hero

`src/lib/media-usages.ts` computes where an asset is used, and the delete guard
depends on it. It does **not** query `SiteImage.url`.

So a library file that 62 slots may be pointing at passes the guard and is
deleted, and the storefront serves a dead URL — with no error anywhere, because
`getSiteImages()` only checks that the row's key is known
(`site-images-server.ts:51`), not that its URL still resolves.

**Mitigation.** Add `db.siteImage.findMany({ where: { url: { in: urls } } })`
to `media-usages.ts`, labelled "Site image". Then extend it **in the same
commit** as every new URL-bearing table this plan adds. This is a live bug
today, independent of the CMS.

---

## 10.6 Editor-supplied image URLs are a 500, not a broken image

`next/image` throws at **request time** for a host outside `remotePatterns`
(`next.config.ts:88` — three hosts) and for a `quality` outside
`qualities: [75, 80]`.

Two disciplines exist in the codebase and only one is applied consistently:

| Discipline | Where | Status |
|---|---|---|
| **Validate at write** — `isOptimizableImageSrc` in the Zod schema | `src/actions/site-images.ts:36` | ✅ correct, with an owner-readable message |
| **Degrade at read** — `unoptimized={!isOptimizableImageSrc(url)}` | 40+ catalogue call sites | ✅ |
| **Neither** | `Category.image` (`actions/categories.ts:36`, no host check), `SiteSettings.logoUrl` / `defaultSeo.ogImage` / `heroVideoUrl` (`actions/settings.ts:31,37,38`, bare `z.url()`) | ❌ |

Slot consumers render a **bare** `<Image src={images["about.hero"]}>` with no
`unoptimized` guard (`about/page.tsx:183`, `page.tsx:254`), so they rely
entirely on write-time validation.

Three residual holes worth knowing:

1. `urlSchema` accepts **any** string starting with `/` — `/does-not-exist.jpg`
   passes and 404s.
2. Validation happens only at write, so a later `remotePatterns` edit, a
   rotated Blob store or a Cloudinary account change converts every stored
   override into a request-time throw.
3. `/uploads/**` is non-optimizable per `image-src.ts:26` but passes
   `urlSchema` and renders through the optimizer anyway. Dev-only, but real.

**Mitigation.** Every new editable image field validates with
`isOptimizableImageSrc` at write **and** renders with
`unoptimized={!isOptimizableImageSrc(url)}` + `isRenderableSrc` at read. Belt
and braces — the write-time check alone is one config change away from failing.

---

## 10.7 Reordering sections breaks the cure line

`CureMark` ids and their `dark` flags are **hand-maintained** against the
`<section id>` values (`page.tsx:214`, `cure-line.tsx:41`). The rail is not
derived from the sections; it is a parallel list that happens to agree with
them.

The moment section order or visibility becomes editable, the two diverge: a
hidden section leaves a tick pointing at nothing, and a reorder puts the rail
out of sequence with the page.

**Mitigation.** Generate `cureMarks` from the same resolved section list the
renderer walks (`04`, §4.4). One source of truth, or the signature device of
the site quietly rots.

The band rhythm has the same shape: the homepage's dark-band spacing is
hand-tuned (`page.tsx:88`). Validate the **resolved** list at save time against
the three band rules and **refuse** the save — do not warn (`04`, §4.6).

---

## 10.8 The design guardrails are weaker than they look — RESOLVED

Two facts that undercut leaning on the audit scripts as enforcement:

1. **Neither audit runs in CI.** `.github/workflows/ci.yml` is typecheck ·
   lint · test · build. `redesign-audit.mjs` and `a11y-audit.mjs` need a
   running server with real content, so they are run by hand.
2. **The champagne check can never fire.** `redesign-audit.mjs:203` compares a
   **hex** token against `getComputedStyle().color`, which serializes as
   `rgb()`. The comparison is always false.

And the homepage already carries **two** `priority` images, so "one LCP image
per page" is untrue before any section reorder.

**All three are fixed.** Phase 0 normalized the champagne comparison to
`rgb()`. The build job now starts the server it produced and runs both audits
over twelve public routes at 1440px and 390px, so they gate every pull request
rather than depending on someone remembering. CI's database is bootstrapped
rather than populated, so detail routes (`/product/…`, `/blog/…`,
`/portfolio/…`, `/p/…`) still need a hand run — a gate that guessed a slug
would fail on the wrong thing.

The homepage's second `priority` was on the featured product card, which sits
**1812px down at 1440×900** — a full screen below the hero. It was emitting a
`<link rel="preload">` for a full-size image on the third-party catalogue host,
opening a cross-origin connection on the critical path to fetch something the
visitor cannot see until they scroll. Removed; every public route now emits at
most one image preload, and the pages with no hero photograph emit none.

This was not theoretical. Phase G shipped a dark-band toggle that the design
audit caught and the hand-written guardrail did not, because the guardrail
looked at blocks and the obsidian footer is not one.

---

## 10.9 The editor UI will fail the build on its first naive effect

`react-hooks/set-state-in-effect` is a **hard CI gate** (`ci.yml:41` runs
`npm run lint`), and `CLAUDE.md` makes it a repo convention. The audit trail
shows it has bitten before (`audit/FINDINGS.md:465`, "×4").

A section editor is precisely the shape that provokes it: *props change → reset
local draft*, *row reorders → resync indices*, *locale tab switches → reload
field values*, *action returns → clear dirty flag*. Every one of those is a
`useEffect(() => setX(…))`.

**Mitigation — copy the patterns already in the repo:**

| Need | Pattern | Example |
|---|---|---|
| External store → render | `useSyncExternalStore` | `src/hooks/use-prefers-reduced-motion.ts:18`, `use-overlay-signal.ts:12` |
| Reset on identity change | `key` remount | — |
| Derived value | compute in render | `usePagination` (`CONTEXT.md:109`) — render-time reset, derived clamp |
| Scroll / animation | direct DOM write | `cure-line.tsx:23` writes `element.style.transform`, never state |

---

## 10.10 Every key the CMS adds grows every page, in nine languages

`NextIntlClientProvider` is mounted at `src/app/[locale]/layout.tsx:212` **with
no `messages` prop**, so the entire catalogue is serialized into every page's
Flight payload:

| Locale | Catalogue |
|---|--:|
| `en.json` | 69 KB |
| `hi.json` | 131 KB |
| `gu.json` | 127 KB |
| `ar.json` | 96 KB |

That is a pre-existing cost, but it changes the economics of the copy layer:
adding registry keys is not free, and the 33 orphans in `Home` (`01`, §1.3) are
already being shipped to every visitor on every page.

**Mitigation.** Pass an explicit `messages` subset to the provider — most
client components need `Common`, `Nav`, `Shop.card` and `WhatsApp`, not
`Portfolio.case` — and delete the orphaned keys from all nine files. Both are
worth doing during Phase A, while this file is being touched anyway.

---

## Two more, briefly

**CSP is report-only, and masking three gaps.** `media-src`,
`connect-src blob.vercel-storage.com` and `worker-src blob:` are missing. The
hero video, Blob client uploads and any client-side image tooling would break
the moment the header is renamed to `Content-Security-Policy`. Add the
directives *before* enforcing.

**`bootstrap.ts` runs on every deploy.** The site-image import is correctly
gated on the table being empty, because reset-to-default is a row DELETE and
re-importing would undo it (`CLAUDE.md`). Every CMS table this plan adds needs
the same gate, or a deploy resurrects content the owner deleted.

**RTL has no lint rule.** `eslint.config.mjs` is `next/core-web-vitals` +
`next/typescript` and nothing else, so logical properties are a review
convention only — and physical properties are already shipped at
`product-card.tsx:68`, `dialog.tsx:86,104`, `reference-image-uploader.tsx:270`.
The compounding risk: the Studio is English-only by design, so a developer
building CMS screens gets **zero RTL feedback** while writing markup they will
then copy into storefront components.
