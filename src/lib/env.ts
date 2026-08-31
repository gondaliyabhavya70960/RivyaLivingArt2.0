import { z } from "zod";

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
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Postgres connection string)"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required (Auth.js session signing)"),

  // Host trust for Auth.js. Vercel sets VERCEL=1 (auto-trusted); any other
  // deploy MUST set AUTH_TRUST_HOST=true or every auth check errors with
  // UntrustedHost — see the production guard in loadEnv (M-A6).
  VERCEL: z.string().optional(),
  AUTH_TRUST_HOST: z.string().optional(),

  // Public (build-time inlined) — optional; constants.ts supplies fallbacks.
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
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
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_KEY_B64: z.string().optional(),
  SCRAPE_SHEET_ID: z.string().optional(),
  SHEET_ID: z.string().optional(),
  SCRAPER_USER_AGENT: z.string().optional(),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration — fix these before the app can start:\n${issues}`,
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
