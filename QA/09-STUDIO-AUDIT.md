# Studio audit

Guard primitives **and** call sites verified by reading the source. Nothing was
executed.

> An earlier revision of this document reported the call sites as unaudited.
> They have since been swept; this is the corrected result.

## The primitives

`src/actions/helpers.ts`:

- `requireStaff(roles = ["ADMIN","EDITOR"])` — re-reads `role` + `tokenVersion`
  from the database on **every** call, so deletion, demotion and password reset
  revoke access immediately rather than at JWT expiry. One indexed PK lookup.
- `requireStaffPage(roles)` — same, but redirects. An EDITOR on an ADMIN page
  goes to the dashboard, not the login screen; they *are* signed in, and
  middleware would bounce login straight back.
- `runAction` — collapses throws to generic copy; `Unauthorized` becomes "You
  are not allowed to do that." No raw error reaches the client.

`src/proxy.ts` fails closed, and `/studio/*` carries `X-Frame-Options: DENY`
plus `X-Robots-Tag: noindex, nofollow`.

## Call-site sweep — result

**Every exported server action in every studio action file calls a guard, and
calls it as the first statement of the function body.** No exported action was
found with a missing guard, and none was found guarding only some paths.

Across `src/actions/`, guard invocations outnumber exported functions in all 27
studio files. The four files with **no** guard are the deliberately public ones:
`order.ts`, `public.ts`, `search.ts`, `shop.ts` — `public.ts` carries the
comment "Public (unauthenticated) server actions. No requireStaff here."

### Role escalation is applied where it matters

| Action | Guard |
|---|---|
| All of `users.ts` — create, role change, password reset, delete | `requireStaff([Role.ADMIN])` |
| `updateSiteSettings` | `requireStaff([Role.ADMIN])` |
| `restoreRevision` | `requireStaff(["ADMIN"])` |
| `deleteInquiries` | `requireStaff([Role.ADMIN])` |
| `deleteScrapeJobs` | `requireStaff([Role.ADMIN])` |
| `publishSurface`, `discardSurfaceDraft` | `requireStaff(["ADMIN","EDITOR"])` |
| Content CRUD (products, blog, categories, media, portfolio, …) | `requireStaff()` — EDITOR allowed by design |

The split is coherent: an EDITOR is trusted with **content**, and not with
accounts, site settings, customer records, or revision history. Content deletes
being EDITOR-reachable is a deliberate product decision, not an oversight — an
editor who can publish can already change what visitors see.

### `src/actions/users.ts` — the file most likely to carry a P0

It does not. All four exports are ADMIN-only, and the lockout and
stale-privilege cases are both handled:

- **Last-admin demotion refused** — `updateUserRole` counts remaining admins
  before demoting one.
- **Last-admin deletion refused** — `deleteUsers` counts both the admins in the
  target set and the admins that exist.
- **`tokenVersion` bumped on role change**, so a demoted user's live session
  picks up the new role on its next action instead of running on the stale
  token (SEC-106). Without this, demotion would not take effect until the JWT
  expired.
- **`tokenVersion` bumped on password reset**, so resetting a password
  invalidates that user's existing sessions.
- A no-op role change short-circuits before writing.
- Every mutation writes an activity log entry.

This is the correct shape for the whole class of bug.

## Still not verified

The sweep confirms a guard is present and of the right strength. It does **not**
confirm:

- **Input validation depth** per action (zod schemas were not read individually).
- **Ownership checks** where an action takes ids — a guard proves the caller is
  staff, not that the ids are theirs to touch. Lower risk here, since staff are
  trusted across the whole catalog by design.
- **Runtime behaviour.** Nothing was executed. The recommended confirmation is
  still direct invocation with an EDITOR session against the ADMIN-only actions
  above — testing the call, not whether the button is hidden.

## Guardrails worth preserving

`describeArrangementProblem` / `describeBlockArrangementProblem` **refuse** at
save time rather than warning — enforcing the band rhythm and single-`h1` rule,
because CI does not run when an owner presses Publish. They also run in the
board before the call, since `runAction` reports every throw as "something went
wrong". Keep both call sites; removing the client-side one degrades the message,
not the enforcement.

## CI coverage

`studio-audit.mjs` signs in and sweeps 30 staff routes with axe plus structural
checks at 1440px **and 390px** — the Studio gets used on a phone in the
workshop, and eight screens once scrolled sideways.
