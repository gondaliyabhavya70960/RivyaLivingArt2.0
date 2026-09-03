import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Content Lab fixtures must never load on a real deploy just because
 * `prisma/bootstrap.ts` happened to run. `seedDemo`/`removeDemo` are reached
 * only through `scripts/seed-demo.ts` (an operator's own CLI call, gated by
 * `describeDemoHost`) and `src/actions/demo.ts` (a staff action, refused in
 * production). This greps the deploy-time bootstrap source for either word
 * so that guarantee cannot quietly regress — a future edit that wires demo
 * seeding into bootstrap for convenience fails this test instead of shipping
 * a build that seeds fixtures into the live database.
 */
describe("bootstrap isolation", () => {
  it("prisma/bootstrap.ts never mentions demo fixtures", () => {
    const source = readFileSync(
      join(process.cwd(), "prisma/bootstrap.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/demo/i);
    expect(source).not.toMatch(/fixtures/i);
  });
});
