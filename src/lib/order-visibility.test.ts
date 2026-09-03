import { describe, expect, it } from "vitest";

import { canOrderProduct } from "./order-visibility";

/**
 * Regression cover for SEC-201: `submitProductOrder` loaded a product by the
 * client-supplied id and never checked its status, so an anonymous caller who
 * learned a DRAFT product's cuid could file an order against unreleased stock
 * — and receive its title back in the generated WhatsApp message. The public
 * product page refused to render such a product, but a Server Action is a POST
 * endpoint reachable without the page, so that was never the control.
 */
describe("canOrderProduct", () => {
  it("lets a visitor order a published product", () => {
    expect(
      canOrderProduct({ status: "PUBLISHED", previewEnabled: false }),
    ).toBe(true);
  });

  it("refuses a draft product for a visitor (SEC-201)", () => {
    expect(canOrderProduct({ status: "DRAFT", previewEnabled: false })).toBe(
      false,
    );
  });

  it("lets staff order a draft product inside preview", () => {
    // Draft mode is minted only by /api/draft behind requireStaff(), so
    // previewEnabled implies a verified staff session.
    expect(canOrderProduct({ status: "DRAFT", previewEnabled: true })).toBe(
      true,
    );
  });

  it("still lets staff order a published product inside preview", () => {
    expect(canOrderProduct({ status: "PUBLISHED", previewEnabled: true })).toBe(
      true,
    );
  });

  it("refuses any status that is not exactly PUBLISHED", () => {
    // ContentStatus grew REVIEW and ARCHIVED (migration 20260904101000);
    // neither is orderable, and any future member fails closed the same way.
    for (const status of ["REVIEW", "ARCHIVED", "SCHEDULED", "published", "", "draft"]) {
      expect(canOrderProduct({ status, previewEnabled: false })).toBe(false);
    }
  });

  /**
   * In-stock state is deliberately NOT part of this predicate. An out-of-stock
   * PUBLISHED piece still records an enquiry (audit H2) — the studio wants the
   * restock conversation — it just opens with the availability-enquiry framing.
   */
  it("does not conflate availability with orderability", () => {
    expect(
      canOrderProduct({ status: "PUBLISHED", previewEnabled: false }),
    ).toBe(true);
  });
});
