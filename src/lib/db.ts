import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";
import {
  isTooManyConnections,
  MAX_ATTEMPTS,
  poolMax,
  retryDelayMs,
} from "@/lib/db-retry";

/**
 * Prisma 7 client over the pg driver adapter. Works identically against local
 * Postgres and the deployed pooled connection string. Importing `env` here
 * validates DATABASE_URL (and AUTH_SECRET) once, loudly, at boot.
 *
 * The deployed `DATABASE_URL` currently resolves to **Prisma Postgres**
 * (`db.prisma.io`), not Neon — the build preflight prints the host on every
 * deploy. This header said Neon, which is stale enough to have misdirected a
 * live incident diagnosis; the pooler limits differ between providers, so the
 * name matters.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Cap sockets per warm lambda under the pooler's limit (PrismaPg
    // forwards these to the underlying pg pool config). This is per PROCESS,
    // so a build multiplies it by the worker count — see the `cpus` note in
    // next.config.ts, which caps the other side of that product. During
    // `next build` the pool shrinks to 2 (poolMax), because the hosted
    // Postgres caps connections per ROLE and two builds of the same project
    // can overlap on Vercel; 4 workers × 2 stays under the cap where 4 × 5
    // did not (P2037 on a prerendered journal page, 2026-09-03).
    max: poolMax(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  const client = new PrismaClient({ adapter });
  // Every query retries a P2037 "too many connections" refusal a few times
  // with a short jittered backoff. The refusal clears in milliseconds as
  // other workers release sockets, and without the retry one refused read on
  // one page exits the whole build (or 500s one request at runtime).
  const resilient = client.$extends({
    query: {
      async $allOperations({ query, args }) {
        let attempt = 1;
        for (;;) {
          try {
            return await query(args);
          } catch (error) {
            if (!isTooManyConnections(error) || attempt >= MAX_ATTEMPTS) {
              throw error;
            }
            await new Promise((r) => setTimeout(r, retryDelayMs(attempt)));
            attempt += 1;
          }
        }
      },
    },
  });
  // The extension changes the client's static type without changing what
  // every call site does; the base type is what the rest of the code names.
  return resilient as unknown as PrismaClient;
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
