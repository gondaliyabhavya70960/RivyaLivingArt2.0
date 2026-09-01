# 07 — Build Order

> **All nine phases are shipped.** This document is kept as it was written: the
> ordering argument is why the code arrived in the shape it did, and the
> "done when" lines are what each phase was actually checked against. Where the
> build departed from the plan, the departure is noted in
> [`README.md`](README.md) and in the phase below.

Nine phases. The ordering principle is **value per day of risk**: the change
that hands the owner the most control for the least chance of breaking a live
site goes first, regardless of how architecturally interesting it is.

Estimates assume one developer who knows this codebase.

---

## The sequence at a glance

| # | Phase | Days | Owner gains | Risk |
|---|---|--:|---|---|
| **0** | Fix what is already broken | 1 | Five live defects the CMS would inherit | Very low |
| **A** | Copy layer | 5 | **Every word on the site, in 9 languages** | Very low — additive table, one merge point, revert = one file |
| **B** | Image depth | 3.5 | Alt text inline, mobile crops, focal points | Low |
| **C** | Business config | 2 | Commission dropdowns, opening hours, announcement scheduling | Low |
| **D** | Nav & footer | 2 | Add/remove/reorder every link | Medium — a bad href is a 404 |
| **E** | Draft · preview · publish | 4 | Review before live, restore after a mistake | Medium |
| **F** | Structure layer | 7 | Reorder and hide sections, one editor per page | **High — touches every marketing page** |
| **G** | Custom landing pages | 2.5 | Seasonal drops without a deploy | Low |
| **H** | Media depth | 3 | Dedupe, LQIP, usage guard, brand icons | Low |
| **I** | Close the content gaps | 2 | Taxonomy names in 9 languages, frame captions, asset provenance | Low |
| | **Total** | **32** | | |

Compare with the spec's 31 days: similar total, very different shape. There,
the owner's first editable headline arrives at the end of **Phase 5, day 14**.
Here it arrives on **day 6**, and phases B–H are improvements to a site that is
already the owner's.

---

## Phase 0 — Fix what is already broken · 1 day  ✅

Five defects the audit surfaced that the CMS would otherwise inherit or amplify.
Each is small, each is independently shippable, and each becomes much more
expensive once content is editable. Details and evidence in
[`10-landmines.md`](10-landmines.md).

| Fix | Why it comes first |
|---|---|
| Add `SiteImage.url` to `src/lib/media-usages.ts` | The delete guard cannot see slot usage today, so deleting a library file silently breaks a hero (§10.5) |
| Revalidate by tag, not path, in `revalidatePublic()` and `actions/pages.ts:122` | `localePrefix: "as-needed"` gives eight locales their own cache entries that no save currently refreshes (§10.4) |
| Replace `revalidatePath("/", "layout")` in `actions/settings.ts:170` with the settings tag | A full-tree bust on every settings save (§10.4) |
| Add `onError` + `getMessageFallback` to `src/i18n/request.ts` | Without them a bad message renders **as its own key path** on the live site (§10.2) |
| Fix the champagne check in `redesign-audit.mjs:203` (hex vs `rgb()`) | The guardrail this plan leans on can never fire (§10.8) |

Delete the 33 orphaned `Home.*` keys from all nine locale files in the same
pass — they are shipped to every visitor in every Flight payload and would
otherwise become 33 editable fields that change nothing (§10.10, `01` §1.3).

---

## Phase A — Copy layer · 5 days  ✅

**Deliverable:** every one of the 1,149 storefront strings editable per locale
at `/studio/site-copy`, with reset to the shipped default.

| Day | Work |
|--:|---|
| 1 | Migration (`SiteCopy`), `scripts/site-copy-registry.mjs` generator, `src/lib/site-copy.generated.ts`, group/section/kind/tier inference |
| 2 | `site-copy-server.ts` resolver, `applyCopyOverrides` with copy-on-write, merge in `src/i18n/request.ts`, `SITE_COPY_TAG` |
| 3 | `src/actions/site-copy.ts` — set/reset/reset-page, ICU + tag validation, rate limit, `logActivity` |
| 4 | `/studio/site-copy` board: grouping, search, locale switch, "only changed", "show interface strings", inline diff against default |
| 5 | Hand-written labels for the ~120 highest-traffic keys; CI check; docs |

**Done when:** an ADMIN changes the homepage headline in the studio, and within
one revalidation it is live in English while Hindi still shows its own
translation — and pressing Reset restores the shipped copy exactly.

**Verify:**
```bash
npm run typecheck && npm run lint && npm run test && npm run build
node scripts/i18n-missing.mjs                          # JSON untouched
node scripts/redesign-audit.mjs "/en,/en/about,/en/process"
node scripts/a11y-audit.mjs  "/en,/en/about,/en/process"
```

**Rollback:** revert the merge in `request.ts`. Rows stay, unread.

**Depends on Phase 0** for `getMessageFallback` and tag-based revalidation —
without the first, a bad override prints a key path; without the second, the
owner edits Hindi and sees nothing change.

---

## Phase B — Image depth · 3.5 days  ✅

| Day | Work |
|--:|---|
| 1 | `altKey` on `SiteImageSlot` for all 62 slots; inline alt field on the Site Images board writing to `SiteCopy` |
| 2 | Migration: `mobileUrl`, `mobileMediaId`, `focalX`, `focalY` on `SiteImage`; resolver returns refs not strings |
| 2.5 | `<picture>` + focal rendering inside `MeniscusImage` (never a second image component — the meniscus reveal replaces every fade-up) |
| 3 | Focal-point click overlay and mobile-crop slot in the picker; `minWidth` guidance |
| 3.5 | Call-site migration, page by page, each its own commit |

**Done when:** the About hero has a distinct 4:5 mobile crop, the maker portrait
is focused on the face at 1:1, and every slot's alt text is edited next to the
picture it describes.

---

## Phase C — Business config · 2 days  ✅

`FormOption` table + seed from the existing constants (values preserved, so no
`Inquiry` changes meaning) · `/studio/forms` · the four `SiteSettings`
additions (hours, response note, announcement scheduling).

**Done when:** the owner adds a "₹50,000–₹1,00,000" band and it appears in the
commission form, in the WhatsApp summary, and translated into Hindi — with no
deploy.

**Guard:** `src/actions/order.ts` must be untouched. The form still submits a
string; only the source of the list moves. Run the WhatsApp flow end to end
before merging — it is a HARD RULE.

---

## Phase D — Nav & footer · 2 days  ✅

`NavMenu`/`NavItem`, seeded from `FOOTER_LINKS` and the current header so day
one is byte-identical · route-manifest validation on `href` · drag-reorder ·
delete `src/lib/constants.ts`'s `FOOTER_LINKS`.

**Done when:** the owner adds a "Workshops" link to the footer's Studio column,
reorders it, and a typo'd href is refused at save time rather than shipped.

---

## Phase E — Draft · preview · publish · 4 days  ✅

Draft columns on `SiteCopy`, `SiteImage`, `PageSection` · resolvers take
`draft` · `publishPage` transaction · publish checklist (blockers vs warnings)
· `ContentRevision` + restore-to-draft · draft ribbon and Alt+click-to-edit on
the preview.

`/api/draft` already exists and is ISR-safe — do not replace it, and do not
reintroduce a `?preview=` searchParam.

**Done when:** an EDITOR stages six changes across the About page, previews
them, an ADMIN reviews the diff, publishes atomically, and a bad publish is
restored from history into draft.

---

## Phase F — Structure layer · 7 days  ✅

The big one. Sequence it page by page so that at every commit the site renders.

| Day | Work |
|--:|---|
| 1 | `PageSection` migration, `src/lib/page-sections.ts` registry, `getPageSections`, `PageSectionSlot` renderer, orphan check script |
| 2 | Homepage: extract ~20 sections into components, declare, render from manifest |
| 3 | About + Process |
| 4 | Workshops + Custom Order + Contact |
| 5–6 | `/studio/pages/[key]` — the single page editor joining copy, images and structure; drag-reorder; visibility; switches |
| 7 | Band-rhythm and h1 guardrails, notes field, polish |

**The coupling to fix on day 1 of this phase:** `CureMark` ids and their `dark`
flags are hand-maintained against the `<section id>` values (`page.tsx:214`,
`cure-line.tsx:41`). Reordering or hiding a section desynchronises the site's
signature device from the page. Generate `cureMarks` from the same resolved
section list the renderer walks — one source of truth (§10.7).

**Done when:** the owner hides the Occasions band on the homepage, moves the
Journal rail above Testimonials, and the editor refuses to enable a fourth dark
band — naming the three already on.

**Risk control:** each page's extraction is a pure cut-and-paste with no
behaviour change. Screenshot before and after at 360px and 1280px, and run
`redesign-audit.mjs` + `a11y-audit.mjs` on that route before moving to the
next.

---

## Phase G — Custom landing pages · 2.5 days  ✅

`CustomPage`/`CustomBlock`, six block types, `/p/[slug]` route, scheduling cron
(`vercel.json`), sitemap inclusion, `noindex` toggle.

**Done when:** a Diwali lander is built in the studio in 20 minutes and
scheduled to go live at 6am.

---

## Phase H — Media depth · 3 days  ✅

`finalizeAsset` ingest (dimensions, LQIP, checksum dedupe, dominant colour) ·
SEO filenames on upload · "Missing alt" and "Unused" filters · usage-count
delete guard · favicon and app-icon as brand settings.

**No JSON-LD work here.** The spec lists structured data as unbuilt; it is
built — `FAQPage`, `Product`, `AggregateOffer`, `Organization`,
`LocalBusiness`, `Article`, `VisualArtwork`, `CollectionPage`, `WebSite` and
four `BreadcrumbList`s all ship today, and `FAQPage` already reads the live
studio-managed rows. The only additions are `openingHours` on `LocalBusiness`
once Phase C lands, and `Event` per workshop if workshops become an entity.

---

## Phase I — Close the content gaps · 2 days  ✅

Not in the original plan. It exists because the plan finished and three
bullets were still sitting in CLAUDE.md's "Known gaps (data, not design)" —
each one content the owner could not reach, and each one a missing column
rather than a missing screen. All three are additive and nullable, so the
whole phase rolls back as three column DROPs (`20260824110000`).

`BlogCategory.translations` · `Tag.translations` — the two models the I3
translations pass missed. Their names rendered English in all nine locales
and there was nowhere to type anything else; `blog/page.tsx` carried a
comment saying so. Slugs stay untranslated: they are the URLs the filters
are linked by. Tags were never on the list but have the identical defect,
render beside the category on every post, and share one list component —
so fixing both was less code than fixing one.

`PortfolioImage.caption` (+ translations) — a frame could show a plate number
and, as a stand-in, its own alt text. Alt and caption are different jobs, so
the column is additive and the alt fallback is KEPT: galleries captioned that
way read exactly as before. The gallery is written replace-all, so per-frame
translations travel through the form values or every save would drop them.

`Media.provenance` — recorded at the two places a row is created, and each
records only what it knows. An upload is UPLOAD, because nothing in the bytes
says a model drew it. The bundled import splits on the path, since the path is
what `docs/media-v3-manifest.json` is keyed on. The owner declares the rest in
bulk. Rows older than the column stay null: unknown, shown as no claim rather
than a wrong one.

**Deliberately not in this phase.** The remaining known gaps are not columns:
`beforeImageUrl` exists and wants data, `Inquiry` priority and cure tracking
want a schema §1.1 protects, and the rate-limit countdown wants an auth change.
`Event` structured data per workshop wants a `startDate` no workshop row has —
workshops are `Product` rows in the workshops category, and inventing a date to
satisfy a rich result would be inventing content.

---

## Phase J — The last English strings, and the login that lied · 1 day  ✅

Both `/* i18n-debt */` markers plus the rate-limit gap. What made this small
is Phase I: the search overlay's marker said "BlogCategory carries no
translations column", which Phase I had just added — so closing it was one
call to `localizeName`, and leaving it would have meant the blog page and the
search overlay disagreeing about the same category.

The PDP's lexical rows were the real work. They are an ARRAY of label/value
pairs, and the translations pipeline understood strings and Tiptap documents
only — an array was silently dropped by `normalizeTranslations`, the same
failure mode `caption` hit in Phase I. They now resolve **per row and per
field**: translate two rows of five, or a value but not its label, and the
rest stands in English underneath. Swapping the array wholesale would have
made a partial translation delete the rows it did not cover.

The lockout countdown was wired WITHOUT touching `authorize()`. It still
returns a bare `null` for a throttled attempt exactly as it does for a wrong
password — that is what stops a lockout becoming an account-existence oracle
(SEC-110). The login Server Action peeks at the same counters afterwards,
which tells the staffer at the keyboard what the counters already know and an
attacker nothing a failed login did not.

---

## What is deliberately *not* in this plan

| Spec item | Verdict |
|---|---|
| Rewriting 40 components as props-driven section types | Unnecessary — copy and images are already addressed by key. See `04`, §4.1 |
| A parallel `MediaAsset` table beside `Media` | Extend `Media`. Two asset tables is the two-datastore mistake the spec itself rejects for Sanity |
| Five roles | Two is right for this team. See `06`, §6.6 |
| Full in-studio image editor (crop/rotate/adjust) | Focal point + mobile crop covers the real need. Revisit after a month of use |
| Swappable `pour-cure` sequence | 121 frames are one animation. Only if the owner actually asks |
| Repeaters ("add a fifth material") | Fixed arity is the design. See `04`, §4.7 |
| `revalidatePath('/', 'layout')` | Never. Tag-scoped only — the repo already follows this |

---

## The gate every phase passes

CI on every PR to `Main` (`.github/workflows/ci.yml`) runs:

```
npm run typecheck    ·  npm run lint    ·  npm run test
npm run build        ← the REAL build: prisma migrate deploy + bootstrap
                       against a throwaway Postgres, exactly as Vercel does
```

That build job is why migrations are safe here: **a migration that would break
the deploy fails in CI first.**

The same job now also starts the build it just produced and sweeps twelve
public routes with `redesign-audit.mjs` and `a11y-audit.mjs` at 1440px and
390px, so the band rhythm, the single `h1`, mono numerals, alt text, horizontal
overflow and axe's critical/serious findings are all gated rather than
remembered. What still has to be done **by hand**, for every content phase:

```
360px and 1280px screenshots           reduced-motion checked
keyboard reachable                     node scripts/i18n-missing.mjs
BASE_URL=… npm run test:e2e            Place Order → Inquiry saved → wa.me opens
the audits on routes CI cannot reach — /product, /blog, /portfolio, /p
```

The order-flow line is not a formality. Every phase in this plan touches
something within two steps of it, and the order flow is the business.

---

## Migration safety on a live Neon database

Every schema change in this plan is **additive**: new tables (`SiteCopy`,
`PageSection`, `FormOption`, `NavMenu`, `NavItem`, `ContentRevision`,
`CustomPage`, `CustomBlock`) and new nullable columns with defaults on
`SiteImage` and `SiteSettings`. No column is dropped, no type narrowed, no
existing row rewritten.

That is not an accident of sequencing — it is the constraint the whole design
was drawn against. It means:

- Every migration runs while the old code is still serving traffic.
- A deploy that fails can be rolled back to the previous build without a
  down-migration, because the previous build simply ignores the new tables.
- No content backfill is required at any point. An empty `SiteCopy` renders
  today's site byte-for-byte; an empty `PageSection` falls back to the
  registry's declared order.

The one place to be careful is Phase F, where `getPageSections` must return the
registry default when the table has no rows for a page — otherwise a page with
an un-seeded manifest renders nothing. Write that fallback first and test it
with an empty table before writing the studio screen.
