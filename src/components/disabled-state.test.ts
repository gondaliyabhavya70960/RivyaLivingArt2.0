/**
 * One disabled state, and it is 40% opacity.
 *
 * `docs/redesign-contract.md` §9 sets it: "Disabled — 40% opacity + a stated
 * reason." The second half was already held (there is exactly one disabled
 * `<Button>` on the storefront and it carries its `reason`). The first half
 * had drifted into three values across 27 declarations:
 *
 *   40  10  the storefront's own components, and three Studio ones
 *   50  16  every `ui/*` shadcn primitive, plus four Studio components
 *   30   1  storefront/carousel-nav
 *
 * Sixteen of those are not a decision anyone made — 50% is shadcn's default,
 * and the primitives were re-pointed at this repo's colour and radius tokens
 * when they were vendored without anyone looking at the opacity. The visible
 * result: on the commissions screen a disabled control in the draft bar sat at
 * 50% while a disabled control on the board sat at 40%.
 *
 * A token would not have prevented that, which is why there isn't one —
 * `disabled:opacity-40` already names itself, and the drift came from pasted
 * vendor defaults rather than from an unnamed value. A test does prevent it:
 * the next shadcn component vendored in at 50% fails here.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/** §9's value. */
const DISABLED_OPACITY = "40";

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(path));
    else if (entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

/**
 * Any Tailwind opacity utility whose variant chain mentions a disabled state —
 * `disabled:`, `aria-disabled:`, `peer-disabled:`, `data-[disabled]:`,
 * `group-data-[disabled=true]:`. Written to catch the whole family rather than
 * the one spelling that happened to be wrong, because a primitive vendored in
 * next month will use whichever its library prefers.
 */
const DISABLED_OPACITY_UTILITY = /[^\s"'`]*disabled[^\s"'`]*:opacity-(\d+)/g;

const offenders: string[] = [];
for (const file of tsxFiles("src")) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(DISABLED_OPACITY_UTILITY)) {
    if (match[1] !== DISABLED_OPACITY) {
      offenders.push(`${file}: ${match[0]}`);
    }
  }
}

describe("disabled state", () => {
  it("renders at 40% opacity everywhere", () => {
    expect(
      offenders,
      `contract §9 sets disabled at ${DISABLED_OPACITY}%`,
    ).toEqual([]);
  });

  it("is actually present to be checked", () => {
    // Without this the regex could stop matching — a Tailwind rename, a
    // refactor to a CSS class — and the rule above would pass by finding
    // nothing, which is the failure mode motion-budget.mjs already had.
    const found = tsxFiles("src").flatMap((file) => [
      ...readFileSync(file, "utf8").matchAll(DISABLED_OPACITY_UTILITY),
    ]);
    expect(found.length).toBeGreaterThanOrEqual(20);
  });
});
