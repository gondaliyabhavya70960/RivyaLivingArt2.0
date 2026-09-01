import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import gu from "../../messages/gu.json";
import zh from "../../messages/zh.json";
import ja from "../../messages/ja.json";
import ar from "../../messages/ar.json";
import de from "../../messages/de.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";

describe("Search.productsShowMore non-quantified label (Prompt Deck Decision 2)", () => {
  it("does not quantify with {total} or art-only piece terms in English", () => {
    const enVal = en.Search.productsShowMore;
    expect(enVal).not.toContain("{total");
    expect(enVal).not.toContain("piece");
  });

  it("does not quantify with {total} or art piece nouns across all 8 other locales", () => {
    const locales = [
      { code: "hi", val: hi.Search.productsShowMore, forbidden: ["{total", "कृतियाँ", "कृति"] },
      { code: "gu", val: gu.Search.productsShowMore, forbidden: ["{total", "કૃતિઓ", "કૃતિ"] },
      { code: "zh", val: zh.Search.productsShowMore, forbidden: ["{total", "件作品"] },
      { code: "ja", val: ja.Search.productsShowMore, forbidden: ["{total", "点の作品"] },
      { code: "ar", val: ar.Search.productsShowMore, forbidden: ["{total", "قطعة"] },
      { code: "de", val: de.Search.productsShowMore, forbidden: ["{total", "Stücke", "Stück"] },
      { code: "es", val: es.Search.productsShowMore, forbidden: ["{total", "piezas", "pieza"] },
      { code: "fr", val: fr.Search.productsShowMore, forbidden: ["{total", "pièces", "pièce"] },
    ];

    for (const { code, val, forbidden } of locales) {
      for (const term of forbidden) {
        expect(val, `${code} should not contain ${term}`).not.toContain(term);
      }
    }
  });
});
