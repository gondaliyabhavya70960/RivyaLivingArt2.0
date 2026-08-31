import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: CLI config lives here; .env is NOT auto-loaded, hence the
// dotenv import above (Next.js loads .env itself at runtime).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma 7: this URL is used ONLY by the Prisma CLI (migrate / generate).
    // Migrations run DDL and take advisory locks, which pgbouncer's
    // transaction pooling (Neon's -pooler host) does not support — so prefer
    // the DIRECT/unpooled connection here. The runtime client stays on the
    // pooled DATABASE_URL via the pg adapter in src/lib/db.ts.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      "",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
