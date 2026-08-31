import { describe, expect, it } from "vitest";

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
