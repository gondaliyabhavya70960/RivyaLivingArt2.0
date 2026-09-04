import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DUR_BASE_MS,
  DUR_FAST_MS,
  DUR_REVEAL_MS,
  DUR_SLOW_MS,
  EASE_LUXURY,
  EASE_SETTLE,
} from "./motion-tokens";

const tokensCss = readFileSync(
  join(process.cwd(), "src/styles/tokens.css"),
  "utf8",
);

function cssCubicBezier(name: string): [number, number, number, number] {
  const match = tokensCss.match(
    new RegExp(
      `--${name}:\\s*cubic-bezier\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\)`,
    ),
  );
  if (!match) throw new Error(`--${name} not found in tokens.css`);
  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ];
}

function cssDurationMs(name: string): number {
  const match = tokensCss.match(new RegExp(`--${name}:\\s*(\\d+)ms`));
  if (!match) throw new Error(`--${name} not found in tokens.css`);
  return Number(match[1]);
}

describe("motion-tokens vs tokens.css", () => {
  it("EASE_LUXURY matches --ease-luxury", () => {
    expect([...EASE_LUXURY]).toEqual(cssCubicBezier("ease-luxury"));
  });

  it("EASE_SETTLE matches --ease-settle", () => {
    expect([...EASE_SETTLE]).toEqual(cssCubicBezier("ease-settle"));
  });

  it("DUR_FAST_MS matches --dur-fast", () => {
    expect(DUR_FAST_MS).toBe(cssDurationMs("dur-fast"));
  });

  it("DUR_BASE_MS matches --dur-base", () => {
    expect(DUR_BASE_MS).toBe(cssDurationMs("dur-base"));
  });

  it("DUR_SLOW_MS matches --dur-slow", () => {
    expect(DUR_SLOW_MS).toBe(cssDurationMs("dur-slow"));
  });

  it("DUR_REVEAL_MS matches --dur-reveal", () => {
    expect(DUR_REVEAL_MS).toBe(cssDurationMs("dur-reveal"));
  });
});
