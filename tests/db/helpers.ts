import { db } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma/client";

let isDbConnected: boolean | null = null;

export async function getTestDb(): Promise<PrismaClient | null> {
  if (isDbConnected === false) return null;
  if (isDbConnected === true) return db;

  // If using the dummy fallback URL, Postgres is not available
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("5433/test")) {
    isDbConnected = false;
    return null;
  }

  try {
    await db.$queryRaw`SELECT 1`;
    isDbConnected = true;
    return db;
  } catch {
    isDbConnected = false;
    return null;
  }
}
