import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { markdownToTiptap } from "../src/lib/import/parse";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Seeds ONLY owner-approved structure: admin user (from env), the real
 * category tree (EMPTY of products), FAQ topics, site settings, and legal
 * page stubs. NO real catalog products — the catalog is owner-fed via
 * Scraper approvals / Bulk Import / manual studio adds.
 * Phase 10 cleanup: the temporary DEMO products are no longer seeded —
 * the catalog ships 100% empty and owner-fed.
 */

// The 16 real categories (Phase 11 §3 of the master spec) with the
// owner's price-band/size reference stored in the description.
const CATEGORIES: { name: string; slug: string; description: string }[] = [
  {
    name: "Resin Furniture & Surfaces",
    slug: "resin-furniture-surfaces",
    description:
      "River tables, side and coffee tables, console and table tops, wardrobe and surface panels — epoxy with wood, built to your dimensions. Premium tier.",
  },
  {
    name: "Art & Craft Pieces",
    slug: "art-craft-pieces",
    description:
      "Ocean, geode and abstract wall art, resin paintings and one-of-a-kind decorative pieces.",
  },
  {
    name: "Varmala Preservation",
    slug: "varmala-preservation",
    description:
      "Museum-grade wedding garland preservation frames in multiple sizes — frame finish, backing colour, name and date engraving, photo inset.",
  },
  {
    name: "Wedding Photo Frames",
    slug: "wedding-photo-frames",
    description:
      "Teakwood borders, LED-lit options and custom photo printing. Sizes 8x8\" to 14x14\".",
  },
  {
    name: "Resin Trays & Serving Platters",
    slug: "resin-trays-serving-platters",
    description:
      "Decorative and engagement trays with gold, silver and rose-gold leaf finishes. Sizes 6x6\" to 12x12\", with handle options.",
  },
  {
    name: "Candle Holders & Tea Light Holders",
    slug: "candle-tea-light-holders",
    description:
      "Diwali collections, decorative diyas and minimalist designs. ₹250–₹2,000.",
  },
  {
    name: "Resin Wall Clocks",
    slug: "resin-wall-clocks",
    description:
      "Marble, geode and ocean-wave patterns with silent quartz movement. Diameters 12\" to 24\".",
  },
  {
    name: "Resin Jewelry & Keychains",
    slug: "resin-jewelry-keychains",
    description:
      "Earrings, rings, necklaces, bracelets, charms and keychains with dried flowers and glitter. ₹100–₹2,000.",
  },
  {
    name: "Resin Home Decor & Accessories",
    slug: "resin-home-decor",
    description:
      "Monogram letters, baby footprint and handprint keepsakes, marriage and anniversary preservation, wall art and coaster sets.",
  },
  {
    name: "Resin Vases",
    slug: "resin-vases",
    description:
      "Crystal-look and pigment-art vases — single-stem to statement sizes.",
  },
  {
    name: "Drinkware & Barware",
    slug: "drinkware-barware",
    description: "Resin-art coaster, tumbler and serving sets, and bar trays.",
  },
  {
    name: "Tablespace Sets",
    slug: "tablespace-sets",
    description:
      "Jesmonite and resin tableware and dining styling sets — tray + coasters + platters — plus corporate gifting sets.",
  },
  {
    name: "Sculptures & Objets",
    slug: "sculptures-objets",
    description: "Poured-resin sculptures and decorative objets.",
  },
  {
    name: "Vanity Mirrors",
    slug: "vanity-mirrors",
    description: "Resin-embellished mirrors — glass and gloss statement pieces.",
  },
  {
    name: "Kids Room Decor",
    slug: "kids-room-decor",
    description: "Playful themed resin pieces for children's rooms.",
  },
  {
    name: "Workshops",
    slug: "workshops",
    description:
      "Bookable resin-art workshop sessions — beginner and advanced, group or private — ordered through the same WhatsApp flow.",
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do you deliver across India, and how long does it take?",
    answer:
      "Yes — we ship everywhere in India. Made-to-order pieces typically take 7–21 days to craft depending on size and complexity (each product page shows its timeline), plus 3–7 days in transit. We confirm the exact timeline with you on WhatsApp before starting.",
  },
  {
    question: "How do you make sure my piece arrives safely?",
    answer:
      "Every piece is cured fully, corner-protected, double-boxed with dense foam and bubble wrap, and marked fragile. Large items like tables ship crated. If anything arrives damaged, message us photos on WhatsApp within 48 hours and we will make it right.",
  },
  {
    question: "What photo quality do you need for custom photo pieces?",
    answer:
      "Sharp, well-lit photos straight from your phone or camera work best — ideally 2000px or wider, without WhatsApp compression (send as a document, or we'll share an upload link). Screenshots and heavily filtered images reduce print quality; we review every photo and tell you honestly if it won't do your piece justice.",
  },
  {
    question: "How do I care for and clean my resin art?",
    answer:
      "Dust with a soft dry or slightly damp microfibre cloth. Keep pieces out of prolonged direct sunlight to prevent yellowing, away from sustained heat (hot pans, radiators), and never soak functional pieces — wipe clean and dry. Avoid alcohol and acetone cleaners.",
  },
  {
    question: "How do price and payment work?",
    answer:
      "Product pages show an indicative price band. Because every piece is customized, the final quote is confirmed on WhatsApp after we understand your size, materials and detailing. Payment is arranged directly on WhatsApp — typically an advance to begin and the balance before dispatch. The website itself takes no payments.",
  },
  {
    question: "Can I return or exchange a made-to-order piece?",
    answer:
      "Custom pieces are crafted uniquely for you, so returns aren't offered for change of mind. If your piece arrives damaged or differs from what we agreed, contact us on WhatsApp within 48 hours with photos and we'll repair, remake or resolve it fairly.",
  },
];

// ————————————————————— Legal pages (full originals) —————————————————————
// Written as markdown and converted to Tiptap JSON at seed time via the
// same marked → generateJSON pipeline the Bulk Import uses. The page hero
// renders the title as <h1>, so the documents start at <h2> sections.

const PRIVACY_MD = `
## Who we are

Rivya Living Art is a made-to-order resin art and 3D-printing studio, and this website — www.rivyalivingart.com — is our online showcase. This policy explains what information we collect when you use the site, why we collect it, and the choices you have. We have kept it in plain language on purpose: if anything is unclear, you are always welcome to ask us directly on WhatsApp.

## What we collect

The site is a catalogue, not a checkout. The only personal information we receive is what you choose to send us when you make an inquiry:

- Your name and phone number.
- Your email address, if you choose to share it.
- The customization selections you make on a product or custom-order form — sizes, colours, engraving text, occasions and similar choices.
- Reference images you upload — for example wedding photos for a frame, or pictures of a design you like.
- Any messages or notes you write to us.

We also use Vercel Analytics to understand, in aggregate, how the site is used — which pages are visited and how the site performs. This is basic, privacy-respecting analytics; we do not use advertising trackers, and we do not build advertising profiles of our visitors.

## Why we collect it

We use your information for one purpose: to craft what you asked us to craft. Specifically, we use it to:

- Prepare an accurate quote for your piece.
- Craft your commission to the exact selections and references you shared.
- Communicate with you on WhatsApp about your order — confirmations, design mock-ups, progress updates and delivery details.

We do not use your details for unsolicited marketing, and we do not add you to mailing lists you did not ask for.

## No payments on this website

This website does not process payments. All payments are arranged personally on WhatsApp after your quote is confirmed. We never collect or store card numbers, UPI PINs, banking passwords or any other payment credentials — not on this site, and never in chat. If anyone claiming to represent Rivya Living Art asks for such details, please do not share them and let us know.

## Where your information is stored

Inquiry details are stored in our database, hosted with Neon (a managed Postgres service), and uploaded images are stored with Vercel Blob. We take reasonable technical and organisational measures to keep this information secure, including access limited to the people who need it to prepare and fulfil your order.

## Who we share it with

We never sell your personal information. The only sharing that happens is the minimum needed to deliver your piece: your name, delivery address and phone number are shared with our courier and delivery partners so your order can reach you. Nothing else is shared with anyone else.

## How long we keep it

We keep inquiry details as part of your order history, so we can help you later with care advice, repairs, remakes or matching pieces. If you would like your information deleted, just ask — we will remove your details and uploaded images from our records on request.

## Your rights

You can ask us at any time to:

- Access the information we hold about you.
- Correct anything that is wrong or out of date.
- Delete your information and uploaded images.

To do any of these, email us at gondaliyabhavya70960@gmail.com or message us on WhatsApp at +91 7096036250. We will respond as quickly as we reasonably can.

## Children

Our website and services are not directed at children. If you are under 18, please place inquiries through a parent or guardian.

## Changes to this policy

If our practices change, we will update this page and revise the "last updated" date shown at the top. Meaningful changes will always be reflected here before they take effect.

## Contact us

Rivya Living Art
Email: gondaliyabhavya70960@gmail.com
WhatsApp: +91 7096036250
Website: www.rivyalivingart.com
`.trim();

const TERMS_MD = `
## The nature of our service

Rivya Living Art — www.rivyalivingart.com — is a showcase website for made-to-order resin art, personalized gifts, 3D-printed pieces and workshop sessions. The site itself has no online checkout: every order is finalized personally on WhatsApp, where we confirm your customizations, quote, timeline and delivery details before any work begins. By placing an inquiry or ordering with us, you agree to these terms.

## Quotes & payment

Price bands shown on the site are indicative, because every piece is customized — final pricing depends on size, materials and detailing. Your exact quote is confirmed on WhatsApp before we start. Payment is also arranged on WhatsApp: typically an advance to begin the work and the balance before dispatch, with the exact schedule agreed between us in chat. This website never collects payments or payment details.

## Made to order & customization

Almost everything we make is crafted uniquely for you. For customized pieces we share design mock-ups or descriptions for your approval before pouring; once you approve and the advance is received, the commission is underway and the design is considered final. Photos, flowers, garlands and other keepsakes you send us for preservation or printing remain your property — and you confirm that anything you supply is yours to use, and does not infringe anyone else's rights.

## Timelines

Crafting timelines shown on the site are honest estimates, not guarantees. Resin cures on its own schedule, and curing, finishing and weather (humidity affects resin work) can shift a completion date. We confirm an expected timeline on WhatsApp before starting and keep you updated if anything changes. Transit times after dispatch are in the hands of our delivery partners.

## Shipping & damage

Every piece is cured fully, protected and packed carefully before dispatch. If your piece arrives damaged, message us on WhatsApp within 48 hours of delivery with clear photos of the piece and its packaging. We will make it right — with a repair, a remake or another fair resolution, agreed with you case by case. Claims raised after the 48-hour window are handled at our discretion, so please unbox and check your piece promptly.

## Returns

Because each piece is made uniquely to your specifications, we do not accept returns or exchanges for a change of mind. If a piece arrives damaged, or is materially different from what we agreed on WhatsApp, contact us within 48 hours and we will resolve it fairly, as described above. Nothing in these terms limits any rights you may have under applicable Indian consumer protection law.

## Intellectual property

Our designs, techniques, photographs and website content remain the property of Rivya Living Art. Buying a piece gives you the piece — not the right to reproduce the design commercially or to have it reproduced elsewhere. We may photograph commissioned work for our portfolio and social media; if you would prefer your commission stays private, just tell us on WhatsApp and we will not publish it.

## Workshop bookings

Workshop seats are confirmed on WhatsApp, like everything else. If you need to reschedule, let us know at least 48 hours before the session and we will happily move your booking to another available date. Materials for workshop sessions are provided by us and included in the session price confirmed in chat.

## Governing law

These terms are governed by the laws of India, and any dispute arising from an order or these terms is subject to the jurisdiction of the courts of Gujarat.

## Contact us

Questions about these terms, an order, or anything else:

Rivya Living Art
Email: gondaliyabhavya70960@gmail.com
WhatsApp: +91 7096036250
Website: www.rivyalivingart.com
`.trim();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  // — Admin user. Skip (with a loud warning) rather than crash if creds
  // are missing, so the rest of the structure still seeds — the studio
  // login just won't work until ADMIN_EMAIL/ADMIN_PASSWORD are set and the
  // seed is re-run (or the deploy re-triggered).
  if (!adminEmail || !adminPassword) {
    console.warn(
      "⚠ ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user. " +
        "Set them (Vercel → Settings → Environment Variables) and re-run to enable /studio login.",
    );
  } else {
    const hashedPassword = await hash(adminPassword, 12);
    await db.user.upsert({
      where: { email: adminEmail },
      update: { role: "ADMIN" },
      create: {
        name: "Bhavya Gondaliya",
        email: adminEmail,
        hashedPassword,
        role: "ADMIN",
      },
    });
  }

  // — Categories (order = list position)
  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, order: i },
      create: { ...c, order: i },
    });
  }

  // — FAQs
  for (const [i, f] of FAQS.entries()) {
    const existing = await db.faq.findFirst({ where: { question: f.question } });
    if (existing) {
      await db.faq.update({
        where: { id: existing.id },
        data: { answer: f.answer, order: i },
      });
    } else {
      await db.faq.create({ data: { ...f, order: i } });
    }
  }

  // — Site settings singleton (exact business values)
  await db.siteSettings.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      brandName: "Rivya Living Art",
      tagline: "Handcrafted resin art, made to order.",
      announcement:
        "Made-to-order luxury resin art — every order finalized personally on WhatsApp",
      phone: "+91 7096036250",
      whatsappNumber: "917096036250",
      email: "gondaliyabhavya70960@gmail.com",
      mapsUrl: "https://maps.app.goo.gl/L2NHDt9Akgqs2ZoT6",
      address: "",
      socials: {},
      defaultSeo: {
        title: "Rivya Living Art — Handcrafted Resin Art & Commissions",
        description:
          "Bespoke resin art, large-format commissions, nameplates and heirloom pieces — handcrafted to order in India.",
      },
      defaultCareNotes:
        "Dust with a soft microfibre cloth. Keep out of prolonged direct sunlight and away from sustained heat. Wipe clean — never soak. Avoid alcohol or acetone-based cleaners.",
    },
  });

  // — Legal pages (full India-appropriate originals; the upserts UPDATE
  // content + SEO too, so re-seeding refreshes the canonical legal text).
  const privacyPage = {
    title: "Privacy Policy",
    content: (await markdownToTiptap(PRIVACY_MD)) as Prisma.InputJsonValue,
    seoTitle: "Privacy Policy",
    seoDescription:
      "How Rivya Living Art handles your inquiry details — what we collect, why, and your rights. No payments are ever collected on this site.",
  };
  await db.page.upsert({
    where: { slug: "privacy" },
    update: privacyPage,
    create: { slug: "privacy", ...privacyPage },
  });

  const termsPage = {
    title: "Terms & Conditions",
    content: (await markdownToTiptap(TERMS_MD)) as Prisma.InputJsonValue,
    seoTitle: "Terms & Conditions",
    seoDescription:
      "Terms for ordering bespoke resin art, keepsakes and workshops from Rivya Living Art — quotes, timelines, shipping, returns and more.",
  };
  await db.page.upsert({
    where: { slug: "terms" },
    update: termsPage,
    create: { slug: "terms", ...termsPage },
  });

  console.log(
    `Seeded: admin ${adminEmail}, ${CATEGORIES.length} categories, ${FAQS.length} FAQs, settings, 2 legal pages (full content), 0 products (catalog is owner-fed).`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
