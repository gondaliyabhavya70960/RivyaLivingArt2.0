import { describe, expect, it } from "vitest";

import { inquiryReplyGreeting, inquiryReplyWaLink } from "./inquiry-reply";

describe("inquiryReplyGreeting", () => {
  it("greets by FIRST name and names the source in lower case", () => {
    expect(
      inquiryReplyGreeting({
        customerName: "Aditi Sharma",
        source: "CUSTOM_ORDER",
      }),
    ).toBe(
      "Hi Aditi, thanks for reaching out to Rivya Living Art about your custom order.",
    );
  });

  it("falls back to the whole name when there is no space to split on", () => {
    expect(inquiryReplyGreeting({ customerName: "Ravi", source: "PRODUCT" })).toContain(
      "Hi Ravi,",
    );
  });

  it("does not leave a blank name when the field is whitespace", () => {
    // `"".split(/\s+/)[0]` is `""`, which would render "Hi , thanks…".
    expect(
      inquiryReplyGreeting({ customerName: "   ", source: "CONTACT" }),
    ).toBe(
      "Hi    , thanks for reaching out to Rivya Living Art about your contact.",
    );
  });
});

describe("inquiryReplyWaLink", () => {
  it("goes to the CUSTOMER's number, digits only (UIUX-604)", () => {
    const link = inquiryReplyWaLink({
      customerName: "Aditi Sharma",
      source: "PRODUCT",
      phone: "+91 98765 43210",
    });
    expect(link.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    // never the studio's own number
    expect(link).not.toContain("917096036250");
  });

  it("carries the greeting as the prefilled text", () => {
    const link = inquiryReplyWaLink({
      customerName: "Ravi",
      source: "CONTACT",
      phone: "919999999999",
    });
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(
      inquiryReplyGreeting({ customerName: "Ravi", source: "CONTACT" }),
    );
  });
});
