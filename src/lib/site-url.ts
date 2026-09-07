/**
 * The one rule for reading `NEXT_PUBLIC_SITE_URL`.
 *
 * A hosting dashboard shows a project's domain as a bare host —
 * `www.rivyalivingart.com` — and that is what gets pasted into the variable.
 * It is unambiguous to a human and unusable to `new URL()`, which is the
 * shape every consumer here needs:
 *
 *   - `src/lib/env.ts` validated it with `z.string().url()`, so a scheme-less
 *     value failed with `Invalid URL` at module load. `env` is imported by
 *     `db.ts`, so **the whole production build died** collecting page data —
 *     on a variable that is declared optional, that `env` never exposes to a
 *     caller, and that `constants.ts` already has a fallback for.
 *   - `src/app/shared-metadata.ts` calls `new URL(SITE.url)` for
 *     `metadataBase`, so the same value would have taken the build down a
 *     second time even with the validator relaxed.
 *   - `og-brand.ts` degrades to a string trim, and every `${SITE.url}/path`
 *     call site would have emitted a relative URL as a canonical.
 *
 * So this is not a validator. It **repairs the value an operator meant**: a
 * missing scheme becomes `https://`, surrounding whitespace and trailing
 * slashes go (~30 call sites append their own `/path`), and only a value that
 * is still not an absolute http(s) URL after that is reported as unusable —
 * `undefined`, the same as unset, so the caller's fallback applies.
 *
 * Client-safe and dependency-free on purpose: `constants.ts` is bundled into
 * client components and cannot import the server-only env module, and the two
 * must not disagree about what a given value means.
 */

/** `scheme://` — not `localhost:3000`, whose colon is a port. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** Hosts that mean a dev server, where the scheme to assume is `http`. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * The origin (plus any base path) to build absolute URLs from, or `undefined`
 * when the value is absent, blank or beyond repair.
 */
export function normalizeSiteUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  // A lone leading slash is a PATH, not a host with the scheme left off, and
  // prefixing one invents a hostname out of its first segment
  // (`/relative/path` → `https://relative/path`). `//host` is the
  // protocol-relative form and is repairable, so only the single slash goes.
  if (value.startsWith("/") && !value.startsWith("//")) return undefined;

  // `https://` by default; `http://` for a local dev host, which is what
  // INSTALL.md documents and the only place a plain-text origin is normal.
  const withScheme = HAS_SCHEME.test(value)
    ? value
    : `${LOCAL_HOSTS.has(value.split(/[:/?#]/)[0]) ? "http" : "https"}://${value}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return undefined;
  }

  // An `ftp://` origin is not a repairable typo, and neither is `https://`
  // with nothing after it (`hostname` is empty for that).
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return undefined;
  if (!parsed.hostname) return undefined;

  // Credentials in an origin are never what an operator meant, and prefixing
  // a scheme can manufacture them: `mailto:hi@example.com` carries no `://`,
  // so it becomes `https://mailto:hi@example.com` — which parses cleanly, as
  // `example.com` with a username. Serving the canonical origin from a host
  // lifted out of somebody's email address is worse than falling back.
  if (parsed.username || parsed.password) return undefined;

  // Search and hash are dropped rather than carried: they cannot mean
  // anything as the base of a canonical, a sitemap entry or an OG image URL.
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
}
