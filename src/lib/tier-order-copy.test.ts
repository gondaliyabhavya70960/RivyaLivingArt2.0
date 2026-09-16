import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { PRODUCT_SIZE_TIERS } from "@/lib/product-size-tier";
import {
  selectOrderCopy,
  tierOrderCopy,
  tierOrderCopyKey,
} from "@/lib/tier-order-copy";
import {
  buildOrderMessage,
  ENGLISH_ORDER_LABELS,
  withDemoPrefix,
} from "@/lib/whatsapp";

/**
 * Workstream E step 8: the per-tier order-panel presets. What these pin is
 * the property the step was chosen for — "server-resolved copy can reframe
 * the CTA, the summary and the WhatsApp intro with a byte-identical payload"
 * — plus the precedence rule the panel and the Server Action share, and the
 * two honesty rules on the words themselves (T1 resolved, T9 open).
 */
type Block = Record<string, Record<string, string>>;
const en = JSON.parse(
  readFileSync(join(process.cwd(), "messages/en.json"), "utf8"),
) as { ProductTier: Block; WhatsApp: { intro: string } };

const enLookup = (key: string): string => {
  const [tier, leaf] = key.split(".");
  const value = en.ProductTier[tier]?.[leaf];
  if (!value) throw new Error(`missing ProductTier key ${key}`);
  return value;
};

describe("tierOrderCopy", () => {
  it("gives the untiered backlog no preset and never asks the catalog", () => {
    const lookup = vi.fn();
    expect(tierOrderCopy(null, lookup)).toBeNull();
    expect(tierOrderCopy(undefined, lookup)).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });

  it("builds its keys from the enum value — the list lives once", () => {
    expect(tierOrderCopyKey("LARGE_FORMAT", "cta")).toBe(
      "LARGE_FORMAT.primaryCta",
    );
    expect(tierOrderCopyKey("MEDIUM_FORMAT", "summaryNote")).toBe(
      "MEDIUM_FORMAT.orderSummaryNote",
    );
    expect(tierOrderCopyKey("SMALL_FORMAT", "waIntro")).toBe(
      "SMALL_FORMAT.orderWaIntro",
    );
  });

  it("resolves three non-empty strings for every tier from the English catalog", () => {
    for (const tier of PRODUCT_SIZE_TIERS) {
      const copy = tierOrderCopy(tier, enLookup);
      expect(copy?.cta).toBeTruthy();
      expect(copy?.summaryNote).toBeTruthy();
      expect(copy?.waIntro).toBeTruthy();
    }
  });

  it("keeps every CTA inside the registry budget and never promises a cart, a checkout or a consultation", () => {
    // T1 (resolved: no cart, no checkout) and T9 (open: no Inquiry column
    // can record a booked consultation), as an executable rule.
    for (const tier of PRODUCT_SIZE_TIERS) {
      const cta = tierOrderCopy(tier, enLookup)!.cta;
      expect(cta.length).toBeLessThanOrEqual(60);
      expect(cta).not.toMatch(/\b(cart|checkout|basket|pay)\b/i);
      expect(cta).not.toMatch(/\b(consult|quote|book|schedule|appointment)/i);
    }
  });

  it("makes Tier 03 the default order flow, not a reframing of it", () => {
    // Personal Art & Gifting IS fast WhatsApp ordering (Part 0, T1), so its
    // intro is byte-equal to the site's default order intro.
    expect(tierOrderCopy("SMALL_FORMAT", enLookup)!.waIntro).toBe(
      en.WhatsApp.intro,
    );
    expect(en.WhatsApp.intro).toBe(ENGLISH_ORDER_LABELS.intro);
  });
});

describe("selectOrderCopy — the precedence rule", () => {
  const oos = { cta: "oos", summaryNote: "oos", waIntro: "oos" };
  const tier = { cta: "tier", summaryNote: "tier", waIntro: "tier" };

  it("lets out of stock win over the tier — a fact outranks a framing", () => {
    expect(
      selectOrderCopy({ inStock: false, oosCopy: oos, tierCopy: tier }),
    ).toBe(oos);
  });

  it("takes the tier when the piece is in stock", () => {
    expect(
      selectOrderCopy({ inStock: true, oosCopy: oos, tierCopy: tier }),
    ).toBe(tier);
  });

  it("changes nothing when nothing is set", () => {
    expect(
      selectOrderCopy({ inStock: true, oosCopy: null, tierCopy: null }),
    ).toBeNull();
  });
});

describe("the byte-identical payload", () => {
  const input = {
    productTitle: "Geode Side Table · Studio Concept",
    selections: [
      { label: "Size", value: "16 inch" },
      { label: "Resin colour", value: "Ivory" },
    ],
    referenceImageUrls: [],
    notes: "For a reading corner.",
    customer: { name: "A. Visitor", phone: "+91 90000 00000" },
  };

  it("is exactly the message the panel built before presets existed, for an untiered piece", () => {
    const copy = selectOrderCopy({
      inStock: true,
      oosCopy: null,
      tierCopy: null,
    });
    const labels = copy
      ? { ...ENGLISH_ORDER_LABELS, intro: copy.waIntro }
      : ENGLISH_ORDER_LABELS;
    expect(buildOrderMessage(input, labels)).toBe(
      buildOrderMessage(input, ENGLISH_ORDER_LABELS),
    );
  });

  it("is exactly that message for a Tier 03 piece too", () => {
    const copy = selectOrderCopy({
      inStock: true,
      oosCopy: null,
      tierCopy: tierOrderCopy("SMALL_FORMAT", enLookup),
    });
    const labels = copy
      ? { ...ENGLISH_ORDER_LABELS, intro: copy.waIntro }
      : ENGLISH_ORDER_LABELS;
    expect(buildOrderMessage(input, labels)).toBe(
      buildOrderMessage(input, ENGLISH_ORDER_LABELS),
    );
  });

  it("opens a Tier 01 message with the commission intro and keeps the demo prefix first", () => {
    // What scripts/e2e-smoke.mjs reads off the wa.me URL for
    // demo-product-001, which is LARGE: "[DEMO] " first, then the intro,
    // then the selections it asserts on ("16 inch").
    const copy = selectOrderCopy({
      inStock: true,
      oosCopy: null,
      tierCopy: tierOrderCopy("LARGE_FORMAT", enLookup),
    })!;
    const message = buildOrderMessage(input, {
      ...ENGLISH_ORDER_LABELS,
      intro: copy.waIntro,
    });
    expect(
      message.startsWith(`${en.ProductTier.LARGE_FORMAT.orderWaIntro}\n`),
    ).toBe(true);
    expect(message).toContain("16 inch");
    expect(
      withDemoPrefix(message, true).startsWith(
        "[DEMO] Hello Rivya Living Art,",
      ),
    ).toBe(true);
  });
});
