import { describe, expect, it } from "vitest";

import {
  canonicalFeatures,
  cosine,
  DUPLICATE_SIMILARITY_THRESHOLD,
  embedFeatures,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_VERSION,
  embeddingHash,
  priceBand,
  vectorToLiteral,
  type EmbeddingInput,
} from "@/lib/scraper/embedding";

/**
 * The attr-hash embedder, pure (B9). Every assertion is on literals: the
 * feature recipe, the hashing, the normalization, and the cosine arithmetic
 * the db test later proves pgvector agrees with.
 */

function input(overrides: Partial<EmbeddingInput> = {}): EmbeddingInput {
  return {
    title: "Blue River Console Table",
    category: "Consoles",
    materials: ["epoxy resin", "acacia wood"],
    league: "FINISHED_ART",
    referencePriceMinor: 60000_00,
    optionLabels: ["Small / Blue", "Large / Blue"],
    ...overrides,
  };
}

function vectorOf(i: EmbeddingInput): number[] {
  const v = embedFeatures(canonicalFeatures(i));
  if (!v) throw new Error("expected an embedding");
  return v;
}

describe("canonicalFeatures", () => {
  it("namespaces every feature by kind", () => {
    const features = canonicalFeatures(input());
    const prefixes = new Set(features.map((f) => f.feature.split(":")[0]));
    expect(prefixes).toEqual(new Set(["t", "cat", "m", "l", "p", "o"]));
  });

  it("weights identity ahead of hints: materials and category outvote title tokens", () => {
    const features = canonicalFeatures(input());
    const byPrefix = (p: string) =>
      features.find((f) => f.feature.startsWith(`${p}:`))?.weight;
    expect(byPrefix("m")).toBe(2.5);
    expect(byPrefix("cat")).toBe(2);
    expect(byPrefix("t")).toBe(1);
    expect(byPrefix("l")).toBe(1.5);
  });

  it("drops stopwords and short tokens from the title", () => {
    const features = canonicalFeatures(
      input({ title: "The Art of a New Table" }),
    );
    const tokens = features
      .filter((f) => f.feature.startsWith("t:"))
      .map((f) => f.feature);
    expect(tokens).toEqual(["t:art", "t:table"]);
  });

  it("a quote-only piece contributes NO price band — null is not a zero", () => {
    const features = canonicalFeatures(input({ referencePriceMinor: null }));
    expect(features.some((f) => f.feature.startsWith("p:"))).toBe(false);
  });

  it("caps option-label tokens so a variant matrix cannot flood the vector", () => {
    const labels = Array.from(
      { length: 40 },
      (_, i) => `option-variant-number-${i}`,
    );
    const features = canonicalFeatures(input({ optionLabels: labels }));
    // Only the first 20 labels are read: "option", "variant", "number" +
    // 20 numeric tokens.
    const options = features.filter((f) => f.feature.startsWith("o:"));
    expect(options.length).toBeLessThanOrEqual(24);
    expect(options.every((f) => f.weight === 0.75)).toBe(true);
  });
});

describe("priceBand", () => {
  it("bands by major INR units and refuses null", () => {
    expect(priceBand(null)).toBeNull();
    expect(priceBand(999_00)).toBe("under-1k");
    expect(priceBand(1000_00)).toBe("1k-5k");
    expect(priceBand(19_999_00)).toBe("5k-20k");
    expect(priceBand(60_000_00)).toBe("60k-150k");
    expect(priceBand(200_000_00)).toBe("over-150k");
  });
});

describe("embedFeatures", () => {
  it("is deterministic — the same features always hash to the same vector", () => {
    expect(vectorOf(input())).toEqual(vectorOf(input()));
  });

  it("returns the declared dimension, L2-normalized", () => {
    const v = vectorOf(input());
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    expect(norm).toBeCloseTo(1, 10);
  });

  it("no features means NO embedding, not a zero vector", () => {
    expect(embedFeatures([])).toBeNull();
    expect(
      embedFeatures(
        canonicalFeatures(
          input({
            title: "",
            category: null,
            materials: [],
            league: "",
            referencePriceMinor: null,
            optionLabels: [],
          }),
        ),
      ),
    ).toBeNull();
  });
});

describe("cosine over hashed vectors", () => {
  it("identical inputs score 1", () => {
    expect(cosine(vectorOf(input()), vectorOf(input()))).toBeCloseTo(1, 10);
  });

  it("disjoint inputs sit near zero", () => {
    const a = vectorOf(input());
    const b = vectorOf(
      input({
        title: "zzz qqq xxy",
        category: "wobble",
        materials: ["vibranium"],
        league: "MARKETPLACE_B2B",
        referencePriceMinor: 100_00,
        optionLabels: ["hue"],
      }),
    );
    expect(Math.abs(cosine(a, b))).toBeLessThan(0.25);
  });

  it("shared materials pull two otherwise-different pieces together", () => {
    const base = input({
      title: "aaa bbb ccc",
      category: "ddd",
      materials: ["epoxy resin"],
    });
    const sharesMaterial = input({
      title: "eee fff ggg",
      category: "hhh",
      materials: ["epoxy resin"],
    });
    const sharesNothing = input({
      title: "eee fff ggg",
      category: "hhh",
      materials: ["vibranium"],
    });
    expect(cosine(vectorOf(base), vectorOf(sharesMaterial))).toBeGreaterThan(
      cosine(vectorOf(base), vectorOf(sharesNothing)),
    );
  });

  it("near-identical listings across sources clear the duplicate threshold", () => {
    const a = vectorOf(input());
    const b = vectorOf(input({ title: "Blue River Console Table — Handmade" }));
    expect(cosine(a, b)).toBeGreaterThanOrEqual(
      DUPLICATE_SIMILARITY_THRESHOLD,
    );
  });
});

describe("embeddingHash", () => {
  it("is order-independent over the feature list", () => {
    const features = canonicalFeatures(input());
    const reversed = [...features].reverse();
    expect(embeddingHash(reversed)).toBe(embeddingHash(features));
  });

  it("changes when the identity text changes, and only then", () => {
    const before = embeddingHash(canonicalFeatures(input()));
    expect(embeddingHash(canonicalFeatures(input()))).toBe(before);
    const after = embeddingHash(
      canonicalFeatures(input({ materials: ["epoxy resin", "walnut"] })),
    );
    expect(after).not.toBe(before);
    expect(before).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("vectorToLiteral", () => {
  it("round-trips through text within storage precision", () => {
    const v = vectorOf(input());
    const parsed = vectorToLiteral(v)
      .slice(1, -1)
      .split(",")
      .map(Number);
    expect(parsed).toHaveLength(EMBEDDING_DIMENSIONS);
    for (let i = 0; i < v.length; i += 1) {
      expect(parsed[i]).toBeCloseTo(v[i], 5);
    }
  });
});

describe("embedder identity", () => {
  it("is named and versioned — a recipe change is a new generation, not a silent one", () => {
    expect(EMBEDDING_MODEL).toBe("attr-hash");
    expect(Number.isInteger(EMBEDDING_VERSION)).toBe(true);
    expect(EMBEDDING_VERSION).toBeGreaterThan(0);
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBeGreaterThan(0.5);
    expect(DUPLICATE_SIMILARITY_THRESHOLD).toBeLessThan(1);
  });
});
