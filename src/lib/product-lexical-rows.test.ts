import { describe, expect, it } from "vitest";

import {
  buildUpsertPayload,
  formSchema,
} from "@/components/studio/products/product-form/schema";
import { PRODUCT_LIMITS } from "@/lib/studio-limits";

/**
 * The client must count the rows the payload SENDS, not the rows on screen.
 * `buildUpsertPayload` drops any lexical row missing a label or a value, and
 * both "Add row" and the suggestion chips append exactly such a row — so a
 * bare `.max()` on the array refused eight filled rows plus one blank, a save
 * `upsertProductSchema` accepts. Found by the adversarial pass over the first
 * cut of this batch.
 */
function values(rows: { label: string; value: string }[]) {
  return {
    title: "A piece",
    displayName: "",
    shortTagline: "",
    description: "",
    categoryId: "cat_1",
    featured: false,
    status: "DRAFT" as const,
    priceMin: "",
    priceMax: "",
    showPrice: false,
    inStock: true,
    tier: "none" as const,
    sizeTier: "none" as const,
    timeline: "",
    materials: "",
    dimensions: "",
    occasions: [],
    lexical: rows,
    madeWith: [],
    careNotes: "",
    images: [],
    videoUrl: "",
    model3dUrl: "",
    customFields: [],
    seoTitle: "",
    seoDescription: "",
    ogImage: "",
    translations: {},
    confirmRewrite: false,
  };
}

const filled = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    label: `Label ${i + 1}`,
    value: `Value ${i + 1}`,
  }));

describe("the lexical row cap counts what is sent", () => {
  it("accepts the cap in filled rows", () => {
    const parsed = formSchema.safeParse(
      values(filled(PRODUCT_LIMITS.lexicalRows)),
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts a full set plus a blank row the payload will drop", () => {
    const parsed = formSchema.safeParse(
      values([...filled(PRODUCT_LIMITS.lexicalRows), { label: "", value: "" }]),
    );
    expect(parsed.success).toBe(true);
  });

  it("accepts a full set plus a suggestion chip's label-only row", () => {
    const parsed = formSchema.safeParse(
      values([
        ...filled(PRODUCT_LIMITS.lexicalRows),
        { label: "Pour story", value: "" },
      ]),
    );
    expect(parsed.success).toBe(true);
  });

  it("still refuses one filled row over the cap, and says so", () => {
    const parsed = formSchema.safeParse(
      values(filled(PRODUCT_LIMITS.lexicalRows + 1)),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      `Up to ${PRODUCT_LIMITS.lexicalRows} specification rows.`,
    );
  });

  it("sends exactly the rows it counted", () => {
    const parsed = formSchema.parse(
      values([...filled(PRODUCT_LIMITS.lexicalRows), { label: "", value: "" }]),
    );
    const payload = buildUpsertPayload(parsed, undefined);
    expect(payload.lexical).toHaveLength(PRODUCT_LIMITS.lexicalRows);
  });
});
