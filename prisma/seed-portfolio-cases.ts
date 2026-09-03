import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Portfolio case-study archive (owner brief, 2026-08-13): twenty real
 * projects drawn from the owner's Tier-1 catalog rows. Every entry uses the
 * source row's own imagery and description as its factual base; the process
 * prose describes the studio's standard resin practice and never invents
 * measurements, materials or claims the source data does not support.
 *
 * Slugs are prefixed `case-`, so the seed never touches a portfolio entry the
 * owner authored in the studio.
 *
 * ── TWO BARRIERS (owner decision D22, 2026-09-03) ──────────────────────────
 *
 * This ran on EVERY deploy, and "idempotent upsert-by-slug" was not as safe
 * as it sounds: the update branch rebuilds the gallery with
 * `images: { deleteMany: {}, create: [...] }`, so an owner who replaced a
 * photograph on a seeded case lost it again on the next deploy, and any case
 * they had unpublished came back PUBLISHED. Idempotent against the SEED's own
 * input is not idempotent against the OWNER's edits.
 *
 * So it now needs both:
 *
 *   1. `PORTFOLIO_SEED=1` — an explicit opt-in. Unset means do nothing, which
 *      is what production gets. Nobody has to remember a convention.
 *   2. An EMPTY `Portfolio` table. The seed populates an empty archive; it
 *      never re-asserts itself over one that exists. The test is the whole
 *      table rather than a `case-` slug prefix because owner slugs come from
 *      `slugify(title)`, so an entry titled "Case study — …" would look like
 *      this seed's own work.
 *
 * Either barrier alone would be enough to stop the damage; both are here
 * because HARD RULE 3 (never invent portfolio content) deserves to be
 * structurally difficult to violate rather than merely documented. Re-running
 * deliberately means opting in AND clearing the `case-*` rows first.
 */

type Case = {
  slug: string;
  title: string;
  categorySlug: string;
  story: string;
  type: string;
  material: string;
  technique: string;
  complexity: "Signature" | "High" | "Moderate";
  timeline?: string;
  size?: string;
  tags: string[];
  images: string[];
};

const P = (...paragraphs: string[]) => paragraphs.join("\n\n");

const CASES: Case[] = [
  {
    slug: "case-varmala-preservation-clock",
    title: "Varmala Preservation Clock",
    categorySlug: "varmala-preservation",
    type: "Wedding Keepsake",
    material: "Epoxy resin, real varmala flowers, clock mechanism",
    technique: "Botanical preservation casting",
    complexity: "Signature",
    timeline: "Made to order",
    tags: ["varmala", "wedding", "preservation", "anniversary", "custom"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4942.jpg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4943.jpg",
    ],
    story: P(
      "A couple's varmala carries the exact minute a marriage began — and it fades within days. This commission turns those real garland flowers into a working wall clock, so the flowers that witnessed the vows keep marking time for the marriage they started.",
      "The flowers arrive from the wedding and are dried carefully to hold their colour and form. They are then arranged inside a circular mold and cast in crystal-clear epoxy resin, poured in thin layers so every petal stays suspended exactly where it was placed and no bubbles cloud the face. A quality clock mechanism is set into the cured cast.",
      "Each dial is composed around the couple's own flowers, so no two clocks can ever repeat. Names, the wedding date or a short line can be worked into the face on request.",
      "The finished piece reads as jewellery for a wall: the reds and golds of the varmala held in glass-like depth, doing quiet daily work as a clock — a first-anniversary gift that is literally made from the wedding day.",
    ),
  },
  {
    slug: "case-wedding-flower-preservation-frame",
    title: "Wedding Flower Preservation Frame",
    categorySlug: "varmala-preservation",
    type: "Wedding Keepsake",
    material: "Epoxy resin, preserved wedding flowers",
    technique: "Botanical preservation casting",
    complexity: "Signature",
    timeline: "Made to order",
    tags: ["wedding", "preservation", "frame", "keepsake", "custom"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4899.jpg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4899.jpg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/WhatsApp-Image-2026-04-14-at-1.56.10-PM.jpeg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4901.jpg",
    ],
    story: P(
      "Wedding flowers hold emotions and moments a photograph cannot — their scent was in the air when everything was said. This frame preserves the couple's real flowers inside a clear resin tablet that stands or hangs like a pane of captured time.",
      "The blooms are dried slowly to keep their pigment, then composed inside the frame mold — full flowers, petals and leaves balanced the way a pressed-flower artist lays a page. Crystal epoxy is poured in patient layers, each one degassed so the botanicals sit in perfect clarity rather than behind haze.",
      "Because the flowers are the client's own, the studio works around what the wedding provides: garland roses, bouquet blooms, even haldi petals. Names and dates cast into the piece are a common addition.",
      "The result is a forever version of the most temporary thing at a wedding — flowers that will look the way they did that morning, decades on.",
    ),
  },
  {
    slug: "case-luxury-resin-puja-thali",
    title: "Luxury Wedding Ritual Thali",
    categorySlug: "festive-pooja",
    type: "Ritual Ware",
    material: "Epoxy resin, metallic pigments",
    technique: "Pigment-layered casting",
    complexity: "High",
    size: "10 inch",
    timeline: "Made to order",
    tags: ["puja thali", "wedding", "ritual", "festive", "custom"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4916-1.jpg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4918-1.jpg",
      "https://kanhakreation.com/wp-content/uploads/2026/04/IMG_4917-1.jpg",
    ],
    story: P(
      "Every wedding ritual deserves objects that match its weight. From roka to griha pravesh, the same thali passes through dozens of hands and hundreds of photographs — so this commission designs it as the ceremony's centrepiece rather than an afterthought.",
      "The ten-inch thali is cast in epoxy resin with metallic pigments drawn through the pour, so the surface carries depth — veils of colour suspended under a glass-clear top coat. The rim and accents are finished by hand after demolding.",
      "Couples personalize the palette to the wedding's colours and add names or the wedding date in the surface. Matching ritual accessories can be cast from the same pour so the whole set shares one marbling.",
      "The finished thali is wipeable, durable and genuinely used — luxury that participates in the ritual instead of watching it from a shelf.",
    ),
  },
  {
    slug: "case-burgundy-gold-epoxy-tray-set",
    title: "Burgundy & Gold Epoxy Tray Set",
    categorySlug: "resin-trays-serving-platters",
    type: "Serving Set",
    material: "Epoxy resin, gold leaf, metallic pigments",
    technique: "Marbled pour with gold-leaf inlay",
    complexity: "High",
    timeline: "Made to order",
    tags: ["tray", "serving set", "gold leaf", "housewarming", "gifting"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_0.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_9.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_8.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_7.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_6.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1710_5.jpg",
    ],
    story: P(
      "An eight-piece serving story in one palette: deep burgundy poured against ivory and threaded with real gold leaf, across a large tray and its companion coasters. Composed as a wedding, housewarming or holiday gift that arrives looking like a set from a design house.",
      "Each piece is a free-poured marble — burgundy and ivory resins moved into each other while liquid, then gold leaf laid into the seams so the veining catches light the way stone never quite does. Because the pour is live, the set shares one family of movement while no two pieces repeat.",
      "Edges are sanded and polished to a soft radius, and the surfaces cure to a hard gloss that handles daily serving. The composition can be recoloured to a client's interior on commission.",
      "It is the studio's most photographed tray language: stone-like depth with a warmth marble does not have, made for tables that get used.",
    ),
  },
  {
    slug: "case-resin-tray-set-serving-trays",
    title: "Epoxy Serving Tray Trio",
    categorySlug: "resin-trays-serving-platters",
    type: "Serving Set",
    material: "Epoxy resin, metallic pigments",
    technique: "Layered marble pour",
    complexity: "High",
    timeline: "Made to order",
    tags: ["tray", "vanity", "serving", "wedding gift", "home decor"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_0.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_5.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_4.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_3.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_2.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1716_1.jpg",
    ],
    story: P(
      "A graduated set of serving trays with matching coasters — designed so a vanity, a coffee table and a guest tray can all speak the same material language. Sold as elegant home décor, gifted most often at weddings.",
      "The trays are cast in nested sizes, each with the same pigment story pulled through a layered pour. Handles and rims are shaped in the mold, then hand-finished; coasters are poured from the same batch so the marbling matches across the set.",
      "The set holds perfume bottles, jewellery, chai for two — the studio's answer to the question of what luxury looks like when it works for a living.",
    ),
  },
  {
    slug: "case-marble-ring-dish-vanity-tray",
    title: "Marble Ring Dish & Vanity Tray",
    categorySlug: "resin-trays-serving-platters",
    type: "Vanity Piece",
    material: "Epoxy resin, marble-effect pigments",
    technique: "Marble-effect casting",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["ring dish", "vanity", "engagement", "perfume tray", "gift"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_0.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_0.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_1.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_2.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_3.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1012_4.webp",
    ],
    story: P(
      "A small tray with a precise job: the place where an engagement ring sleeps. Cast as a marble-effect dish that also serves as a perfume holder and vanity organizer — an aesthetic object sized to a bedside.",
      "White and grey resins are pulled into each other for stone veining, and the dish's soft rim is polished so it is kind to metal and gemstones. The scale is deliberate — large enough for a watch and two rings, small enough to live anywhere.",
      "A quiet, giftable piece: engagement mornings, bridal parties, and anyone whose jewellery currently lives on a windowsill.",
    ),
  },
  {
    slug: "case-agate-geode-gold-leaf-coasters",
    title: "Agate Geode Coasters in Grey & Gold",
    categorySlug: "tablespace-sets",
    type: "Coaster Set",
    material: "Epoxy resin, gold leaf",
    technique: "Geode-style casting",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["coasters", "geode", "agate", "gold leaf", "set of four"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_5.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_5.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_4.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_3.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_2.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1653_1.webp",
    ],
    story: P(
      "A set of four coasters that borrow their anatomy from sliced agate: grey and black bands ringing a clear centre, with real gold leaf tracing the fracture lines. Each one reads as a cross-section of stone that never existed.",
      "The geode effect is built ring by ring while the resin is workable — tinted bands laid from the rim inward, gold leaf set between them, then a clear flood coat that gives the surface its glassy dome. Every coaster in the set grows its rings differently, exactly like the mineral.",
      "Heat-tolerant, wipeable and made to be used under actual cups. Custom palettes are a frequent request — the same anatomy in a client's colours.",
    ),
  },
  {
    slug: "case-customized-resin-pooja-thali",
    title: "Customised Resin Pooja Thali",
    categorySlug: "festive-pooja",
    type: "Ritual Ware",
    material: "Epoxy resin, pigments",
    technique: "Pigment casting with personalization",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["pooja thali", "festive", "diwali", "custom", "ritual"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_4.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_4.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_5.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_3.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_2.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1250_1.webp",
    ],
    story: P(
      "The pooja thali is the most-touched object in an Indian home's calendar — aarti after aarti, festival after festival. This customized platter gives that daily ritual a surface with depth: pigment clouds and shimmer suspended under glass-clear resin.",
      "Each thali is poured to order, with the client choosing colours and any name or motif to be set into the face. The cured surface takes kumkum, haldi and diya heat in stride and wipes clean after every use.",
      "Most orders arrive around Diwali and wedding season, often in multiples as return gifts — one composition, repeated in a family's chosen palette.",
    ),
  },
  {
    slug: "case-wildflower-resin-bookmark",
    title: "Wildflower Resin Bookmarks",
    categorySlug: "resin-jewelry-keychains",
    type: "Reader's Keepsake",
    material: "Epoxy resin, pressed wildflowers",
    technique: "Pressed-botanical casting",
    complexity: "Moderate",
    timeline: "Ready to ship / made to order",
    tags: ["bookmark", "pressed flowers", "reader gift", "mother's day"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1151_5.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1150_0.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1150_1.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1151_2.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1151_3.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1151_4.webp",
    ],
    story: P(
      "A meadow, pressed flat and sealed where a reader will see it every night. These bookmarks hold real pressed wildflowers in a slim tablet of clear resin — a small object that gets years of daily use.",
      "The flowers are pressed and dried until paper-thin, then arranged in slender molds and flooded with resin in two thin passes to keep the profile flat and the botanicals perfectly legible. Edges are sanded smooth so the bookmark is kind to pages.",
      "A favourite Mother's Day and book-lover's gift; no two flower arrangements repeat, and custom flowers can be pressed on request.",
    ),
  },
  {
    slug: "case-personalized-daisy-bookmark",
    title: "Personalised Daisy Bookmark",
    categorySlug: "resin-jewelry-keychains",
    type: "Reader's Keepsake",
    material: "Epoxy resin, pressed daisies",
    technique: "Pressed-botanical casting with name inlay",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["bookmark", "personalized", "daisy", "gift for her"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/il_794xN.6916097222_4ui5.webp",
    ],
    story: P(
      "The same pressed-flower anatomy as the studio's wildflower bookmarks, personalised: a client's name set alongside real daisies in the clear casting, so an everyday object becomes unmistakably someone's.",
      "The name is placed while the pour is open, floating at the same depth as the botanicals so both read as one composition rather than a label on a product. The rest of the process follows the studio's bookmark practice — thin passes, degassing, hand-finished edges.",
      "Ordered most for readers, teachers and bridesmaids — a personal gift at a friendly price that still says handmade.",
    ),
  },
  {
    slug: "case-real-flower-resin-bangle",
    title: "Real Flower Resin Bangle",
    categorySlug: "resin-jewelry-keychains",
    type: "Wearable",
    material: "Epoxy resin, real flowers",
    technique: "Botanical jewellery casting",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["bangle", "jewellery", "real flowers", "nature inspired"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1131_0.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1131_3.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1131_1.webp",
    ],
    story: P(
      "A bangle with a garden inside it: real flowers cast in a clear resin band, worn as nature-inspired jewellery that keeps its bloom all year.",
      "Tiny flowers and petals are dried whole, then set around the circumference of a bangle mold so the composition reads from every angle of the wrist. The resin is poured slowly to hold each bloom in place, cured hard, then sanded and polished to a comfortable, glassy band.",
      "Rose petals from a client's own bouquet are a recurring commission — the bracelet version of the studio's preservation work.",
    ),
  },
  {
    slug: "case-real-flower-earrings",
    title: "Real Flower Statement Earrings",
    categorySlug: "resin-jewelry-keychains",
    type: "Wearable",
    material: "Epoxy resin, real flowers, hypoallergenic hooks",
    technique: "Botanical jewellery casting",
    complexity: "Moderate",
    timeline: "Ready to ship / made to order",
    tags: ["earrings", "real flowers", "lightweight", "statement"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/il_340x270.6972364586_sotw.avif",
    ],
    story: P(
      "Statement earrings that weigh almost nothing: real flowers suspended in slim resin drops. The paradox — botanical volume, feather weight — is what makes them the studio's most reordered wearable.",
      "Petals are cast in shallow molds so the drops stay thin; the clear resin does the visual work, magnifying the flowers while keeping the earring light enough for all-day wear. Each pair is matched from the same flower batch so left and right agree.",
      "Finished with quality hooks and made in small runs — every pair slightly different because every flower is.",
    ),
  },
  {
    slug: "case-butterfly-drop-earrings",
    title: "Blue Butterfly Drop Earrings",
    categorySlug: "resin-jewelry-keychains",
    type: "Wearable",
    material: "Resin, silk butterfly wings, leaf accents",
    technique: "Inclusion casting",
    complexity: "Moderate",
    timeline: "Ready to ship",
    tags: ["earrings", "butterfly", "summer", "gift for her"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1247_1.jpg",
    ],
    story: P(
      "Silk-blue butterfly wings paired with a silver or golden leaf, hung as summer drop earrings — handmade accessories built around a single vivid inclusion.",
      "The wing material is sealed in resin so its colour is locked against sun and time, then paired with its metal leaf and finished by hand. The blue reads differently with every light, which is the point.",
      "A small, joyful piece — the studio's reminder that resin work does not have to be solemn to be crafted.",
    ),
  },
  {
    slug: "case-flower-preservation-tray",
    title: "Original Flower Preservation Tray",
    categorySlug: "varmala-preservation",
    type: "Preservation Piece",
    material: "Epoxy resin, preserved flowers",
    technique: "Botanical preservation casting",
    complexity: "High",
    timeline: "Made to order",
    tags: ["preservation", "tray", "keepsake", "wedding flowers"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/Screenshot2025-02-13122553_1200x1200.webp",
    ],
    story: P(
      "Preservation work that earns its keep: the client's real flowers cast into a functional tray, so the keepsake lives on a table instead of in a cupboard.",
      "The flowers are dried and composed across the tray's field, then flooded in layers with the studio's usual patience — degassing each pass so the botanicals stay legible under a serving-grade surface. The tray's rim and base are finished for daily handling.",
      "Most commissions come from weddings and anniversaries; some from gardens. The brief is always the same — keep these exact flowers — and the answer is always one of one.",
    ),
  },
  {
    slug: "case-customise-gold-ganesh",
    title: "Customised Gold Ganesh",
    categorySlug: "festive-pooja",
    type: "Devotional Object",
    material: "Resin, gold-tone finish",
    technique: "Figurine casting with hand finish",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["ganesh", "diwali", "return gift", "car dashboard", "housewarming"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/il_794xN.7036261760_m9wp.webp",
    ],
    story: P(
      "A gold Ganesh sized for the two places Indian homes most want one: the table and the car dashboard. Cast in resin and finished in gold tone, customised per order.",
      "The figure is cast from the studio's mold, cleaned by hand, and finished in a warm metallic that photographs like cast brass at a fraction of its weight. Bases can be personalised — names for housewarmings, dates for Diwali, batches for wedding return gifts.",
      "It is the studio's most gifted devotional object: small, luminous and unmistakably handmade.",
    ),
  },
  {
    slug: "case-kanku-chawal-puja-thali",
    title: "Kanku–Chawal Mor Pankh Thali",
    categorySlug: "festive-pooja",
    type: "Ritual Ware",
    material: "Epoxy resin, mor pankh (peacock feather) inclusion",
    technique: "Inclusion casting",
    complexity: "High",
    size: "10 inch",
    timeline: "Made to order",
    tags: ["puja thali", "mor pankh", "rakhi", "diwali", "kanku chawal"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/il_794xN.5394481326_n1yr.avif",
    ],
    story: P(
      "An aarti thali carrying a real mor pankh — the peacock feather of Krishna iconography — sealed under its surface, with wells for kanku, chawal and sweet. One object serving Rakhi, Diwali and the daily aarti alike.",
      "The feather is the technical heart of the piece: it must be laid perfectly flat and saturated so no air silvering dulls its eye. It is set mid-pour, under a clear flood coat that protects it from wear while keeping its iridescence live.",
      "The thali is the studio's answer to ritual ware that must be both sacred and usable — wipeable after every haldi-kumkum, beautiful in every festival photograph.",
    ),
  },
  {
    slug: "case-wedding-favour-magnets",
    title: "Wedding Favour Magnets",
    categorySlug: "resin-home-decor",
    type: "Event Favours",
    material: "Epoxy resin, magnet backing",
    technique: "Small-batch casting",
    complexity: "Moderate",
    timeline: "Batch made to order",
    tags: ["wedding favours", "magnets", "baby shower", "personalized", "batch"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/il_794xN.7007299424_m5w8-1.webp",
    ],
    story: P(
      "Guest favours that survive the drive home: personalised epoxy magnets cast in batches for weddings and baby showers, each carrying the event's names and date.",
      "Batch work is its own discipline — one pigment recipe mixed for the whole run so the fiftieth magnet matches the first, poured across gang molds and finished with strong magnet backings. Personalisation is set into each piece, not printed on top.",
      "They end up on refrigerators across three cities after every event — the studio's smallest work and some of its most seen.",
    ),
  },
  {
    slug: "case-round-placemats",
    title: "Round Table Placemats",
    categorySlug: "tablespace-sets",
    type: "Tableware",
    material: "Resin composite",
    technique: "Flat casting",
    complexity: "Moderate",
    timeline: "Ready to ship",
    tags: ["placemats", "dining", "heat protection", "easy clean"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/20250920_110032-scaled.webp",
      "https://kanhakreation.com/wp-content/uploads/2025/09/20250920_110157-1-scaled.webp",
    ],
    story: P(
      "Placemats built for real dining tables: round, durable and easy to clean, protecting wood from heat, scratches and spills while looking like part of the table setting rather than its insurance.",
      "Cast flat and finished with a wipeable surface, the placemats take daily meals and party service equally. The format is deliberately simple — the material's depth is the decoration.",
      "The everyday end of the studio's practice: pieces that work hard and quietly raise the table's baseline.",
    ),
  },
  {
    slug: "case-glitter-geode-coasters",
    title: "Geode Coasters in Red, Purple & Black",
    categorySlug: "tablespace-sets",
    type: "Coaster Set",
    material: "Epoxy resin, glitter, pigments",
    technique: "Geode-style casting",
    complexity: "Moderate",
    timeline: "Made to order",
    tags: ["coasters", "geode", "glitter", "set of four", "gift"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/09/il_794xN.6233588204_o98b.jpg",
    ],
    story: P(
      "The louder sibling of the studio's grey geode set: four coasters banded in red, purple and black with a glitter seam running the agate line.",
      "The rings are laid while the resin flows, glitter set between colour bands where a real geode would carry its crystal throat. A clear flood coat seals the composition into one glassy surface.",
      "Made to order in the client's palette — the same mineral anatomy, tuned from quiet to celebratory.",
    ),
  },
  {
    slug: "case-seaside-shell-candle",
    title: "Seaside Candle with Sand & Seashells",
    categorySlug: "candle-tea-light-holders",
    type: "Decorative Object",
    material: "Gel wax, real sand and seashells",
    technique: "Layered gel embedding",
    complexity: "Moderate",
    timeline: "Ready to ship",
    tags: ["candle", "seashells", "embedded objects", "coastal", "gift"],
    images: [
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_0.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_0.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_1.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_2.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_3.jpg",
      "https://kanhakreation.com/wp-content/uploads/2025/08/1246_4.jpg",
    ],
    story: P(
      "The embedding instinct of resin work, translated into light: an XL gel candle holding real sand and sea shells, scented with ocean rain. The clear gel does what clear resin does — suspends real objects in depth — but this time the piece burns.",
      "Sand is laid as the sea floor, shells arranged on and above it, and clear gel poured so the beach scene stays visible through the vessel while the flame floats over it.",
      "A crossover piece in the studio's practice — the same eye for embedded composition, applied to the candle line — and a favourite holiday gift.",
    ),
  },
];

/** Barrier 1 — the opt-in. Anything but "1" is off, including unset. */
function seedingEnabled(): boolean {
  return process.env.PORTFOLIO_SEED === "1";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn("seed-portfolio-cases: DATABASE_URL not set — skipping.");
    return;
  }
  if (!seedingEnabled()) {
    // Name the environment for the same reason the site-image import does:
    // "skipped" and "ran and found nothing" must not read alike in a log.
    console.log(
      `seed-portfolio-cases: PORTFOLIO_SEED not set in ${process.env.VERCEL_ENV ?? "local"} — skipping (D22).`,
    );
    return;
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    // Barrier 2 — populate an EMPTY archive, never re-assert over one that
    // exists. The test is the whole table, not a `case-` slug prefix: owner
    // slugs are minted by `slugify(title)` (actions/portfolio.ts:158), so a
    // portfolio entry the owner titles "Case study — …" mints `case-study-…`
    // and a prefix test would read their content as this seed's own. Table
    // emptiness cannot be confused that way.
    const existing = await db.portfolio.count();
    if (existing > 0) {
      console.log(
        `seed-portfolio-cases: ${existing} portfolio row(s) already present — skipping (D22).`,
      );
      return;
    }

    const categories = await db.category.findMany({
      select: { id: true, slug: true },
    });
    const catId = new Map(categories.map((c) => [c.slug, c.id]));

    let created = 0;
    let updated = 0;
    for (const c of CASES) {
      const data = {
        title: c.title,
        story: c.story,
        afterImageUrl: c.images[0] ?? null,
        categoryId: catId.get(c.categorySlug) ?? null,
        status: "PUBLISHED" as const,
        resultsMeta: {
          type: c.type,
          material: c.material,
          technique: c.technique,
          complexity: c.complexity,
          ...(c.size ? { size: c.size } : {}),
          ...(c.timeline ? { timeline: c.timeline } : {}),
          tags: c.tags,
        },
      };
      const existing = await db.portfolio.findUnique({
        where: { slug: c.slug },
        select: { id: true },
      });
      if (existing) {
        await db.portfolio.update({
          where: { id: existing.id },
          data: {
            ...data,
            images: {
              deleteMany: {},
              create: c.images.map((url, order) => ({
                url,
                alt: c.title,
                order,
              })),
            },
          },
        });
        updated++;
      } else {
        await db.portfolio.create({
          data: {
            ...data,
            slug: c.slug,
            images: {
              create: c.images.map((url, order) => ({
                url,
                alt: c.title,
                order,
              })),
            },
          },
        });
        created++;
      }
    }
    console.log(
      `seed-portfolio-cases: ${created} created, ${updated} updated ` +
        `(${CASES.length} cases).`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("seed-portfolio-cases: fatal:", error);
  process.exitCode = 1;
});
