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

/**
 * D30 SPLIT THIS CONTRACT IN TWO, and both halves are still asserted.
 *
 * The original rule was one sentence — every BRAND value mirrors the token of
 * the same name, so the OG cards, the manifest, `global-error` and the email
 * can never drift from the palette the site renders. D30 (tokens.css) made
 * that rule false for five keys, because it re-pointed five tokens to their
 * dark-ground values while owner decision 5 locked this file: "OG images and
 * email keep their fixed look."
 *
 * Relaxing the test to match would have deleted the coverage instead of
 * updating it, so the keys are split by WHICH GROUND THEIR CONSUMER PAINTS ON.
 */

/**
 * Keys whose consumers paint on the DARK ground the site now uses everywhere:
 * the OG gradient, the manifest's theme colour, the root error boundary.
 * These still mirror tokens.css by name, and the anchors D30 deliberately did
 * not move are exactly this list.
 */
const TOKEN_NAME: Record<string, string> = {
  obsidian: "obsidian",
  deepOcean: "deep-ocean",
  sapphire: "sapphire",
  sapphireHi: "sapphire-hi",
  mineral: "mineral",
  champagne: "champagne",
  mist: "mist",
  whatsapp: "whatsapp",
};

/**
 * Keys PINNED to their pre-D30 values, because their consumer is a surface
 * D30 did not re-theme and could not have.
 *
 * The password-reset email (`src/lib/email.ts`) is the one that makes this
 * concrete and the one that would have broken silently: it is a light
 * document — a bare `<div>` on whatever ground the recipient's mail client
 * supplies, which is white in every major client and is not ours to choose.
 * It sets `color: BRAND.ink` for its body and `BRAND.graphite` for three
 * secondary lines. Had these followed tokens.css into the dark scheme, the
 * email would have rendered #f4f1e9 on #ffffff — a blank message, delivered,
 * with nothing failing anywhere.
 *
 * `sand`, `alert` and `success` have no consumer outside this file today.
 * They are pinned rather than deleted so the palette stays complete for the
 * next fixed-surface consumer, and pinned rather than mirrored because such a
 * consumer would be another Satori card or another email — a fixed light or
 * fixed dark ground, never the themed one.
 */
const PINNED: Record<string, string> = {
  sand: "#e7e0d5",
  ink: "#12141a",
  graphite: "#5b6068",
  alert: "#9b3a2e",
  success: "#2c6b5b",
};

describe("BRAND vs tokens.css", () => {
  for (const [key, tokenName] of Object.entries(TOKEN_NAME)) {
    it(`${key} matches --${tokenName}`, () => {
      expect(BRAND[key as keyof typeof BRAND]).toBe(cssHex(tokenName));
    });
  }

  for (const [key, value] of Object.entries(PINNED)) {
    it(`${key} stays pinned at its fixed-surface value`, () => {
      expect(BRAND[key as keyof typeof BRAND]).toBe(value);
    });
  }

  it("pins exactly the keys whose token moved under D30", () => {
    // The two lists are a partition, not a suggestion: a key that appears in
    // neither is a value nothing checks, and a key in both is a contradiction.
    // This also fails the moment someone "fixes" a pinned key by pointing it
    // back at a token — the mirrored list would then be missing it.
    for (const key of Object.keys(PINNED)) {
      expect(TOKEN_NAME[key]).toBeUndefined();
    }
  });

  it("carries no key that is not a v3 palette role", () => {
    // The v2 "Midnight Gild" `gold` alias lived here until its own removal
    // condition — A3 migrating the swatch table — came due. Every remaining
    // key is either mirrored against tokens.css or pinned above; a new one
    // must be one or the other, or the OG images, the manifest, global-error
    // and the email drift from the ground they actually paint on.
    expect(Object.keys(BRAND).sort()).toEqual(
      [...Object.keys(TOKEN_NAME), ...Object.keys(PINNED)].sort(),
    );
  });
});
