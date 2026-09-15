/**
 * Every Studio screen is reachable from the sidebar, and reachable once.
 *
 * The sidebar is the only map of 31 destinations, and the failure it invites
 * is silent: an item dropped while regrouping does not break a build, a type
 * or a route — the page still works, nobody can find it, and the first report
 * is an owner saying a screen "disappeared". Nothing else in CI looks at this
 * list.
 *
 * So the filesystem is the source of truth and this compares the two. Adding a
 * `page.tsx` under `src/app/studio/(dashboard)/` without adding a nav entry
 * fails here, which is the moment to decide where it belongs rather than three
 * weeks later.
 *
 * Read as TEXT rather than imported: `sidebar.tsx` is a client component that
 * pulls React, next/link and lucide-react, and none of that is needed to ask
 * which hrefs it lists. `type-scale.test.ts` and `motion-runtime.test.ts` take
 * the same approach for the same reason.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/studio/sidebar.tsx", "utf8");
const DASHBOARD = "src/app/studio/(dashboard)";

/** Every `href: "/studio…"` the sidebar lists, in order. */
const navHrefs = [...source.matchAll(/href:\s*"(\/studio[^"]*)"/g)].map(
  (m) => m[1],
);

/**
 * Routes that exist but are deliberately not nav destinations. Each is reached
 * FROM a listed screen, so a sidebar entry would be a second door to the same
 * room:
 *   - `[id]`, `[key]` and `new` — a row you clicked, or a button you pressed;
 *   - the scraper's five workspaces — tabs inside `/studio/scraper`;
 *   - `catalog-fill/conflicts` — opened from the catalog-fill screen;
 *   - `inquiries/[id]/card` — the printable card for one commission.
 * The auth routes (login, signup, forgot/reset password) live outside
 * `(dashboard)` entirely and are never in a signed-in shell.
 */
function isNavDestination(route: string): boolean {
  if (route === "") return true; // the dashboard root, `/studio`
  if (route.includes("[")) return false;
  const segments = route.split("/");
  if (segments.length > 1) return false; // every nested page is opened FROM one
  return segments[0] !== "new";
}

/** Walk `(dashboard)` for directories holding a `page.tsx`. */
function routesUnder(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.some((e) => e.name === "page.tsx")) out.push(prefix);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    out.push(
      ...routesUnder(
        join(dir, entry.name),
        prefix ? `${prefix}/${entry.name}` : entry.name,
      ),
    );
  }
  return out;
}

const destinations = routesUnder(DASHBOARD)
  .filter(isNavDestination)
  .map((r) => (r ? `/studio/${r}` : "/studio"))
  .sort();

describe("studio sidebar", () => {
  it("lists every dashboard screen", () => {
    const missing = destinations.filter((href) => !navHrefs.includes(href));
    expect(missing, "screens with no way to reach them").toEqual([]);
  });

  it("lists nothing that is not a screen", () => {
    const orphans = navHrefs.filter((href) => !destinations.includes(href));
    expect(orphans, "nav entries pointing at no page").toEqual([]);
  });

  it("lists each screen exactly once", () => {
    const seen = new Map<string, number>();
    for (const href of navHrefs) seen.set(href, (seen.get(href) ?? 0) + 1);
    expect([...seen].filter(([, n]) => n > 1)).toEqual([]);
  });

  it("groups them under headings that describe the job, not the table", () => {
    // Pinned because the previous set did not: four site-content surfaces sat
    // under `catalog`, the scraper's analysis screens under `growth`, and
    // Process Steps and Materials in a two-item group whose own comment said
    // they belonged with Page Sections.
    const headings = [...source.matchAll(/heading:\s*"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(headings).toEqual([
      "today",
      "catalogue",
      "site content",
      "editorial",
      "research",
      "settings",
    ]);
  });
});
