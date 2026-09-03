import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

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
    // next.config.ts, which caps the other side of that product.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
