import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SEED_SOURCES, seedSourceUpsertData } from "./seed-data";

const repoRoot = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(repoRoot, p), "utf8");

/**
 * These tests exist because of a bug CI caught and a developer database hid.
 *
 * `collectionMode` was added to `applySeedSources` and NOT to
 * `prisma/seed-sources.ts`, the copy `bootstrap.ts` actually runs on every
 * deploy — under a comment claiming the two mirrored each other exactly. On a
 * fresh database the enquiry-only source therefore came up automatable. It
 * passed locally only because the row already existed there, so the
 * migration's backfill had set it and the seed never took the create branch.
 */
describe("seedSourceUpsertData", () => {
  const seed = SEED_SOURCES.find((s) => s.key === "poonam-shah-art");

  it("carries a seed's recorded collection mode onto a NEW row", () => {
    expect(seed?.collectionMode).toBe("MANUAL_RESEARCH");
    const { create } = seedSourceUpsertData(seed!, undefined);
    expect(create.collectionMode).toBe("MANUAL_RESEARCH");
  });

  it("leaves the operator's own decisions alone on an EXISTING row", () => {
    // Re-seeding runs on every deploy. If it wrote these, a deploy would undo
    // a disable, an approval or a block the owner had just recorded.
    const { update } = seedSourceUpsertData(seed!, {
      platform: "UNKNOWN",
      verifiedAt: null,
    });
    expect(update).not.toHaveProperty("collectionMode");
    expect(update).not.toHaveProperty("enabled");
    expect(update).not.toHaveProperty("policyReviewStatus");
  });

  it("omits collectionMode entirely for a seed that states none", () => {
    // The column's own default (HTTP) should decide, not a value written here
    // — otherwise every seed would be asserting something nobody recorded.
    const plain = SEED_SOURCES.find((s) => s.collectionMode === undefined);
    const { create } = seedSourceUpsertData(plain!, undefined);
    expect(create).not.toHaveProperty("collectionMode");
  });

  it("never downgrades a platform that was verified live", () => {
    const shopify = SEED_SOURCES.find((s) => s.platform === "SHOPIFY")!;
    const verified = seedSourceUpsertData(shopify, {
      platform: "WOOCOMMERCE",
      verifiedAt: new Date(),
    });
    expect(verified.update).not.toHaveProperty("platform");

    const unverified = seedSourceUpsertData(shopify, {
      platform: "UNKNOWN",
      verifiedAt: null,
    });
    expect(unverified.update.platform).toBe("SHOPIFY");
  });
});

describe("the two registry reconcilers", () => {
  it("both build their upsert from the shared payload, not their own copy", () => {
    // The guard against the exact drift above: two callers reconcile this
    // registry, and `prisma/seed-sources.ts` cannot import the Studio one
    // (it would pull in `@/lib/db`). So the rule lives in seed-data.ts and
    // neither file is allowed to spell out its own create/update again.
    for (const file of [
      "src/lib/scraper/seed-sources.ts",
      "prisma/seed-sources.ts",
    ]) {
      const source = read(file);
      expect(source, `${file} must use the shared payload`).toContain(
        "seedSourceUpsertData(seed,",
      );
      expect(source, `${file} must not hand-build an upsert payload`).not.toMatch(
        /create:\s*\{\s*\n\s*key:/,
      );
    }
  });
});
