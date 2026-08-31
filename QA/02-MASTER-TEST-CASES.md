# Master test cases

`PASS` here means **verified by reading the implementation**, not by executing
it. No test in this document was run. Cases needing execution are `BLOCKED`.

---

## Authorization

### TC-AUTH-001 — Draft product cannot be ordered anonymously
**Priority:** P0 · **Status:** FAIL -> FIXED (unverified by execution)

**Steps:** Obtain a DRAFT product's cuid. Invoke `submitProductOrder` directly
with valid customer fields, a valid form token and that id, with no session and
no draft cookie.

**Expected:** rejected.
**Actual (before):** accepted — an `Inquiry` was created and the response
carried a WhatsApp message containing the unpublished product's title.
**Root cause:** the action never read `product.status`. Visibility was enforced
only at page render.
**Fix:** `canOrderProduct()` gate on `(await draftMode()).isEnabled`.
**Regression:** `src/lib/order-visibility.test.ts`.

### TC-AUTH-002 — Published product order still succeeds
**Priority:** P0 · **Status:** PASS (source) / BLOCKED (end-to-end)

The new gate returns `true` for `status === "PUBLISHED"` regardless of preview,
so the path is unchanged. **The full order flow was not executed.**

### TC-AUTH-003 — Out-of-stock published product still records an enquiry
**Priority:** P1 · **Status:** PASS (source)

The gate is deliberately status-only. `inStock` continues to select the
enquiry-framed intro (audit H2) further down, untouched. Asserted by
"does not conflate availability with orderability".

### TC-AUTH-004 — Staff draft preview can still place a preview order
**Priority:** P1 · **Status:** PASS (source) / BLOCKED (end-to-end)

`previewEnabled` short-circuits the gate. The cookie is mintable only via
`/api/draft` behind `requireStaff()`.

### TC-AUTH-005 — Draft cookie cannot be minted without a staff session
**Priority:** P0 · **Status:** PASS (source)

`/api/draft` calls `requireStaff()` inside a try/catch and redirects to the
login screen on failure — `draft.enable()` is unreachable otherwise. Disabling
needs no auth, which is correct: clearing a bypass cookie is harmless.

### TC-AUTH-006 — `/studio` unreachable while signed out
**Priority:** P0 · **Status:** PASS (source)

`proxy.ts` gates on `Boolean(req.auth?.user)`, not on `req.auth` being truthy —
failing **closed** when Auth.js errors inside middleware. The comment records
that the truthy-check version both waved anonymous requests through and locked
the admin out in a redirect loop.

### TC-AUTH-007 — Revoked session loses access immediately
**Priority:** P0 · **Status:** PASS (source)

`requireStaff` re-reads `role` + `tokenVersion` per call. Deleted, demoted, or
password-reset users fail at once rather than at JWT expiry.

### TC-AUTH-008 — Staff signup is a one-time bootstrap
**Priority:** P0 · **Status:** PASS (source)

Gated three ways: the page checks `db.user.count()`, the action re-checks it,
and it re-checks again **inside the transaction**, with Prisma `P2034`
(serialization failure) handled as "another signup won the race".

### TC-AUTH-009 — Cron routes reject unauthenticated callers
**Priority:** P1 · **Status:** PASS (source)

`authorized` starts as `Boolean(cronSecret) && timingSafeEqual(...)`. An unset
`CRON_SECRET` yields `false` and falls through to `requireStaff()` — it does not
disable the check. Comparison is timing-safe with a length pre-check.

### TC-AUTH-010 — PII export routes are staff-gated
**Priority:** P0 · **Status:** PASS (source, header-level) / BLOCKED (execution)

`/api/subscribers/export` and `/api/scraper/export` require staff. **Not
executed.**

---

## Injection

### TC-XSS-001 — Rich text cannot inject script
**Priority:** P1 · **Status:** PASS (source)

Tiptap renders through a fixed extension set (StarterKit + Link + Image), so
`<script>` and `on*=` handlers cannot be emitted. `sanitizeGeneratedHtml`
rewrites any `href` whose scheme is not http(s)/mailto/tel to `#`, stripping
whitespace and control characters first so `"java\tscript:"` does not slip past.

### TC-XSS-002 — JSON-LD cannot be closed by authored content
**Priority:** P1 · **Status:** PASS (source)

`JsonLd` emits every `<` as `<`, so a product title containing `</script>`
cannot break out.

### TC-XSS-003 — SVG cannot become stored XSS
**Priority:** P1 · **Status:** PASS (source)

SVG is excluded from `ACCEPTED_UPLOAD_TYPES`. Legacy SVGs already on disk are
served with `Content-Disposition: attachment` **and**
`Content-Security-Policy: default-src 'none'; sandbox`, plus `nosniff`.

### TC-SSRF-001 — Scraper cannot reach internal addresses
**Priority:** P0 · **Status:** PASS (source, partial)

`safeFetch` resolves the host and rejects loopback, private v4, link-local
(including `169.254.169.254`), and IPv4-mapped IPv6 in both dotted and
hex-group renderings. Redirects use `redirect: "manual"` with **per-hop**
revalidation — the vector that defeats a pre-flight-only check. The module
documents its own residual DNS-rebinding exposure.

**Partial:** the guard was read; individual adapters were not. Not executed.

### TC-SSRF-002 — Sheet import cannot be pointed at an internal host
**Priority:** P1 · **Status:** PASS (source)

`fetchGoogleSheetCsv` extracts the document id by regex and **rebuilds** the URL
against `docs.google.com`. The caller's URL is never fetched as given.

---

## Uploads

### TC-UP-001 — Upload rejects non-allowed types
**Priority:** P2 · **Status:** PASS (source, with caveat — see RR-003)

Allow-list is `image/jpeg|png|webp`, extension taken from the map rather than
the filename. Caveat: `file.type` is client-supplied and no magic-byte sniff is
performed.

### TC-UP-002 — Uploads cannot overwrite each other
**Priority:** P2 · **Status:** PASS (source)

Both drivers add uniqueness: Blob via `addRandomSuffix: true`, local via an
8-char `randomUUID` slice. Investigated as a suspected collision bug and
refuted.

### TC-UP-003 — Storage pathname cannot traverse
**Priority:** P1 · **Status:** PASS (source)

`sanitizePathname` strips leading slashes, normalises backslashes, and **throws**
on any empty/`.`/`..` segment.

### TC-UP-004 — Media serving route cannot traverse
**Priority:** P3 · **Status:** PARTIAL — see RR-002

Exact-match segment rejection rather than resolved-prefix containment.
Dev-only route.

---

## Public forms

### TC-FORM-001 — Spam gate
**Priority:** P2 · **Status:** PASS (source)

Honeypot plus a **server-signed** mount timestamp, so the minimum fill time
cannot be forged client-side.

### TC-FORM-002 — Reference image URLs are host-restricted
**Priority:** P1 · **Status:** PASS (source)

`referenceUrlSchema` accepts only `/uploads/…` or an https URL on
`*.public.blob.vercel-storage.com` — so an attacker cannot persist an arbitrary
URL that staff would later click from the inbox.

### TC-FORM-003 — Order rate limiting
**Priority:** P2 · **Status:** PASS (source) / BLOCKED (execution)

6 per 10 minutes per IP. In-memory, per-instance — accepted per spec. **The
threshold was not exercised.**

---

## BLOCKED — require execution

| ID | Case | Needs |
|---|---|---|
| TC-BLK-001 | `npm run typecheck` | Command execution |
| TC-BLK-002 | `npm run lint` | Command execution |
| TC-BLK-003 | `npm test` | Command execution |
| TC-BLK-004 | `npm run build` | Execution + `DATABASE_URL` |
| TC-BLK-005 | `npm run test:e2e` | Running server + catalog |
| TC-BLK-006 | `redesign-audit.mjs` / `a11y-audit.mjs` | Server + Chromium |
| TC-BLK-007 | Cache revalidation after publish | Server + database |
| TC-BLK-008 | Responsive sweep 320-1440px | Browser |
| TC-BLK-009 | Data-quality counts | Database |
| TC-BLK-010 | Production smoke test | Network |
