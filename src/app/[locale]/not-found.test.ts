import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The soft-404 pin (Q1 / ENG-813).
 *
 * Unknown product/blog/category slugs render this boundary through an ISR
 * prerender, and that path serves HTTP 200 — the framework trade-off the
 * codebase accepted in `global-not-found.tsx` ("the catch-all's notFound()
 * streamed a 200"). What makes that acceptable is exactly one line in each
 * boundary: `robots: { index: false }`, so the page can never enter the
 * index as a soft-404 no matter which render path serves it.
 *
 * The alternatives to this pin were weighed and rejected: a slug lookup in
 * middleware puts the database on the request path of infra that must not
 * depend on it, and `force-dynamic` on the detail pages would buy a real
 * 404 at the price of ISR caching on every product, blog and category page
 * — a performance regression worse than the cosmetic status line it fixes.
 *
 * This test reads the sources rather than importing them: importing a
 * boundary file drags its component tree (and its CSS) into the runner,
 * while the contract being pinned is one declaration per file. If the line
 * ever disappears or drifts, the soft-404 is back and this fails loudly.
 */
const localized = readFileSync(
  fileURLToPath(new URL("./not-found.tsx", import.meta.url)),
  "utf8",
);
const global_ = readFileSync(
  fileURLToPath(new URL("../global-not-found.tsx", import.meta.url)),
  "utf8",
);

describe("not-found boundaries stay noindexed (ENG-813)", () => {
  it("the localized boundary declares robots.index: false", () => {
    expect(localized).toContain("robots: { index: false }");
  });

  it("the global boundary declares robots.index: false", () => {
    expect(global_).toContain("robots: { index: false }");
  });

  it("the localized boundary keeps the reason next to the declaration", () => {
    // The comment naming the 200-commit trade-off is what stops a reader
    // from "cleaning up" the line as redundant. Keep them together.
    expect(localized).toMatch(/soft-404/);
  });
});
