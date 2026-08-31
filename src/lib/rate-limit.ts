/**
 * Simple per-key (usually per-IP) sliding-window rate limiter for public
 * Server Actions. In-memory — resets on cold start and is per-instance on
 * serverless, which is acceptable for spam protection (no paid service, per
 * spec). Security-sensitive paths (login, password reset) use the durable
 * variant `rateLimitDurable` below, backed by Postgres, so their counts
 * survive cold starts and fan-out (SEC-102). Windows are pruned lazily so
 * the in-memory map cannot grow unbounded.
 */
import { db } from "@/lib/db";
import { verifyFormToken } from "@/lib/form-token";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Best-effort client IP from a request's headers, for rate-limit keying. Reads
 * the first `x-forwarded-for` hop (Vercel sets this) and falls back to "anon"
 * so keying never crashes. Pass `(await headers())` in a Server Action or
 * `request.headers` in a route handler — one source for what was redeclared in
 * 6 places with drifting shapes (ENG-810). Callers that run outside a request
 * scope (e.g. Auth.js authorize) should wrap their `headers()` call in try/catch
 * and pass "anon" on failure.
 */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

export function rateLimit(
  key: string,
  {
    limit = 5,
    windowMs = 60_000,
    record = true,
  }: { limit?: number; windowMs?: number; record?: boolean } = {},
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) {
      // Drop the oldest entry — bounded memory beats perfect fairness here.
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= limit) {
    const retryAfterMs = bucket.timestamps[0] + windowMs - now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  // `record: false` peeks (checks) without consuming budget — used to gate
  // login on FAILURES only, so a successful sign-in never counts against you.
  if (record) bucket.timestamps.push(now);
  return { ok: true };
}

/**
 * Durable sliding-window limiter for security-sensitive keys (login, password
 * reset). Backed by the RateLimitHit table so counts survive serverless cold
 * starts and multiply-instanced fan-out — a parallel attacker can no longer
 * reset the budget by landing on a fresh lambda (SEC-102). Same signature and
 * result shape as `rateLimit`, so call sites swap in place; async because it
 * touches the DB. Fails OPEN on a DB error: a limiter outage must never lock
 * every staffer out of login (the password still has to be correct).
 */
export async function rateLimitDurable(
  key: string,
  {
    limit = 5,
    windowMs = 60_000,
    record = true,
  }: { limit?: number; windowMs?: number; record?: boolean } = {},
): Promise<RateLimitResult> {
  const now = Date.now();
  const cutoff = new Date(now - windowMs);
  try {
    // Opportunistically prune this key's expired rows (bounded per call).
    await db.rateLimitHit.deleteMany({ where: { key, at: { lt: cutoff } } });
    const hits = await db.rateLimitHit.findMany({
      where: { key, at: { gte: cutoff } },
      orderBy: { at: "asc" },
      select: { at: true },
    });
    if (hits.length >= limit) {
      const retryAfterMs = hits[0].at.getTime() + windowMs - now;
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }
    if (record) {
      await db.rateLimitHit.create({ data: { key, at: new Date(now) } });
    }
    return { ok: true };
  } catch (error) {
    console.error("rateLimitDurable failed (failing open):", error);
    return { ok: true };
  }
}

/**
 * Shared spam checks for public forms: honeypot field must stay empty and
 * the form must have taken a human amount of time to fill — measured by a
 * SERVER-issued signed timestamp (S-06; src/lib/form-token.ts), so the
 * fill time can no longer be forged from a client wall clock.
 */
export function passesSpamChecks(input: {
  honeypot?: string | null;
  formToken?: string | null;
  minFillMs?: number;
}): { ok: true } | { ok: false; reason: "honeypot" | "token" } {
  const { honeypot, formToken, minFillMs = 2_500 } = input;
  if (honeypot) return { ok: false, reason: "honeypot" };
  if (!verifyFormToken(formToken, minFillMs)) {
    return { ok: false, reason: "token" };
  }
  return { ok: true };
}
