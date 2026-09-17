/**
 * Canonical catalog taxonomy for the four-tier owner-sheet import.
 *
 * The sheet's per-source category vocabularies are messy ("bangle",
 * "Diwali Resin Update", "Fastners", …) — every imported row is mapped onto
 * either one of the 16 owner-seeded categories or one of the eight canonical
 * categories below. Keyword rules are ordered; the first hit wins. The
 * mapper never invents data — it only routes rows to a browsable shelf.
 *
 * Slug prefixes carry the ecosystem grouping (`supplies-*`, `print-*`) since
 * Category is flat; CATALOG_GROUPS is the presentation-layer grouping used
 * by the mega-menu and the shop's ecosystem filter.
 */

type CanonicalCategory = {
  slug: string;
  name: string;
  description: string;
  image?: string;
  translations: Record<string, { name: string; description?: string }>;
};

export const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  {
    slug: "gift-collections",
    name: "Gift Collections",
    description:
      "Curated hampers and gift sets — resin keepsakes composed and wrapped for gifting.",
    // §15.4's own "Gift / keepsake" master. It was generated FOR the homepage
    // collections band and then never reached it, because that band paints
    // `Category.image` and this default still pointed at the superseded v6
    // artwork. Existing rows keep whatever the owner or the Cloudinary
    // reconcile put there — this is the value a fresh environment seeds.
    image: "/media/v3/tile-gift.avif",
    translations: {
      hi: {
        name: "उपहार संग्रह",
        description:
          "चुने हुए हैम्पर और उपहार सेट — भेंट के लिए सजाए गए रेज़िन स्मृति-चिह्न।",
      },
      gu: {
        name: "ભેટ સંગ્રહ",
        description:
          "પસંદ કરેલા હેમ્પર અને ગિફ્ટ સેટ — ભેટ માટે તૈયાર રેઝિન યાદગીરી.",
      },
      ar: {
        name: "مجموعات الهدايا",
        description:
          "سلال وأطقم هدايا منسقة — تذكارات راتنج مُعدّة للإهداء.",
      },
      de: {
        name: "Geschenk-Kollektionen",
        description:
          "Kuratierte Präsentkörbe und Geschenksets aus Harz, fertig zum Verschenken.",
      },
      es: {
        name: "Colecciones de regalo",
        description:
          "Cestas y sets de regalo seleccionados — recuerdos de resina listos para regalar.",
      },
      fr: {
        name: "Collections cadeaux",
        description:
          "Paniers et coffrets choisis — des pièces en résine pensées pour offrir.",
      },
      ja: {
        name: "ギフトコレクション",
        description:
          "厳選のギフトセット — 贈り物のためのレジン作品。",
      },
      zh: {
        name: "礼品系列",
        description: "精选礼盒与礼品套装 — 为馈赠而备的树脂纪念品。",
      },
    },
  },
  {
    slug: "festive-pooja",
    name: "Festive & Pooja",
    description:
      "Diwali décor, Ganesh idols, pooja thalis and deity accessories cast in resin.",
    image: "/media/v6/collection-resin-art.webp",
    translations: {
      hi: {
        name: "त्योहार और पूजा",
        description:
          "दिवाली सजावट, गणेश प्रतिमाएँ, पूजा थालियाँ और रेज़िन में ढले देव-श्रृंगार।",
      },
      gu: {
        name: "તહેવાર અને પૂજા",
        description:
          "દિવાળી શણગાર, ગણેશ મૂર્તિઓ, પૂજા થાળી અને રેઝિનમાં બનેલી દેવ-સામગ્રી.",
      },
      ar: {
        name: "الأعياد والبوجا",
        description:
          "زينة ديوالي وتماثيل غانيش وصواني بوجا مصبوبة من الراتنج.",
      },
      de: { name: "Fest & Pooja" },
      es: { name: "Festivo y Pooja" },
      fr: { name: "Fêtes & Pooja" },
      ja: { name: "祝祭とプージャ" },
      zh: { name: "节庆与普迦" },
    },
  },
  {
    slug: "supplies-pigments",
    name: "Pigments & Powders",
    description:
      "Mica powders, opaque pigments, transparent tints, glitters and glow powders for resin work.",
    image: "/media/v6/collection-supplies.webp",
    translations: {
      hi: {
        name: "पिगमेंट और पाउडर",
        description:
          "रेज़िन कला के लिए माइका पाउडर, अपारदर्शी पिगमेंट, पारदर्शी टिंट, ग्लिटर और ग्लो पाउडर।",
      },
      gu: {
        name: "પિગમેન્ટ અને પાવડર",
        description:
          "રેઝિન કલા માટે માઇકા પાવડર, પિગમેન્ટ, ટિન્ટ, ગ્લિટર અને ગ્લો પાવડર.",
      },
      ar: {
        name: "أصباغ ومساحيق",
        description:
          "مساحيق ميكا وأصباغ وألوان شفافة وبودرة مضيئة لأعمال الراتنج.",
      },
      de: { name: "Pigmente & Puder" },
      es: { name: "Pigmentos y polvos" },
      fr: { name: "Pigments & poudres" },
      ja: { name: "顔料・パウダー" },
      zh: { name: "颜料与粉末" },
    },
  },
  {
    slug: "supplies-resin",
    name: "Resins & Hardeners",
    description:
      "Epoxy resin systems and hardeners for casting, coating and art pours.",
    image: "/media/v6/collection-supplies.webp",
    translations: {
      hi: {
        name: "रेज़िन और हार्डनर",
        description:
          "कास्टिंग, कोटिंग और आर्ट पोर के लिए एपॉक्सी रेज़िन और हार्डनर।",
      },
      gu: {
        name: "રેઝિન અને હાર્ડનર",
        description:
          "કાસ્ટિંગ, કોટિંગ અને આર્ટ પોર માટે ઇપોક્સી રેઝિન અને હાર્ડનર.",
      },
      ar: {
        name: "راتنجات ومصلّبات",
        description: "أنظمة راتنج إيبوكسي ومصلّبات للصب والطلاء الفني.",
      },
      de: { name: "Harze & Härter" },
      es: { name: "Resinas y endurecedores" },
      fr: { name: "Résines & durcisseurs" },
      ja: { name: "レジン・硬化剤" },
      zh: { name: "树脂与固化剂" },
    },
  },
  {
    slug: "supplies-molds-tools",
    name: "Molds, Tools & Kits",
    description:
      "Silicone molds, mechanisms, craft kits and studio tools for makers.",
    image: "/media/v6/collection-supplies.webp",
    translations: {
      hi: {
        name: "मोल्ड, औज़ार और किट",
        description:
          "कलाकारों के लिए सिलिकॉन मोल्ड, मैकेनिज़्म, क्राफ्ट किट और स्टूडियो औज़ार।",
      },
      gu: {
        name: "મોલ્ડ, સાધનો અને કિટ",
        description:
          "કલાકારો માટે સિલિકોન મોલ્ડ, ક્રાફ્ટ કિટ અને સ્ટુડિયો સાધનો.",
      },
      ar: {
        name: "قوالب وأدوات وأطقم",
        description: "قوالب سيليكون وأدوات وأطقم حرفية لصنّاع الراتنج.",
      },
      de: { name: "Formen, Werkzeug & Sets" },
      es: { name: "Moldes, herramientas y kits" },
      fr: { name: "Moules, outils & kits" },
      ja: { name: "モールド・道具・キット" },
      zh: { name: "模具、工具与套装" },
    },
  },
  {
    slug: "print-filaments",
    name: "3D Printing Filaments",
    description:
      "PLA, silk, flexible and engineering filaments for FDM printing.",
    image: "/media/v6/collection-3dprint.webp",
    translations: {
      hi: {
        name: "3D प्रिंटिंग फिलामेंट",
        description:
          "FDM प्रिंटिंग के लिए PLA, सिल्क, फ्लेक्सिबल और इंजीनियरिंग फिलामेंट।",
      },
      gu: {
        name: "3D પ્રિન્ટિંગ ફિલામેન્ટ",
        description:
          "FDM પ્રિન્ટિંગ માટે PLA, સિલ્ક, ફ્લેક્સિબલ અને એન્જિનિયરિંગ ફિલામેન્ટ.",
      },
      ar: {
        name: "خيوط طباعة ثلاثية الأبعاد",
        description: "خيوط PLA وحريرية ومرنة وهندسية لطابعات FDM.",
      },
      de: { name: "3D-Druck-Filamente" },
      es: { name: "Filamentos de impresión 3D" },
      fr: { name: "Filaments d'impression 3D" },
      ja: { name: "3Dプリントフィラメント" },
      zh: { name: "3D 打印耗材" },
    },
  },
  {
    slug: "print-decor",
    name: "3D Printed Décor",
    description:
      "Lithophane lamps, personalized photo pieces and printed decorative objects.",
    // §15.4's "Print / 3D" collection master, same story as gift-collections
    // above. The other two print categories keep the shared v6 file: there is
    // one printed-decor master, not three, and giving all three the same v3
    // picture would only move the duplication.
    image: "/media/v3/tile-print.avif",
    translations: {
      hi: {
        name: "3D प्रिंटेड सजावट",
        description:
          "लिथोफ़ेन लैंप, व्यक्तिगत फोटो-कृतियाँ और प्रिंटेड सजावटी वस्तुएँ।",
      },
      gu: {
        name: "3D પ્રિન્ટેડ સજાવટ",
        description:
          "લિથોફેન લેમ્પ, વ્યક્તિગત ફોટો-કૃતિઓ અને પ્રિન્ટેડ સુશોભન વસ્તુઓ.",
      },
      ar: {
        name: "ديكور مطبوع ثلاثي الأبعاد",
        description: "مصابيح ليثوفان وقطع صور مخصصة وديكورات مطبوعة.",
      },
      de: { name: "3D-gedruckte Deko" },
      es: { name: "Decoración impresa en 3D" },
      fr: { name: "Déco imprimée en 3D" },
      ja: { name: "3Dプリント装飾" },
      zh: { name: "3D 打印装饰" },
    },
  },
  {
    slug: "print-hardware",
    name: "Printer Parts & Tools",
    description:
      "Printer hardware, fasteners, precision tools and maintenance essentials.",
    image: "/media/v6/collection-3dprint.webp",
    translations: {
      hi: {
        name: "प्रिंटर पार्ट्स और औज़ार",
        description:
          "प्रिंटर हार्डवेयर, फास्टनर, सटीक औज़ार और रखरखाव की ज़रूरी चीज़ें।",
      },
      gu: {
        name: "પ્રિન્ટર પાર્ટ્સ અને સાધનો",
        description:
          "પ્રિન્ટર હાર્ડવેર, ફાસ્ટનર, ચોકસાઈવાળાં સાધનો અને જાળવણી સામગ્રી.",
      },
      ar: {
        name: "قطع وأدوات الطابعة",
        description: "قطع غيار ومثبتات وأدوات دقيقة لصيانة الطابعات.",
      },
      de: { name: "Druckerteile & Werkzeug" },
      es: { name: "Piezas y herramientas" },
      fr: { name: "Pièces & outils" },
      ja: { name: "プリンター部品・工具" },
      zh: { name: "打印机配件与工具" },
    },
  },
];

/** Presentation grouping for the mega-menu / shop ecosystem filter. */
export const CATALOG_GROUPS = {
  art: {
    slugs: [
      "resin-furniture-surfaces",
      "art-craft-pieces",
      "varmala-preservation",
      "wedding-photo-frames",
      "resin-trays-serving-platters",
      "candle-tea-light-holders",
      "resin-wall-clocks",
      "resin-jewelry-keychains",
      "resin-home-decor",
      "resin-vases",
      "drinkware-barware",
      "tablespace-sets",
      "sculptures-objets",
      "vanity-mirrors",
      "kids-room-decor",
      "gift-collections",
      "festive-pooja",
    ],
  },
  supplies: {
    slugs: ["supplies-pigments", "supplies-resin", "supplies-molds-tools"],
  },
  print: {
    slugs: ["print-filaments", "print-decor", "print-hardware"],
  },
} as const;

export type CatalogGroup = keyof typeof CATALOG_GROUPS;

/** One category link inside the header mega-menu (client-safe shape). */
export type CatalogNavItem = {
  slug: string;
  name: string;
  count: number;
};

/** The mega-menu's three ecosystem columns, built by src/lib/catalog-nav.ts. */
export type CatalogNav = Record<CatalogGroup, CatalogNavItem[]>;

export function groupForCategorySlug(slug: string): CatalogGroup {
  if ((CATALOG_GROUPS.supplies.slugs as readonly string[]).includes(slug)) {
    return "supplies";
  }
  if ((CATALOG_GROUPS.print.slugs as readonly string[]).includes(slug)) {
    return "print";
  }
  return "art";
}

/**
 * Ecosystem group from the IMPORT LIST — `Product.tier`, which committed CSV
 * a row came from (1 owner's store · 2 resin goods · 3 supplies · 4 3D
 * printing; hand-made studio rows carry NULL; the words live in
 * `src/lib/import-list.ts`). NOT the product tier (`sizeTier`), which says
 * what a piece IS. The importer routes each vertical's rows into that
 * group's categories, so list↔group is 1:1 on the live catalog — used where
 * card data carries no category slug (audit L-S1: the group-aware card CTA).
 * The function keeps its name: tests reference it.
 */
export function groupForTier(tier: number | null | undefined): CatalogGroup {
  if (tier === 3) return "supplies";
  if (tier === 4) return "print";
  return "art";
}

type Rule = { pattern: RegExp; slug: string };

const RESIN_RULES: Rule[] = [
  { pattern: /varmala|preservation|preserved/, slug: "varmala-preservation" },
  { pattern: /clock/, slug: "resin-wall-clocks" },
  {
    pattern: /tray|platter|lazy susan|cutting board|serving|cheese board/,
    slug: "resin-trays-serving-platters",
  },
  { pattern: /coaster|tablespace|placemat/, slug: "tablespace-sets" },
  { pattern: /photo frame|frame/, slug: "wedding-photo-frames" },
  {
    pattern:
      /ganesh|deity|pooja|puja|thali|diwali|rakhi|festival|temple|god|idol/,
    slug: "festive-pooja",
  },
  { pattern: /hamper|gift set|gift box|combo/, slug: "gift-collections" },
  {
    pattern:
      /jewel|earring|bangle|keychain|key chain|pendant|necklace|bracelet|purse|clutch|bag|bookmark/,
    slug: "resin-jewelry-keychains",
  },
  {
    pattern: /mug|tumbler|wine|glass|drink|bar|bottle/,
    slug: "drinkware-barware",
  },
  {
    pattern: /candle|tea light|tealight|night light|lamp|holder/,
    slug: "candle-tea-light-holders",
  },
  { pattern: /vase/, slug: "resin-vases" },
  { pattern: /mirror|vanity/, slug: "vanity-mirrors" },
  { pattern: /kids|children|nursery/, slug: "kids-room-decor" },
  {
    pattern: /sculpture|statue|figurine|figure|objet|model/,
    slug: "sculptures-objets",
  },
  {
    pattern: /table|furniture|shelf|surface|counter/,
    slug: "resin-furniture-surfaces",
  },
  {
    pattern: /wall art|painting|canvas|art piece|artwork|geode/,
    slug: "art-craft-pieces",
  },
  {
    pattern: /magnet|stone|home|decor|rack|organizer/,
    slug: "resin-home-decor",
  },
];

const SUPPLIES_RULES: Rule[] = [
  {
    pattern:
      /pigment|mica|tint|dye|colou?r|glow|glitter|powder|alcohol ink|ink/,
    slug: "supplies-pigments",
  },
  { pattern: /epoxy|resin kit|hardener|deep pour/, slug: "supplies-resin" },
];

const PRINT_RULES: Rule[] = [
  {
    pattern:
      /filament|\bpla\b|\babs\b|petg|tpu|tps|pc\/abs|ultrafuse|polylite|fibreel|silk/,
    slug: "print-filaments",
  },
  {
    pattern:
      /lithophane|lamp|light|d[ée]cor|moon|photo|figur|statue|planter|vase|bedroom|ornament|printed product|printable/,
    slug: "print-decor",
  },
];

/**
 * Maps a sheet row onto a canonical category slug. `candidates` are the
 * row's own category strings (main + fields JSON), checked before the title
 * so the source's own labelling wins when it exists.
 */
export function canonicalCategoryFor(
  vertical: string,
  candidates: Array<string | null | undefined>,
  title: string,
): string {
  const rules =
    vertical === "supplies"
      ? SUPPLIES_RULES
      : vertical === "3dprint"
        ? PRINT_RULES
        : RESIN_RULES;
  const fallback =
    vertical === "supplies"
      ? "supplies-molds-tools"
      : vertical === "3dprint"
        ? "print-hardware"
        : "resin-home-decor";

  const haystacks = [...candidates, title]
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .map((c) => c.toLowerCase());

  for (const haystack of haystacks) {
    for (const rule of rules) {
      if (rule.pattern.test(haystack)) return rule.slug;
    }
  }
  return fallback;
}
