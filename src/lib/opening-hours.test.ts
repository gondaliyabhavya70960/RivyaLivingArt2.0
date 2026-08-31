import { describe, expect, it } from "vitest";

import { toOpeningHours } from "./opening-hours";

const row = (days: string, hours: string) => ({ days, hours });

describe("toOpeningHours", () => {
  it("converts what an owner actually types", () => {
    // En dash, because that is what the About page shows and what a word
    // processor produces.
    expect(toOpeningHours([row("Mon–Sat", "10:00–19:00")])).toEqual([
      "Mo-Sa 10:00-19:00",
    ]);
  });

  it("accepts full day names and a hyphen", () => {
    expect(toOpeningHours([row("Monday - Friday", "09:00-18:00")])).toEqual([
      "Mo-Fr 09:00-18:00",
    ]);
  });

  it("handles a list of separate days", () => {
    expect(toOpeningHours([row("Sat, Sun", "11:00-16:00")])).toEqual([
      "Sa,Su 11:00-16:00",
    ]);
    expect(toOpeningHours([row("Mon & Wed", "11:00-16:00")])).toEqual([
      "Mo,We 11:00-16:00",
    ]);
  });

  it("understands am/pm and pads the hour", () => {
    expect(toOpeningHours([row("Mon-Fri", "9am - 6pm")])).toEqual([
      "Mo-Fr 09:00-18:00",
    ]);
    expect(toOpeningHours([row("Mon-Fri", "9.30am-5.45pm")])).toEqual([
      "Mo-Fr 09:30-17:45",
    ]);
  });

  it("reads a bare opening hour against the closing one", () => {
    // "9 – 5pm" is nine in the MORNING; "1 – 5pm" is one in the afternoon.
    // The rule: a bare hour greater than the closing clock face belongs to the
    // other half of the day.
    expect(toOpeningHours([row("Mon-Fri", "9 – 5pm")])).toEqual([
      "Mo-Fr 09:00-17:00",
    ]);
    expect(toOpeningHours([row("Mon-Fri", "1 – 5pm")])).toEqual([
      "Mo-Fr 13:00-17:00",
    ]);
    expect(toOpeningHours([row("Mon-Fri", "10 – 7pm")])).toEqual([
      "Mo-Fr 10:00-19:00",
    ]);
    expect(toOpeningHours([row("Mon-Fri", "9 – 11am")])).toEqual([
      "Mo-Fr 09:00-11:00",
    ]);
  });

  it("leaves an unambiguous pair alone", () => {
    expect(toOpeningHours([row("Mon-Fri", "14:00-19:00")])).toEqual([
      "Mo-Fr 14:00-19:00",
    ]);
    expect(toOpeningHours([row("Mon-Fri", "10-19")])).toEqual([
      "Mo-Fr 10:00-19:00",
    ]);
  });

  it("gets midnight and noon right", () => {
    expect(toOpeningHours([row("Sun", "12am-12pm")])).toEqual([
      "Su 00:00-12:00",
    ]);
  });

  it("returns several lines for several rows", () => {
    expect(
      toOpeningHours([
        row("Mon–Fri", "10:00–19:00"),
        row("Sat", "11:00–16:00"),
      ]),
    ).toEqual(["Mo-Fr 10:00-19:00", "Sa 11:00-16:00"]);
  });

  it("drops a row it cannot parse rather than guessing", () => {
    // A malformed openingHours is reported as an error against the whole
    // LocalBusiness node, so silence beats a guess. The About page still shows
    // the owner's own words either way.
    const unparseable = [
      row("By appointment", "10:00-19:00"),
      row("Mon-Sat", "whenever we are in"),
      row("Mon-Sat", "10:00"),
      row("Mon-Sat", ""),
      row("", "10:00-19:00"),
      row("Mon-Funday", "10:00-19:00"),
      row("Mon-Sat", "25:00-26:00"),
      row("Mon-Sat", "10:75-19:00"),
    ];
    for (const bad of unparseable) {
      expect(toOpeningHours([bad]), JSON.stringify(bad)).toEqual([]);
    }
  });

  it("keeps the good rows when one is bad", () => {
    expect(
      toOpeningHours([
        row("Mon–Fri", "10:00–19:00"),
        row("Sunday", "by appointment"),
      ]),
    ).toEqual(["Mo-Fr 10:00-19:00"]);
  });

  it("returns nothing for no rows, so the caller omits the field", () => {
    expect(toOpeningHours([])).toEqual([]);
  });
});
