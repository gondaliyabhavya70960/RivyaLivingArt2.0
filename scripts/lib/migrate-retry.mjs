/**
 * Decide whether a failed `prisma migrate deploy` is worth running again.
 *
 * The distinction this module exists to make: a migration that FAILED is not
 * the same as a migration that never STARTED. Retrying the first is useless at
 * best — Prisma records the failure in `_prisma_migrations` and every
 * subsequent deploy refuses until someone runs `migrate resolve`, so a retry
 * loop would bury the one error an operator has to read. Retrying the second
 * is free: nothing was applied, so running it again is the same command
 * against a database that has since had a moment to breathe.
 *
 * Why this is needed at all. `npm run build` runs `migrate deploy` first, and
 * Vercel runs that build for PREVIEW deployments too. Three migrations pushed
 * inside twenty minutes on 2026-09-15 meant six builds (preview + production)
 * each opening a migration connection, and production answered
 * `FATAL: too many connections for role "prisma_migration"` — a full build
 * failure caused by nothing but cadence. Prisma Postgres caps that role low on
 * purpose; the fix is to wait, not to change the schema or the code.
 *
 * Both lists are matched against the command's combined stdout+stderr, and
 * BLOCKED wins over TRANSIENT. A half-applied migration whose failure happens
 * to mention a dropped connection is exactly the case where retrying is wrong,
 * so the "did it fail" evidence has to outrank the "was it flaky" evidence.
 */

/**
 * Evidence that a migration was attempted and did not apply cleanly. Anything
 * here means STOP, whatever else the output says.
 *
 * P3009 is Prisma's own "found failed migrations in the target database".
 */
const BLOCKED = [
  /P3009/,
  /migrate found failed migrations/i,
  /A migration failed to apply/i,
  /migration started at .* failed/i,
  /failed to apply cleanly to the shadow database/i,
];

/**
 * Evidence that the command never got as far as applying anything: the
 * connection was refused, capped, dropped, or lost to the lock another build
 * was holding.
 *
 * The advisory lock is in here deliberately. `prisma.config.ts` points
 * migrations at the UNPOOLED url precisely so they CAN take that lock, and two
 * builds racing for it is the normal consequence — the loser waits and wins on
 * the next attempt. P1002 is the connection timeout, P1017 the server hanging
 * up mid-handshake.
 */
const TRANSIENT = [
  /too many connections/i,
  /remaining connection slots are reserved/i,
  /P1001/,
  /P1002/,
  /P1017/,
  /Can't reach database server/i,
  /Timed out trying to acquire a postgres advisory lock/i,
  /server closed the connection unexpectedly/i,
  /Connection (reset by peer|terminated|closed)/i,
  /\b(ECONNRESET|ETIMEDOUT|ECONNREFUSED|EAI_AGAIN|EPIPE)\b/,
];

const first = (patterns, text) => patterns.find((p) => p.test(text)) ?? null;

/**
 * @param {string} output combined stdout + stderr of the failed run
 * @returns {{ retry: boolean, reason: string }} `reason` is written to be
 *   printed as-is in the build log, because that log is the only place anyone
 *   will read it.
 */
export function classifyMigrateFailure(output) {
  const text = String(output ?? "");

  const blocked = first(BLOCKED, text);
  if (blocked) {
    return {
      retry: false,
      reason:
        `a migration was applied and failed (matched ${blocked}). ` +
        "Retrying cannot help: Prisma has recorded the failure and will refuse " +
        "every later deploy until `prisma migrate resolve` clears it.",
    };
  }

  const transient = first(TRANSIENT, text);
  if (transient) {
    return {
      retry: true,
      reason: `the database was not reachable (matched ${transient}) — nothing was applied`,
    };
  }

  return {
    retry: false,
    reason:
      "the failure is not a known connection problem, so it is treated as real. " +
      "Read the error above rather than the retry policy.",
  };
}
