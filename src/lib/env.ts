import { z } from "zod";

import { normalizeSiteUrl } from "@/lib/site-url";

/**
 * Centralized environment validation (ENG-002). Required vars are parsed once
 * at module load — importing this from db.ts means a missing/typo'd config
 * fails fast and LOUDLY at boot with a clear message, instead of surfacing as
 * an opaque pg connection error (or a silently disabled feature) at first use.
 * Optional integration vars are typed but never required.
 *
 * Server-only: this reads process.env and must not be imported into a client
 * component or the edge middleware.
 */
const schema = z.object({
  // Required — the app cannot function without these.
  // `error` (not just `.min(1)`) so an ABSENT var reports the same actionable
  // sentence as an empty one. `withoutBlanks` turns a blank into an absent,
  // and Zod's default for absent is "expected string, received undefined" —
  // which tells an operator the type system's problem, not theirs.
  DATABASE_URL: z
    .string({ error: "DATABASE_URL is required (Postgres connection string)" })
    .min(1, "DATABASE_URL is required (Postgres connection string)"),
  AUTH_SECRET: z
    .string({ error: "AUTH_SECRET is required (Auth.js session signing)" })
    .min(1, "AUTH_SECRET is required (Auth.js session signing)"),

  // Host trust for Auth.js. Vercel sets VERCEL=1 (auto-trusted); any other
  // deploy MUST set AUTH_TRUST_HOST=true or every auth check errors with
  // UntrustedHost — see the production guard in loadEnv (M-A6).
  VERCEL: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // Public (build-time inlined) — optional; constants.ts supplies fallbacks.
  //
  // Repaired, not refused. This was `z.string().url()`, and a value pasted
  // from a hosting dashboard as a bare host (`www.rivyalivingart.com`) failed
  // it with `Invalid URL`. Because `db.ts` imports this module, that killed
  // the entire production build during page-data collection — over an
  // OPTIONAL variable that nothing reads off `env`, that `constants.ts` has a
  // fallback for, and whose only real consumer already tolerates a malformed
  // value at runtime. A validator that can only ever take the site down is
  // not a guard; `normalizeSiteUrl` fixes the common typo and reports the
  // rest as unset (see the warning in loadEnv).
  NEXT_PUBLIC_SITE_URL: z.string().optional().transform(normalizeSiteUrl),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),
  // Marketing tags — off unless set (MKT-002).
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_GA_ID: z.string().optional(),

  // Optional integrations — a missing one disables that feature by design.
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_EMAIL_DOMAIN: z.string().optional(),
  RESEND_FROM: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  SCRAPER_USER_AGENT: z.string().optional(),
});

/**
 * A variable declared with no value is the same as not declaring it.
 *
 * Hosting dashboards make it easy to add a key and leave the value blank —
 * pasting the names from `.env.example` does exactly that. The result reaches
 * the process as `""`, which is a *string*, so `.optional()` (which only
 * admits `undefined`) does not apply and the rest of the validator runs
 * against an empty value.
 *
 * That cost a production deploy: `NEXT_PUBLIC_SITE_URL` is declared
 * `z.string().url().optional()`, a blank one failed `.url()`, and the build
 * died with `Invalid URL` — a message that describes a malformed value rather
 * than an absent one. The sibling blanks passed only because they carry no
 * `.url()` refinement.
 *
 * Stripping blanks before parsing makes both halves behave the way an operator
 * expects: an optional variable left empty is simply off, and a REQUIRED one
 * left empty now reports "…is required" instead of a refinement error.
 */
export function withoutBlanks(
  source: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.trim() !== "") out[key] = value;
  }
  return out;
}

function loadEnv() {
  const source = withoutBlanks(process.env);
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration — fix these before the app can start:\n${issues}`,
    );
  }
  // An unusable NEXT_PUBLIC_SITE_URL is now non-fatal, so it has to be
  // audible: the site comes up on the fallback origin, which is right for a
  // deploy that never set the variable and wrong for one that meant to. The
  // build log is where an operator is already looking when a deploy behaves
  // oddly, and this is the only place that knows both values.
  if (source.NEXT_PUBLIC_SITE_URL && !parsed.data.NEXT_PUBLIC_SITE_URL) {
    console.warn(
      `NEXT_PUBLIC_SITE_URL is not a usable origin (${source.NEXT_PUBLIC_SITE_URL}) — ` +
        "ignoring it and falling back to the default in src/lib/constants.ts. " +
        "Set it to a full origin, e.g. https://www.rivyalivingart.com.",
    );
  }

  // Auth.js refuses untrusted hosts at request time (UntrustedHost), which
  // reads as a broken login rather than a config error. Vercel is trusted
  // automatically (VERCEL=1); every other production deploy must opt in
  // explicitly, so fail at boot with the actual fix (M-A6).
  if (
    process.env.NODE_ENV === "production" &&
    !parsed.data.VERCEL &&
    !parsed.data.AUTH_TRUST_HOST
  ) {
    throw new Error(
      "AUTH_TRUST_HOST=true is required when deploying outside Vercel — " +
        "without it Auth.js rejects every request with UntrustedHost and " +
        "the studio login cannot work.",
    );
  }
  return parsed.data;
}

export const env = loadEnv();
