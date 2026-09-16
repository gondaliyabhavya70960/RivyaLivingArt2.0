import { describe, expect, it } from "vitest";

import {
  FRESHNESS_WINDOW_DAYS,
  MARKET_DEPTH_TARGET,
  OPPORTUNITY_COMPONENTS,
  OPPORTUNITY_WEIGHTS,
  opportunityTotal,
  OPTION_RICHNESS_TARGET,
  PRICE_FIT_FALLOFF,
  scoreOpportunity,
  type OpportunityInput,
} from "@/lib/scraper/opportunity";

/**
 * The opportunity score, pure (B8). Rule 7 is the design: there is no score,
 * only components — every input below is a literal, and every assertion is
 * on a named component's value, weight, contribution, or detail string.
 */

const NOW = new Date("2026-09-16T00:00:00Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function input(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    referencePriceMinor: 60000_00,
    benchmarkMedianMinor: 60000_00,
    benchmarkDesigns: MARKET_DEPTH_TARGET,
    lastSeen: NOW,
    comparableVariantCount: OPTION_RICHNESS_TARGET,
    now: NOW,
    ...overrides,
  };
}

function component(
  components: ReturnType<typeof scoreOpportunity>,
  name: (typeof OPPORTUNITY_COMPONENTS)[number],
) {
  const found = components.find((c) => c.component === name);
  if (!found) throw new Error(`missing component ${name}`);
  return found;
}

describe("scoreOpportunity", () => {
  it("always returns the four components, in display order", () => {
    const components = scoreOpportunity(input());
    expect(components.map((c) => c.component)).toEqual([
      "market-depth",
      "price-fit",
      "freshness",
      "option-richness",
    ]);
  });

  it("records the named weight on every row, and the weights sum to 1", () => {
    const components = scoreOpportunity(input());
    for (const c of components) {
      expect(c.weight).toBe(OPPORTUNITY_WEIGHTS[c.component]);
    }
    const total = Object.values(OPPORTUNITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("an ideal input totals 1.0 — the ceiling is reachable, not theoretical", () => {
    const total = opportunityTotal(scoreOpportunity(input()));
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("market depth", () => {
  it("scales linearly with the designs the benchmark stands on", () => {
    const c = component(
      scoreOpportunity(input({ benchmarkDesigns: 12 })),
      "market-depth",
    );
    expect(c.value).toBeCloseTo(12 / MARKET_DEPTH_TARGET, 10);
    expect(c.contribution).toBeCloseTo(
      (12 / MARKET_DEPTH_TARGET) * OPPORTUNITY_WEIGHTS["market-depth"],
      10,
    );
    expect(c.detail).toContain("12 comparable design(s)");
  });

  it("caps at full marks — a deeper market is not more than proven", () => {
    const c = component(
      scoreOpportunity(input({ benchmarkDesigns: MARKET_DEPTH_TARGET * 4 })),
      "market-depth",
    );
    expect(c.value).toBe(1);
  });

  it("an empty benchmark is an unproven market, and the detail says so", () => {
    const c = component(
      scoreOpportunity(input({ benchmarkDesigns: 0 })),
      "market-depth",
    );
    expect(c.value).toBe(0);
    expect(c.detail).toContain("unproven market");
  });
});

describe("price fit", () => {
  it("is symmetric in log space — 2× above the median fits like 2× below", () => {
    const above = component(
      scoreOpportunity(input({ referencePriceMinor: 120000_00 })),
      "price-fit",
    );
    const below = component(
      scoreOpportunity(input({ referencePriceMinor: 30000_00 })),
      "price-fit",
    );
    expect(above.value).toBeCloseTo(below.value ?? NaN, 10);
    expect(above.value).toBeCloseTo(
      1 - Math.log(2) / Math.log(PRICE_FIT_FALLOFF),
      10,
    );
  });

  it("decays to zero at 3× off the median, in either direction", () => {
    const atFalloff = component(
      scoreOpportunity(
        input({ referencePriceMinor: 60000_00 * PRICE_FIT_FALLOFF }),
      ),
      "price-fit",
    );
    expect(atFalloff.value).toBeCloseTo(0, 10);
    const beyond = component(
      scoreOpportunity(input({ referencePriceMinor: 60000_00 * 9 })),
      "price-fit",
    );
    expect(beyond.value).toBe(0);
  });

  it("a quote-only piece has no price fit — null with contribution 0, never a guess", () => {
    const c = component(
      scoreOpportunity(input({ referencePriceMinor: null })),
      "price-fit",
    );
    expect(c.value).toBeNull();
    expect(c.contribution).toBe(0);
    expect(c.detail).toContain("not guessed");
  });

  it("a league with no benchmark has no median to fit against", () => {
    const c = component(
      scoreOpportunity(input({ benchmarkMedianMinor: null })),
      "price-fit",
    );
    expect(c.value).toBeNull();
    expect(c.contribution).toBe(0);
    expect(c.detail).toContain("no price benchmark");
  });
});

describe("freshness", () => {
  it("decays linearly across the window and floors at zero", () => {
    const fresh = component(scoreOpportunity(input()), "freshness");
    expect(fresh.value).toBe(1);

    const half = component(
      scoreOpportunity(input({ lastSeen: daysAgo(FRESHNESS_WINDOW_DAYS / 2) })),
      "freshness",
    );
    expect(half.value).toBeCloseTo(0.5, 10);

    const stale = component(
      scoreOpportunity(input({ lastSeen: daysAgo(FRESHNESS_WINDOW_DAYS * 2) })),
      "freshness",
    );
    expect(stale.value).toBe(0);
    expect(stale.contribution).toBe(0);
  });
});

describe("option richness", () => {
  it("scales to full marks at the target and caps there", () => {
    const half = component(
      scoreOpportunity(
        input({ comparableVariantCount: OPTION_RICHNESS_TARGET / 2 }),
      ),
      "option-richness",
    );
    expect(half.value).toBeCloseTo(0.5, 10);

    const full = component(
      scoreOpportunity(
        input({ comparableVariantCount: OPTION_RICHNESS_TARGET * 3 }),
      ),
      "option-richness",
    );
    expect(full.value).toBe(1);
  });
});

describe("opportunityTotal", () => {
  it("is the sum of contributions — computable from the rows, never stored", () => {
    const components = scoreOpportunity(input({ benchmarkDesigns: 0 }));
    const expected = components.reduce((a, c) => a + c.contribution, 0);
    expect(opportunityTotal(components)).toBeCloseTo(expected, 10);
    expect(opportunityTotal([])).toBe(0);
  });
});
