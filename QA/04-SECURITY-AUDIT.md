# Security audit

Static review. Nothing was executed; no penetration testing was performed.

## Verdict

**Well-hardened.** One real authorization gap (`RR-001`, fixed), three
hardening notes, one accepted trade-off with remediation already built. Nine
plausible vulnerability classes were traced through the source and did not
exist.

The `SEC-…` / `ENG-…` markers throughout show prior audits landed with their
reasoning attached. That is why several checks here read as "already correct":
someone got there first and left the comment explaining why.

## Controls verified in source

### Authentication and session

- `proxy.ts` fails **closed**: gates on `req.auth?.user`, not on `req.auth`
  being truthy. The comment records that the naive version simultaneously waved
  anonymous requests through *and* locked the admin out.
- `requireStaff` re-reads `role` + `tokenVersion` from the database on **every**
  call. Deletion, demotion and password reset all revoke access immediately.
- Signup is a one-time bootstrap, re-checked inside the transaction with the
  serialization-failure race handled.
- `/api/draft` — the draft-mode bypass cookie — is minted only behind
  `requireStaff()`. Disabling needs no auth, which is correct.
- The draft redirect target must start with `/` and not `//` or `/\`, closing
  the open-redirect.

### Authorization

- `requireStaff(roles)` / `requireStaffPage(roles)` are the two primitives.
  `requireStaffPage` redirects an EDITOR on an ADMIN page to the dashboard
  rather than the login screen — correct, since they *are* signed in.
- `runAction` collapses every throw to a generic message, except `Unauthorized`
  which becomes "You are not allowed to do that." No raw errors reach the client.

**Gap:** the primitive was verified; **the 30 action files' call sites were
not.** An action missing its guard entirely would not have been caught by this
pass. See `09-STUDIO-AUDIT.md`.

### Injection

- JSON-LD escapes `<` as `<`.
- Tiptap renders through a fixed extension set; `href` schemes are allow-listed
  after whitespace/control-character stripping.
- Markdown import goes `marked` -> `generateJSON(StarterKit)`, so the schema
  discards unknown nodes — the Tiptap schema is itself the sanitiser.
- No `eval`, no `new Function`, no `srcdoc` in application code.

### SSRF

`src/lib/scraper/ssrf.ts` rejects loopback, private v4, link-local (including
`169.254.169.254`), and IPv4-mapped IPv6 in both dotted and hex-group form.
Redirects are `manual` and **revalidated per hop** — the vector that defeats a
pre-flight-only check, and the module says so. Residual DNS-rebinding exposure
is documented rather than hidden.

`safeFetch` is used by the adapters, robots, sitemaps, fingerprint, and the
image mirror. **The adapters themselves were not read.**

### File handling

- Upload allow-list is server-side; the extension comes from the server's map,
  never the filename.
- `sanitizePathname` throws on `..`, `.`, empty segments and normalises
  backslashes.
- Both storage drivers add a random suffix.
- SVG excluded; legacy SVG served as an attachment under `default-src 'none';
  sandbox`.
- `nosniff` on served files.

### Abuse protection

- Honeypot plus a **server-signed** fill-time token — the fill time cannot be
  forged from a client clock.
- Login and password reset use `rateLimitDurable` (Postgres-backed), so counts
  survive cold starts and fan-out. It **fails open** on a database error, which
  is deliberate: a limiter outage must not lock every staffer out, and the
  password still has to be correct. Reasonable, and worth knowing.
- In-memory limiter is bounded at 10,000 buckets with lazy pruning.

### PII

- `Inquiry.claimTokenHash` stores a **hash** of a one-time token, so only the
  submitter can re-read their own PII from the public fallback.
- Export routes are staff-gated.

### Secrets

- `.env.example` holds placeholders only.
- The CI literals (`AUTH_SECRET: ci-build-secret-…`, the studio audit password)
  are **not** a leak: they authenticate against a throwaway Postgres container
  the runner destroys, and `scripts/ci-staff-user.ts` refuses any non-local
  `DATABASE_URL`.
- **No systematic secret scan was run** — no `git log -S`, no history sweep, no
  `NEXT_PUBLIC_` audit. Do this before release.

## Headers

| Header | State |
|---|---|
| `Strict-Transport-Security` | 2y, `includeSubDomains`, `preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera/mic/geolocation/browsing-topics denied |
| `X-Frame-Options` | `SAMEORIGIN`; **`DENY` on `/studio/*`** |
| `X-Robots-Tag` | `noindex, nofollow` on `/studio/*` |
| CSP | **Report-Only** — see `RR-005` |

## Not audited

- Studio action call sites (30 files) — the largest remaining gap.
- Scraper adapters.
- Google Sheets credential handling and write paths.
- CSV formula injection on export (`=`, `+`, `-`, `@` leading cells).
- Cookie flag verification at runtime.
- Dependency CVEs (`npm audit` — not run).
- Any dynamic testing whatsoever.
