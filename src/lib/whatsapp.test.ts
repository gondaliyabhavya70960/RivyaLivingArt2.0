import { describe, expect, it } from "vitest";

import { SITE } from "@/lib/constants";
import { buildWaLink, formatInquiryNumber } from "@/lib/whatsapp";

describe("buildWaLink", () => {
  it("targets the house number by default (Part 0 hard rule)", () => {
    expect(buildWaLink()).toBe("https://wa.me/917096036250");
  });

  it("URL-encodes the pre-filled message", () => {
    expect(buildWaLink("Hello there & welcome")).toBe(
      "https://wa.me/917096036250?text=Hello%20there%20%26%20welcome",
    );
  });

  it("accepts an explicit number for customer-reply links", () => {
    expect(buildWaLink("Hi", "911234567890")).toBe(
      "https://wa.me/911234567890?text=Hi",
    );
  });
});

describe("formatInquiryNumber", () => {
  it("renders the customer-facing RR reference", () => {
    expect(formatInquiryNumber(42)).toBe("#RR-42");
  });
});

/**
 * The number reaching `buildWaLink` is usually the studio-configured value —
 * typed by an owner into Site Settings, not a constant. The live site was
 * serving `wa.me/+917096036250` because that field holds the leading `+`.
 *
 * wa.me documents a bare international number. A `+` is merely non-canonical,
 * but a space or dash would break the URL outright — and this is the Place
 * Order path, so a broken link loses the order silently.
 */
describe("buildWaLink number sanitisation", () => {
  it("strips a leading + from a studio-configured number", () => {
    expect(buildWaLink(undefined, "+917096036250")).toBe(
      "https://wa.me/917096036250",
    );
  });

  it("strips spaces, dashes and brackets an owner might type", () => {
    for (const typed of [
      "+91 70960 36250",
      "+91-70960-36250",
      "(+91) 7096036250",
      " 917096036250 ",
    ]) {
      expect(buildWaLink(undefined, typed)).toBe("https://wa.me/917096036250");
    }
  });

  it("falls back to the site number when the configured value has no digits", () => {
    for (const junk of ["", "   ", "+", "n/a"]) {
      expect(buildWaLink(undefined, junk)).toBe(
        `https://wa.me/${SITE.whatsappNumber}`,
      );
    }
  });

  it("keeps the message parameter intact while sanitising the number", () => {
    expect(buildWaLink("hello there", "+91 7096036250")).toBe(
      "https://wa.me/917096036250?text=hello%20there",
    );
  });
});
