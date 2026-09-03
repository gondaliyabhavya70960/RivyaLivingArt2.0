/**
 * Content Lab host guard — plain, no imports.
 *
 * Loading demo fixtures writes 400+ rows across every content table. That is
 * harmless on a throwaway database and catastrophic on the one carrying
 * 4,385 real products, so every entry point that can write demo data
 * (`scripts/seed-demo.ts`, `src/actions/demo.ts`) asks this first, prints
 * what it found, and refuses unless the caller has explicitly overridden it.
 *
 * `host` is derived from the connection string alone — never a network call,
 * never a query — so the guard can run before anything else touches the
 * database.
 */

export type DemoHostInfo = {
  /** "<hostname>/<database>", so two databases on one host still read apart. */
  host: string;
  /** True when the host looks like a local or CI throwaway database. */
  allowed: boolean;
  /** True when writing demo data here should be refused without an explicit override. */
  production: boolean;
};

/**
 * A local Postgres (any port), or a database whose name marks it as the CI
 * throwaway (`rivya_ci`). Anything else — a Neon/Prisma Postgres/RDS host, a
 * database named for the live site — is NOT allow-listed by default.
 */
const ALLOWED_HOST_PATTERN = /localhost|127\.0\.0\.1|rivya_ci/i;

function hostOf(databaseUrl: string | undefined): string {
  if (!databaseUrl) return "(unset)";
  try {
    const url = new URL(databaseUrl);
    const database = url.pathname.replace(/^\//, "");
    return database ? `${url.hostname}/${database}` : url.hostname;
  } catch {
    // Not a parseable URL (a malformed value, or a driver-specific string) —
    // fail closed: report the raw value as the host and let the pattern
    // below decide, which will almost always mean "not allowed".
    return databaseUrl;
  }
}

/**
 * Describe the database a demo write is about to target.
 *
 * `env` defaults to `process.env` and is a parameter only so the guard can be
 * unit-tested against every combination without mutating the real
 * environment. Passing `env.DEMO_DB_ALLOW` names one additional host string
 * that counts as allowed — for an environment (a preview deploy, a named
 * sandbox database) the pattern above cannot anticipate.
 */
export function describeDemoHost(
  databaseUrl: string | undefined,
  env: Record<string, string | undefined> = process.env,
): DemoHostInfo {
  const host = hostOf(databaseUrl);
  const explicitAllow = env.DEMO_DB_ALLOW;
  const allowed =
    ALLOWED_HOST_PATTERN.test(host) ||
    (!!explicitAllow && host === explicitAllow);
  // Even an allow-listed host is refused if the process itself reports it is
  // running in production — a CI throwaway database is never expected to
  // answer VERCEL_ENV=production or NODE_ENV=production at the same time.
  const production =
    env.VERCEL_ENV === "production" ||
    env.NODE_ENV === "production" ||
    !allowed;
  return { host, allowed, production };
}
