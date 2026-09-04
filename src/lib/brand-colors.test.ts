import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND } from "./brand-colors";

const tokensCss = readFileSync(
  join(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);

function cssHex(name: string): string {
  const match = tokensCss.match(
    new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"),
  );
  if (!match) throw new Error(`--${name} not found in tokens.css`);
  return match[1].toLowerCase();
}

// BRAND's v3 keys, mapped to the tokens.css custom property they mirror.
// This is the whole of BRAND now: the v2 `gold` alias was retired once its
// only consumer, the swatch table, took its own literal.
const TOKEN_NAME: Record<string, string> = {
  obsidian: "obsidian",
  deepOcean: "deep-ocean",
  sapphire: "sapphire",
  sapphireHi: "sapphire-hi",
  mineral: "mineral",
  sand: "sand",
  champagne: "champagne",
  ink: "ink",
  graphite: "graphite",
  mist: "mist",
  whatsapp: "whatsapp",
  alert: "alert",
  success: "success",
};

describe("BRAND vs tokens.css", () => {
  for (const [key, tokenName] of Object.entries(TOKEN_NAME)) {
    it(`${key} matches --${tokenName}`, () => {
      expect(BRAND[key as keyof typeof BRAND]).toBe(cssHex(tokenName));
    });
  }

  it("carries no key that is not a v3 palette role", () => {
    // The v2 "Midnight Gild" `gold` alias lived here until its own removal
    // condition — A3 migrating the swatch table — came due. Every remaining
    // key is a role mirrored against tokens.css above; a new one must be too,
    // or the OG images, the manifest, global-error and the email drift from
    // the palette the site actually renders.
    expect(Object.keys(BRAND).sort()).toEqual(Object.keys(TOKEN_NAME).sort());
  });
});
