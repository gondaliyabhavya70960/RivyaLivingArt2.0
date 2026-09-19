import { describe, expect, it } from "vitest";

import { retryAfterHeaders } from "./rate-limit";

/**
 * `Retry-After` is a CONTRACT with a client that cannot ask questions, and
 * every value it can take wrong is a value that still looks fine in a header
 * dump. RFC 9110 §10.2.3 wants delta-seconds: an integer, and one that
 * actually means "wait".
 *
 * The two that matter are the rounding direction and the floor. `Math.floor`
 * on a 0.4-second remainder yields `Retry-After: 0`, which is a legal
 * instruction to retry AT ONCE — the limiter's own answer telling the caller
 * to do the thing it just refused. Both limiters in this file already clamp
 * their `retryAfterSeconds` to at least 1, so this is the second lock on the
 * same door; headers are also built by hand elsewhere one day, and this is
 * the function that day should reach for.
 */
describe("retryAfterHeaders", () => {
  it("emits delta-seconds as an integer", () => {
    expect(retryAfterHeaders(30)).toEqual({ "retry-after": "30" });
  });

  it("rounds UP, so the header never expires before the window does", () => {
    // 30.2s of wait rounded down is a client that retries 0.2s early and is
    // refused again — a retry storm made of well-behaved clients.
    expect(retryAfterHeaders(30.2)["retry-after"]).toBe("31");
    expect(retryAfterHeaders(0.4)["retry-after"]).toBe("1");
  });

  it("never says zero, and never says NaN", () => {
    // `Retry-After: 0` means "retry now", which is never what a limiter
    // means. `Retry-After: NaN` is a header a proxy may simply drop, which
    // is the same outcome wearing a different cause.
    for (const value of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        retryAfterHeaders(value)["retry-after"],
        `retryAfterHeaders(${value})`,
      ).toBe("1");
    }
  });

  it("names the header in lower case, as fetch and NextResponse normalise it", () => {
    expect(Object.keys(retryAfterHeaders(1))).toEqual(["retry-after"]);
  });
});
