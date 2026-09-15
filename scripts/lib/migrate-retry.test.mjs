import { describe, expect, it } from "vitest";
import { classifyMigrateFailure } from "./migrate-retry.mjs";

/**
 * The two directions this classifier can be wrong in are not symmetrical.
 *
 * Failing to retry a flaky connection costs a build — annoying, visible,
 * self-correcting on the next push. RETRYING A FAILED MIGRATION costs the
 * operator the error message: Prisma records the failure, every later deploy
 * refuses, and the build log they finally read is three copies of a retry
 * notice wrapped around it. So the "blocked" cases below matter more than the
 * "transient" ones, and the mixed case is the whole point of the ordering.
 */
describe("classifyMigrateFailure", () => {
  it("retries the connection cap that caused this to be written", () => {
    // The real 2026-09-15 failure: three migrations in twenty minutes, each
    // pushing a preview build and a production build at the same database.
    const result = classifyMigrateFailure(
      'Error: db error: FATAL: too many connections for role "prisma_migration"',
    );
    expect(result.retry).toBe(true);
  });

  it.each([
    ["an unreachable server", "Error: P1001: Can't reach database server at db.prisma.io:5432"],
    ["a connection timeout", "Error: P1002: The database server was reached but timed out"],
    ["a server that hung up", "Error: P1017: Server has closed the connection"],
    [
      "two builds racing for the migration lock",
      "Error: Timed out trying to acquire a postgres advisory lock (SQLSTATE: 55P03)",
    ],
    ["a dropped socket", "Error: connect ECONNRESET 10.0.0.1:5432"],
    ["DNS that has not caught up", "Error: getaddrinfo EAI_AGAIN db.prisma.io"],
  ])("retries %s", (_label, output) => {
    expect(classifyMigrateFailure(output).retry).toBe(true);
  });

  it("refuses to retry a migration Prisma has recorded as failed", () => {
    const result = classifyMigrateFailure(
      "Error: P3009\n\nmigrate found failed migrations in the target database.\n" +
        "The `20260915113000_research_product_snapshots` migration started at " +
        "2026-09-15 11:30:00 UTC failed",
    );
    expect(result.retry).toBe(false);
    expect(result.reason).toMatch(/migrate resolve/);
  });

  it("refuses even when the failed migration ALSO mentions a lost connection", () => {
    // A migration that dies part-way through often reports both. Retrying here
    // is the expensive mistake, so the evidence of a failure has to outrank the
    // evidence of flakiness.
    const result = classifyMigrateFailure(
      "Applying migration `20260915120000_normalization_alias`\n" +
        "A migration failed to apply. New migrations cannot be applied before the error is recovered from.\n" +
        "Database error: Connection reset by peer",
    );
    expect(result.retry).toBe(false);
  });

  it("does not retry a failure it does not recognise", () => {
    const result = classifyMigrateFailure(
      'Database error: ERROR: relation "Product" already exists',
    );
    expect(result.retry).toBe(false);
    expect(result.reason).toMatch(/treated as real/);
  });

  it("does not retry on no output at all", () => {
    expect(classifyMigrateFailure("").retry).toBe(false);
    expect(classifyMigrateFailure(undefined).retry).toBe(false);
  });
});
