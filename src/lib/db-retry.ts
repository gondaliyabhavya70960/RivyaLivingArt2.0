/**
 * The connection-pressure retry policy, as pure functions.
 *
 * `next build` prerenders in parallel workers, each with its own pg pool, and
 * Vercel may run two builds of the same project at once when pushes arrive
 * close together. The hosted Postgres caps connections per ROLE, so the sum
 * of every worker's pool across every concurrent build can exceed it; Prisma
 * then throws `P2037` ("too many connections") and one failed read on one
 * page exits the whole build. Those refusals clear within milliseconds as
 * other pages finish, which is exactly the shape a short, jittered retry
 * fixes. Kept pure so the policy is unit-tested and the client stays thin.
 */
export const TOO_MANY_CONNECTIONS = "P2037";

export const MAX_ATTEMPTS = 6;

export function isTooManyConnections(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown; meta?: unknown };
  if (e.code === TOO_MANY_CONNECTIONS) return true;
  const meta = e.meta as { driverAdapterError?: { name?: unknown } } | undefined;
  if (meta?.driverAdapterError?.name === "TooManyConnections") return true;
  return (
    typeof e.message === "string" &&
    /too many (database )?connections/i.test(e.message)
  );
}

/** Backoff before attempt `n` (1-based): 150, 300, 600 … ms plus jitter, capped at 2 s. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(2_000, 150 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base + random() * 100);
}

/** Pool size per process: small while `next build` fans out across workers. */
export function poolMax(
  env: Record<string, string | undefined> = process.env,
): number {
  const explicit = Number(env.DB_POOL_MAX);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return env.NEXT_PHASE === "phase-production-build" ? 2 : 5;
}
