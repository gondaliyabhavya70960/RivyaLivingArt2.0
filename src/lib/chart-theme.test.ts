import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHART_AREA_GRADIENT, CHART_AXIS_TICK, CHART_INK } from "./chart-theme";

/**
 * The chart vocabulary stays a vocabulary.
 *
 * Two halves, and the second is the one that matters: recharts takes colours
 * as plain strings, so a hex in a chart component compiles, renders and
 * passes every gate this repo has — `redesign-audit.mjs` judges classes in
 * the DOM and an SVG `stroke` attribute is not one.
 */
describe("chart theme", () => {
  it("names only tokens", () => {
    for (const [name, value] of Object.entries(CHART_INK)) {
      expect(value, `CHART_INK.${name}`).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
    expect(CHART_AXIS_TICK.fill).toBe(CHART_INK.axis);
  });

  it("fades the area to nothing at the baseline", () => {
    // A gradient that stops short leaves a hard edge along the axis, which
    // reads as a second gridline.
    expect(CHART_AREA_GRADIENT.at(-1)?.opacity).toBe(0);
  });

  it("leaves the chart component with no colours of its own", () => {
    const src = readFileSync(
      join(__dirname, "../components/studio/dashboard/inquiries-chart.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(src, "raw hex in a chart").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Every `var(--…)` the chart paints with has to come from this module, so
    // a second chart cannot quietly pick a different blue.
    expect(
      src,
      "a token reference declared in the chart instead of chart-theme.ts",
    ).not.toMatch(/"var\(--/);
    expect(src).toContain("CHART_INK");
  });
});
