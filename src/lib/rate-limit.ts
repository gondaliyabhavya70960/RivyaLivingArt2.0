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
 * Best-effort client IP from a request's headers, for rate-limit keying.
 *
 * **DEPLOYMENT CONTRACT — VERCEL ONLY:**
 * Reads the first `x-forwarded-for` hop (Vercel sets/overwrites this header at
 * the edge) and falls back to `x-real-ip` or "anon" so keying never crashes.
 *
 * SECURITY WARNING:
 * On Vercel, the edge proxy guarantees that the incoming client cannot forge
 * the first `x-forwarded-for` address because Vercel either overwrites the
 * header or prepends the connecting IP.
 * If this application is ever deployed outside Vercel (e.g. self-hosted Node,
 * AWS ECS, Docker) behind an untrusted reverse proxy or directly to the web,
 * an attacker can send arbitrary `x-forwarded-for: <random-ip>` headers to
 * mint a fresh rate-limit bucket on every request, defeating IP throttles
 * including the studio login protection (SEC-004 / SEC-102). In non-Vercel
 * deployments, set up trusted proxy hop counting via `trustedProxyDepth` or
 * bind to a trusted edge header (such as `x-real-ip` or `cf-connecting-ip`).
 */
export function clientIp(headers: Headers, trustedProxyDepth = 1): string {
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) {
    const realIp = headers.get("x-real-ip");
    return realIp?.trim() || "anon";
  }

  const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  if (hops.length === 0) return "anon";

  // Vercel edge contract: index 0 is the verified client IP.
  // For multi-proxy setups, trustedProxyDepth allows indexing from the right:
  if (trustedProxyDepth > 1 && hops.length >= trustedProxyDepth) {
    return hops[hops.length - trustedProxyDepth];
  }
  return hops[0] || "anon";
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
