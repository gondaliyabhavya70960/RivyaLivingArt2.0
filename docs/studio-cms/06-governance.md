# 06 — Governance: Draft, Publish, Preview, Roles, Audit

Editable content without governance is a live site anyone can break at 11pm.
This layer is small, because most of the machinery already exists in the repo —
it just has not been pointed at content yet.

---

## 6.1 What already exists

| Capability | Where | State |
|---|---|---|
| **Draft mode, ISR-safe** | `src/app/api/draft/route.ts` | ✅ Complete. Mints Next's draft cookie for a verified staff session; pages read `draftMode().isEnabled`. Open-redirect guarded. |
| **Role guard, DB-revalidated per call** | `requireStaff()` / `requireStaffPage()`, `src/actions/helpers.ts:22` | ✅ Re-checks role and `tokenVersion` on every action — a demoted or deleted user is rejected immediately, not when their JWT expires |
| **Audit trail** | `logActivity()`, `src/lib/activity.ts` | ✅ Fire-and-forget, never breaks the mutation it describes. Surfaced at `/studio/activity` |
| **Action result contract** | `ActionResult<T>`, `src/actions/helpers.ts:8` | ✅ `{ ok: true; data? } \| { ok: false; error }` |
| **Tag-scoped revalidation** | `SITE_IMAGES_TAG`, `SITE_SETTINGS_TAG`, `CATALOG_NAV_TAG`, `SHOP_FIRST_PAGE_TAG` | 🟡 The vocabulary exists and is used — but see `10`, §10.4: `src/actions/settings.ts:170` does call `revalidatePath("/", "layout")`, and path-based revalidation misses eight locales |
| **Publish states for entities** | `ContentStatus { DRAFT, PUBLISHED }` on Product, Portfolio, BlogPost | ✅ |

The draft-mode note in that route is worth reading before designing anything
here: a previous `?preview=1` searchParam forced *every* visitor into dynamic
rendering and silently killed ISR. Preview must ride the cookie.

---

## 6.2 Draft and publish for the content layers

Entities have `status`. Copy, images and structure do not — and they need one
mechanism, not three.

### The model: one staged value per row

```prisma
model SiteCopy {
  key         String
  locale      String
  value       String   @db.Text     // LIVE
  draftValue  String?  @db.Text     // STAGED — null means "no pending change"
  // …
}

model SiteImage {
  key         String   @id
  url         String                // LIVE
  draftUrl    String?               // STAGED
  // …
}

model PageSection {
  // …
  order       Int
  enabled     Boolean
  options     Json
  draftOrder  Int?
  draftEnabled Boolean?
  draftOptions Json?
}
```

Reads resolve `draft ? (draftX ?? x) : x`. The resolvers already funnel through
three functions — `getSiteCopy`, `getSiteImages`, `getPageSections` — so each
takes a `draft: boolean` and the storefront passes `draftMode().isEnabled`.
Nothing else in the render path changes.

### Publish is per page, atomic

One button, one transaction, one revalidation:

```ts
export async function publishPage(pageKey: string): Promise<ActionResult> {
  const session = await requireStaff(["ADMIN", "EDITOR"]);

  const issues = await runPublishChecklist(pageKey);        // §6.4
  if (issues.blocking.length) {
    return { ok: false, error: describeBlockers(issues.blocking) };
  }

  await db.$transaction(async (tx) => {
    // snapshot every row about to change, then promote draft → live
    await snapshotRevision(tx, pageKey, session.user.id);
    await promoteCopy(tx, pageKey);
    await promoteImages(tx, pageKey);
    await promoteSections(tx, pageKey);
  });

  await logActivity({
    userId: session.user.id, action: "publish", entity: "Page", entityId: pageKey,
    meta: { copy: issues.counts.copy, images: issues.counts.images },
  });

  revalidateTag(SITE_COPY_TAG, "max");
  revalidateTag(SITE_IMAGES_TAG, "max");
  revalidateTag(PAGE_SECTIONS_TAG, "max");
  return { ok: true };
}
```

Page scope comes from the registries: `PAGE_SECTIONS[pageKey]` names the
sections, which name their `copyKeys` and `imageKeys`. The join built in `04`
pays for itself again here.

> **Ship order matters.** Add `draftValue` in the *same* migration that adds
> `value`, or accept a second migration later. The recommendation in `02` is to
> ship without drafts first and add the column with this phase — an unreviewed
> copy edit going straight live is survivable for a few weeks; a half-built
> draft mechanism is not.

---

## 6.3 Preview

The route already exists. What is missing is the loop back:

1. **Preview button** in the page editor → `/api/draft?redirect=/about`.
2. **A draft ribbon** on the storefront when `draftMode().isEnabled`, with an
   "Exit preview" link — otherwise staff will forget they are in draft and
   report phantom bugs.
3. **Alt-click to edit** (the spec's §6.5). Sections already carry
   `data-cms-section` from the renderer in `04`; in draft mode mount a small
   client component that outlines a section on hover and, on Alt+click,
   `postMessage`s its key to the studio tab. Alt+click rather than a floating
   button, so the preview still behaves like the real site.

Keep the overlay behind `draftMode().isEnabled` so it never ships to a visitor,
and remember the repo lints for `react-hooks/set-state-in-effect` — the overlay
writes to the DOM directly, it does not hold state.

---

## 6.4 The publish checklist

The gate that keeps editable content from degrading the site. Split into
blockers and warnings, because a system that blocks on everything gets
bypassed.

**Blocks publish**

| Check | Why |
|---|---|
| An image slot with an `altKey` resolving to empty | `a11y-audit.mjs` fails on it; screen readers get nothing |
| An override that drops an ICU placeholder present in the default | Renders a broken count, or throws |
| An override that drops a `<tag>` used by `t.rich` | Throws at render |
| A nav item pointing at a route not in the manifest | A 404 the owner shipped |
| A section reference to a deleted or archived entity | Renders an empty rail |
| More than three `dark` sections enabled on one page | Breaks REDESIGN.md Part 3, caught later by CI on an unrelated PR |
| Two `dark` sections adjacent | Same |
| SEO title > 60 or description > 160 characters | Truncation in results |

**Warns, does not block**

| Check | Why only a warning |
|---|---|
| Copy over its `max` budget | The budget is design guidance; some languages need more room |
| Image narrower than the slot's `minWidth` | Sometimes the only shot that exists |
| No mobile crop on a 16:9 or 21:9 slot | Not yet true of any existing slot |
| Locale coverage below 100% | Otherwise nothing ever publishes |
| A section disabled but linked from the nav | Might be intentional during a swap |

Render blockers with the field, the section and a sentence the owner can act
on — **"The About page's second material has no alt text. Add one so screen
readers can describe it."** — never a validation code.

---

## 6.5 Revisions

One table, one restore path:

```prisma
model ContentRevision {
  id        String   @id @default(cuid())
  pageKey   String
  /// Everything that changed in one publish: copy, images, section manifest.
  payload   Json
  summary   String?          // "headline, hero image, hid Occasions"
  authorId  String?
  createdAt DateTime @default(now())

  @@index([pageKey, createdAt])
}
```

Written on publish, before promotion, so a revision always describes the state
being replaced. **Restore writes to the draft columns, never straight to live**
— the owner then reviews and publishes, which means a mis-clicked restore is
recoverable by discarding the draft.

The `summary` is what makes the history usable. Generate it by diffing the
promoted rows against the snapshot and naming the fields with their registry
labels: *"Hero headline, Hero image, hid Occasions"* — not a JSON diff.

---

## 6.6 Roles — keep two

The spec proposes five (`OWNER / ADMIN / EDITOR / MEDIA / VIEWER`). This repo
has two (`ADMIN`, `EDITOR`) and, for a studio of this size, two is the right
number. Five roles for a two-person team is a permission matrix nobody
maintains and a support burden the first time someone cannot do their job.

Map the new surfaces onto the existing pair:

| | ADMIN | EDITOR |
|---|:-:|:-:|
| Site Copy — edit and publish | ✅ | ✅ |
| Site Copy — reset a whole page / site-wide | ✅ | — |
| Site Images — replace, upload, reset a slot | ✅ | ✅ |
| Site Images — import bundled defaults | ✅ | — (already ADMIN-only) |
| Page sections — reorder, hide, switches | ✅ | ✅ |
| Custom pages — create, publish, schedule | ✅ | ✅ |
| Nav menus, footer | ✅ | — |
| Form options (materials, budgets, timelines) | ✅ | — |
| Site Settings, SEO defaults | ✅ | — (already ADMIN-only) |
| Restore a revision | ✅ | — |
| Users | ✅ | — |

Add a third role only when a real person needs it — a photographer who should
upload but not publish copy. Adding `MEDIA` later is one enum value and a
handful of guard arrays; inventing it now is five screens of speculative
permissions.

---

## 6.7 Security

Nothing here is new; it is the existing posture extended to new actions.

- **Every `"use server"` action calls `requireStaff` first.** A hidden button
  is not access control. The DB re-validation in `requireStaff` is the reason
  this holds even for a stale session.
- **Zod parses every input**, and the registries are the allowlist:
  `isCopyKey`, `isSiteImageKey`, `PAGE_SECTIONS_BY_KEY`. An unknown key is
  rejected, not stored.
- **Copy renders as text.** No `dangerouslySetInnerHTML` on override values.
  The one rich surface — legal pages — already goes through Tiptap and
  `renderTiptapToHtml`; keep sanitisation server-side there.
- **Image URLs stay inside `remotePatterns`.** `src/actions/site-images.ts:44`
  already refuses a pasted third-party URL with an explanation; every new
  image field reuses that schema.
- **Rate-limit the copy action.** It is the one an automated client could hammer
  1,149 times; `src/lib/rate-limit.ts` already exists.
- **`logActivity` on every publish, reset, bulk operation and settings change.**
  The activity screen is the first thing anyone opens after "the site looks
  wrong".

---

## 6.8 Performance

Four rules, each with a reason specific to this repo:

1. **One cached read per registry per request, always at a 24h TTL.**
   `getSiteCopy`, `getSiteImages` and `getPageSections` are each
   `cache()`-wrapped around an `unstable_cache` read with `revalidate: 86400`
   and a tag. Route ISR is `min(segment, every cached read it performs)`, so a
   300s TTL on a read this widely shared would silently drop
   `/product/[slug]` from 86400s across **4,373 products × 9 locales**. The
   repo has already been burned by exactly this — `catalog-nav.ts:97`
   documents the incident. Freshness comes from `revalidateTag(TAG, "max")` in
   the save action, never from a short TTL.
2. **The overlay allocates nothing when empty.** `applyCopyOverrides` returns
   the base catalogue by reference when there are no overrides (`02`, §2.5).
3. **Never query Prisma inside a section component.** Sections receive a
   context object assembled once at the top of the page.
4. **`priority` stays a slot property.** One LCP image per page; the owner
   cannot add a second.
