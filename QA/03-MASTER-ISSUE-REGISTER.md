# Master issue register

---

## RR-001 — Public order action accepted unpublished products

| | |
|---|---|
| **Severity** | P1 |
| **Area** | Public server actions / authorization |
| **File** | `src/actions/order.ts` — `submitProductOrder` |
| **Status** | **FIXED** in this branch (PR #138) — CI-verified only |

**Description.** The action loaded a product by the client-supplied
`productId` and never inspected `status`. A comment declared DRAFT "allowed on
purpose" for staff preview orders — correct intent, but nothing enforced
"staff". The public product page does gate it:

```ts
if (product.status !== "PUBLISHED" && !preview) notFound();
```

…and that page-level check was doing all the work. A Server Action is a POST
endpoint reachable without ever loading the page.

**Reproduction.** Obtain a DRAFT product's cuid. Call `submitProductOrder` with
valid customer fields, a valid form token, and that id — no session, no draft
cookie. Before the fix: an `Inquiry` row is created and the response contains a
WhatsApp message carrying the unpublished product's title.

**Impact.** Unreleased product names leak to anyone who can obtain or guess an
id; the inquiry inbox accepts orders for pieces that are not for sale. Not
authentication bypass, no data loss — hence P1, not P0.

**Fix.** Gate the DRAFT allowance on `(await draftMode()).isEnabled`. That
cookie is minted only by `/api/draft`, behind `requireStaff()`, so "preview is
on" means "a verified staff session turned it on". The rejection reuses the
**generic** error a missing product returns, so the action cannot be used to
probe which ids exist.

**Files changed.** `src/actions/order.ts`, `src/lib/order-visibility.ts` (new),
`src/lib/order-visibility.test.ts` (new).

**Regression.** 6 assertions covering the full matrix plus a fail-closed case:
any status that is not exactly `PUBLISHED` is refused, so a future
`ContentStatus` member is not orderable by default.

**Verification.** Not executed locally. CI on #138 is the first run.

---

## RR-002 — Media serving route uses exact-segment traversal rejection

| | |
|---|---|
| **Severity** | P3 (hardening) |
| **File** | `src/app/uploads/[...path]/route.ts` |
| **Status** | OPEN |

```ts
if (segments.some((s) => s === ".." || s === "." || s.includes("\\"))) {
  return new NextResponse("Not found", { status: 404 });
}
const filePath = path.join(ROOT, ...segments);
```

The check is exact equality per segment. It holds for every decoding this route
is expected to see, and Next splits catch-all segments on `/`. But it is a
*denylist on segment values* rather than a *containment assertion on the result*
— so it depends on the framework's decoding behaviour staying as it is. A
segment that arrived carrying an embedded `../` would pass and then escape
`ROOT` in `path.join`.

**Why P3.** This is a dev-only fallback: the header states production media
lives on Vercel Blob and this route never matches. `sanitizePathname` in
`storage.ts` — the *write* path — already does it correctly by throwing.

**Fix.**

```ts
const filePath = path.resolve(ROOT, ...segments);
if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
  return new NextResponse("Not found", { status: 404 });
}
```

Containment on the resolved path cannot be defeated by a decoding change.

---

## RR-003 — Upload MIME validation trusts the client-declared type

| | |
|---|---|
| **Severity** | P3 (hardening) |
| **File** | `src/app/api/upload/route.ts` |
| **Status** | OPEN |

`ALLOWED_TYPES[file.type]` reads the browser-supplied `Content-Type`. No
magic-byte inspection. A non-image can therefore be stored with an image
extension and content type.

**Why only P3.** The consequences are contained: the extension comes from the
server's map (never the filename), `nosniff` is set on serving, SVG is excluded
entirely, and `sharp` is already a dependency. So this is storage pollution,
not code execution.

**Fix.** Sniff the first bytes before `putFile` — JPEG `FF D8 FF`, PNG
`89 50 4E 47`, WebP `RIFF….WEBP` — or round-trip through `sharp.metadata()` and
reject on throw.

---

## RR-004 — `clientIp` trusts the first `X-Forwarded-For` hop

| | |
|---|---|
| **Severity** | P3 (informational) |
| **File** | `src/lib/rate-limit.ts` |
| **Status** | OPEN — correct on Vercel |

```ts
return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
```

Correct **on Vercel**, which overwrites the header at the edge. Off-platform —
self-hosted, or behind a proxy that appends rather than replaces — a client can
send its own `X-Forwarded-For` and get a fresh rate-limit bucket per request,
defeating every per-IP limit including login.

**Fix.** No code change needed while deployment is Vercel-only. Record the
dependency at the function, so a future migration does not silently disable
rate limiting. If portability is wanted, read a trusted-proxy count from env and
index from the right-hand side.

---

## RR-005 — CSP is Report-Only with a permissive `img-src`

| | |
|---|---|
| **Severity** | P2 |
| **File** | `next.config.ts` |
| **Status** | ACCEPTED — remediation in progress |

`Content-Security-Policy-Report-Only` with `img-src 'self' data: blob: https:`
and `script-src … 'unsafe-inline'`.

Both are documented and both have a stated reason. `img-src https:` exists
because the imported four-tier catalog carries imagery on source-store hosts
that cannot be enumerated ahead of the full sheet export. `'unsafe-inline'`
covers Next's hydration and the JSON-LD blocks.

**This is not neglect — it is sequenced work.** `src/lib/catalog-mirror.ts`
plus the daily cron exist precisely to remove the reason `img-src https:` is
needed. The ordering is right: enforcing first would break the storefront.

**Path to enforcement** (do not skip a step):

1. Drive external catalog images to zero — see `08-IMAGE-MIGRATION-AUDIT.md`.
2. Narrow `img-src` to `'self' data: blob:` plus the three owned hosts.
3. Collect `/api/csp-report` for a full traffic cycle; enumerate what fires.
4. Replace `'unsafe-inline'` in `script-src` with a per-request nonce.
5. Rename the header key to `Content-Security-Policy`.
6. Re-run the Studio audit — the Studio is the surface most likely to break.

**Also worth checking:** `/api/csp-report` is unauthenticated by necessity.
Confirm it is rate-limited, or it is an anonymous log-flooding vector. **Not
verified in this pass.**

---

# Investigated and refuted

Recorded so a later audit does not spend an afternoon re-deriving these.

| # | Hypothesis | Why it is not a bug |
|---|---|---|
| 1 | Uploads collide and overwrite | `putFile` adds a random suffix on **both** drivers |
| 2 | Open staff self-signup | One-time bootstrap; re-checked inside the transaction, `P2034` handled |
| 3 | Cron routes open when `CRON_SECRET` unset | Fails **closed** — falls through to `requireStaff()`, then 401 |
| 4 | JSON-LD injection via product titles | `JsonLd` escapes every `<` as `<` |
| 5 | Stored XSS via Studio rich text | Fixed extension set + href scheme sanitiser |
| 6 | SSRF via scraper redirects | `redirect: "manual"` with per-hop revalidation |
| 7 | Sheet import URL is attacker-controlled | Document id extracted by regex; URL rebuilt against `docs.google.com` |
| 8 | Session survives revocation until JWT expiry | `requireStaff` re-reads role + `tokenVersion` per call |
| 9 | SVG served inline as stored XSS | Excluded from uploads; legacy served as attachment under a `default-src 'none'; sandbox` CSP |

# Not a code bug

Per brief §44. `CLAUDE.md` "Known gaps" documents places where the schema
cannot express what the spec asks (no `beforeImageUrl` data, no `Inquiry`
priority column, no commission floor prices). Each renders nothing rather than
inventing content. **Owner content debt, not defects.** No content was invented
for them.
