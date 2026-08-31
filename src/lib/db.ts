import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma 7 client over the pg driver adapter. Works identically against
 * local Postgres and Neon's pooled connection string (Vercel-native
 * integration injects DATABASE_URL in production). Importing `env` here
 * validates DATABASE_URL (and AUTH_SECRET) once, loudly, at boot.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Cap sockets per warm lambda under Neon's pooler limit (PrismaPg
    // forwards these to the underlying pg pool config).
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
