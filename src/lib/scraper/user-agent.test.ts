/**
 * The crawler identifies itself honestly.
 *
 * This is a governance rule, not a style one, so it gets a test rather than a
 * comment. The default User-Agent was a Chrome string for a documented
 * reason — bot protection 403s an identifying crawler — which made it a
 * stealth mechanism and made `robots.ts` incoherent: rules written for our
 * token could never match the name we actually sent.
 *
 * `SCRAPER_UA` reads an env var at module load, so these assertions describe
 * the DEFAULT — what ships when nobody sets `SCRAPER_USER_AGENT`. The source
 * is read as text for exactly that reason.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { SCRAPER_BOT_TOKEN } from "@/lib/scraper/types";

const typesSource = readFileSync("src/lib/scraper/types.ts", "utf8");
const robotsSource = readFileSync("src/lib/scraper/robots.ts", "utf8");

describe("scraper identity", () => {
  it("names itself", () => {
    expect(SCRAPER_BOT_TOKEN).toBe("RivyaLivingArtResearchBot");
  });

  it("does not default to a browser User-Agent", () => {
    // Any of these in the default means someone put the disguise back.
    const defaultUa = typesSource.slice(
      typesSource.indexOf("const DEFAULT_SCRAPER_UA"),
      typesSource.indexOf("export const SCRAPER_UA"),
    );
    expect(defaultUa).not.toMatch(/Mozilla|AppleWebKit|Chrome|Safari|Gecko/i);
  });

  it("builds the default User-Agent from the bot token", () => {
    expect(typesSource).toMatch(
      /const DEFAULT_SCRAPER_UA\s*=\s*`\$\{SCRAPER_BOT_TOKEN\}/,
    );
  });

  it("carries a contact URL so an operator can reach us", () => {
    const defaultUa = typesSource.slice(
      typesSource.indexOf("const DEFAULT_SCRAPER_UA"),
      typesSource.indexOf("export const SCRAPER_UA"),
    );
    expect(defaultUa).toMatch(/\(\+https:\/\/[^)]+\)/);
  });

  it("obeys robots rules written for the name it sends", () => {
    // The two must come from one constant. A second string literal here is
    // how "we honour robots.txt" quietly stops being true.
    expect(robotsSource).toMatch(
      /const BOT_TOKEN = SCRAPER_BOT_TOKEN\.toLowerCase\(\)/,
    );
    expect(robotsSource).not.toMatch(/const BOT_TOKEN = ["']/);
  });
});
