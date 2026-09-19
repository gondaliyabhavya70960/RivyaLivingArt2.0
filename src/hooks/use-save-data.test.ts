import { describe, expect, it } from "vitest";

import { prefersLessData } from "./use-save-data";

/**
 * The gate that decides whether a visitor downloads the 1.6 MB hero loop.
 *
 * Every case here is a person, and the two directions cost different things:
 * a false positive silently removes the brand's one piece of motion, and a
 * false negative spends someone's metered data on decoration.
 */
describe("prefersLessData", () => {
  it("says no when the browser cannot answer", () => {
    // Safari and Firefox do not implement navigator.connection. "Unknown" has
    // to behave exactly as today, or this ships a regression to two engines
    // in the name of saving bytes for neither.
    expect(prefersLessData(undefined)).toBe(false);
    expect(prefersLessData({})).toBe(false);
  });

  it("honours an explicit Data Saver request at any speed", () => {
    // Data Saver is a stated preference, not an inference — it outranks a
    // fast connection, because the visitor may be paying per megabyte on it.
    expect(prefersLessData({ saveData: true })).toBe(true);
    expect(prefersLessData({ saveData: true, effectiveType: "4g" })).toBe(true);
  });

  it("withholds on 2G-class connections", () => {
    expect(prefersLessData({ effectiveType: "slow-2g" })).toBe(true);
    expect(prefersLessData({ effectiveType: "2g" })).toBe(true);
  });

  it("does NOT withhold on 3G", () => {
    // 3G carries 1.6 MB in a few seconds. The bar for removing the one piece
    // of motion the brand has is an explicit request or a connection where the
    // loop would still be buffering after the visitor has gone.
    expect(prefersLessData({ effectiveType: "3g" })).toBe(false);
    expect(prefersLessData({ effectiveType: "4g" })).toBe(false);
  });

  it("treats a false saveData as no opinion, not as a demand for video", () => {
    expect(prefersLessData({ saveData: false, effectiveType: "2g" })).toBe(
      true,
    );
  });
});
