import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Creates the one staff row `scripts/studio-audit.mjs` signs in as.
 *
 * Every /studio route is behind `requireStaffPage`, so an audit with no
 * account measures the login screen thirty times and reports it clean. CI's
 * database is a throwaway container that `npm run build` bootstraps and the
 * runner destroys, and `prisma/bootstrap.ts` only creates an admin when
 * ADMIN_EMAIL/ADMIN_PASSWORD are set — which CI deliberately does not do,
 * because the full seed would add catalogue rows the storefront audits are
 * calibrated against.
 *
 * So this adds exactly one ADMIN and nothing else. It is for CI; it refuses
 * to run against a database that is not obviously disposable.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  const email = process.env.STUDIO_EMAIL?.toLowerCase();
  const password = process.env.STUDIO_PASSWORD;
  if (!url || !email || !password) {
    console.error("DATABASE_URL, STUDIO_EMAIL and STUDIO_PASSWORD are required.");
    process.exit(1);
  }
  // A guard, not a formality: this script sets a known password on an ADMIN
  // account. It must never be pointed at a real deployment by a stray env.
  if (!/localhost|127\.0\.0\.1|resinriva_ci/.test(url)) {
    console.error(
      "refusing to run: DATABASE_URL is not a local/CI database.\n" +
        "This creates an ADMIN with a known password and is for throwaway databases only.",
    );
    process.exit(1);
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const hashedPassword = await hash(password, 10);
  await db.user.upsert({
    where: { email },
    update: { hashedPassword, role: "ADMIN" },
    create: { email, name: "Studio Audit", hashedPassword, role: "ADMIN" },
  });
  await db.$disconnect();
  console.log(`studio audit account ready: ${email}`);
}

void main();
