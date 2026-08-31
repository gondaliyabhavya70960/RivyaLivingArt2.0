import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { Badge } from "@/components/storefront/badge";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { Footer } from "@/components/storefront/footer";
import {
  EmailField,
  SelectField,
  TelField,
  TextField,
  TextareaField,
} from "@/components/storefront/form-field";
import { Marquee } from "@/components/storefront/marquee";
import { NewsletterForm } from "@/components/sections/newsletter-form";
import { OrderSummaryPreview } from "@/components/storefront/order-summary-preview";
import { Pagination } from "@/components/storefront/pagination";
import { ProductCard } from "@/components/storefront/product-card";
import { RatingStars } from "@/components/storefront/rating-stars";
import {
  ProductCardSkeleton,
  TextSkeleton,
} from "@/components/storefront/skeletons";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/storefront/tabs";
import { TestimonialCard } from "@/components/storefront/testimonial-card";
import { SfToaster } from "@/components/storefront/toast";
import { FOOTER_LINKS } from "@/lib/constants";
import { buildWaLink } from "@/lib/whatsapp";

import {
  CustomizationDemo,
  FilterChipsDemo,
  OverlayDemo,
  UploaderDemo,
} from "./demos";
import {
  MOCK_CUSTOMER,
  MOCK_PRODUCTS,
  MOCK_SELECTIONS,
  MOCK_TESTIMONIALS,
  MOCK_WA_MESSAGE,
} from "./mock-data";

/**
 * Phase 1 kitchen sink (DESIGN.md E6): every B3 storefront component with
 * dev-only mock data, reviewed against Part A at 1280/375. NOT a shipped
 * page — 404s in production (mock data must never deploy, Part 0); the
 * route is middleware-excluded from locale routing and noindexed.
 */

const WA_HREF = buildWaLink("Hello ResinRiva! (design-lab placeholder)");

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-8 flex items-baseline gap-3">
      <span className="font-mono text-12 text-champagne-ink">{n}</span>
      <h2 className="font-display text-31 text-ink">{title}</h2>
    </div>
  );
}

export default function DesignLabPage() {
  // Mock data must never serve in production (Part 0): 404 on Vercel prod
  // AND on any non-Vercel production build; only dev and Vercel previews
  // render the lab.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  ) {
    notFound();
  }
  // The lab lives outside the [locale] tree (middleware-excluded), but
  // ProductCard links through next-intl's Link — seed its request locale.
  setRequestLocale("en");

  return (
    <>
      {/* The v7 parallel header (Navbar/MegaMenu/WhatsAppPill) was retired
          with the S-04 cleanup — the live chrome is SiteHeader, exercised on
          the real site, not re-mocked here. */}
      <main className="pt-24">
        {/* ————— Intro (canvas band) ————— */}
        <header className="mx-auto max-w-6xl px-6 py-16">
          <p className="font-mono text-12 tracking-[0.22em] text-champagne-ink uppercase">
            Phase 1 · dev-only kitchen sink
          </p>
          <h1 className="mt-3 font-display text-49 tracking-display text-ink">
            Liquid Light × Midnight Gild
          </h1>
          <p className="mt-4 max-w-2xl text-16 text-graphite">
            Every B3 storefront component on the v2.0 tokens. Mock data only —
            never a catalog. This page 404s in production.
          </p>
        </header>

        {/* ————— Type & palette specimen (white band) ————— */}
        <section className="bg-sand">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionLabel n="01" title="Type & palette" />
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="font-display text-39 tracking-display text-ink">
                  Memories, cast in light
                </p>
                <p className="font-body text-16 text-ink">
                  Inter carries the interface — quiet, precise, ss03.
                </p>
                <p className="font-mono text-14 text-graphite">
                  SKU RR-0042 · from ₹1,499 · lab-note captions
                </p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  ["bg-obsidian", "navy"],
                  ["bg-sapphire", "royal"],
                  ["bg-champagne", "steel"],
                  ["bg-sand", "powder"],
                  ["bg-sand", "ice"],
                  ["bg-ink", "ink"],
                  ["bg-graphite", "slate"],
                  ["bg-hairline", "mist"],
                  ["bg-mineral border border-hairline", "canvas"],
                  ["bg-sand border border-hairline", "card"],
                  ["bg-champagne", "gold"],
                  ["bg-champagne-ink", "antique"],
                  ["bg-champagne-ink", "bronze"],
                  ["bg-champagne", "champagne"],
                  ["bg-sapphire-hi", "sapphire"],
                ].map(([cls, name]) => (
                  <div key={name} className="min-w-0 space-y-1">
                    <div className={`h-12 rounded-input ${cls}`} />
                    <p className="truncate font-mono text-12 text-graphite">
                      {name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ————— Buttons, badges, stars (canvas band) ————— */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionLabel n="02" title="Buttons · badges · stars" />
          <div className="flex flex-wrap items-center gap-4">
            <Button>Customize this piece</Button>
            <Button variant="secondary">View collection</Button>
            <Button variant="ghost">Learn more</Button>
            <Button disabled>Unavailable</Button>
            <Button variant="whatsapp">Place Order on WhatsApp</Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge variant="madeToOrder">New</Badge>
            <Badge variant="atelierPick">Bestseller</Badge>
            <Badge variant="madeToOrder">Made to order · 7 days</Badge>
            <Badge variant="madeToOrder">Limited</Badge>
            <RatingStars rating={4} />
          </div>
          <div className="mt-8 overflow-hidden rounded-input">
            <AnnouncementBar
              messages={[
                "Every piece is made to order",
                "Orders finalize on WhatsApp",
                "We preserve varmalas & memories in resin",
              ]}
            />
          </div>
          <div className="mt-8">
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Shop", href: "/shop" },
                { label: "Ocean Wave Coaster Set" },
              ]}
            />
          </div>
        </section>

        {/* ————— Product cards + skeletons (canvas — white cards need the
            ivory ground, as on the real PLP) ————— */}
        <section>
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionLabel n="03" title="Product cards · skeletons" />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              {MOCK_PRODUCTS.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
              <ProductCardSkeleton />
              <div className="space-y-4 pt-2">
                <TextSkeleton lines={4} />
              </div>
            </div>
            <div className="mt-10">
              <FilterChipsDemo />
            </div>
            <div className="mt-10">
              <Pagination
                currentPage={3}
                totalPages={12}
                hrefFor={(p) => `?page=${p}`}
              />
            </div>
          </div>
        </section>

        {/* ————— Marquee (white band — restores the A2 r6 rhythm after two
            canvas sections) ————— */}
        <section className="bg-sand py-16">
          <div className="mx-auto max-w-6xl px-6">
            <SectionLabel n="04" title="Marquee" />
          </div>
          <Marquee>
            {["Ocean waves", "Gilded geodes", "Varmala keepsakes", "Pressed blooms", "Midnight & gold"].map(
              (t) => (
                <span
                  key={t}
                  className="mx-8 font-display text-25 whitespace-nowrap text-ink"
                >
                  {t} <span aria-hidden className="mx-4 text-champagne-ink">·</span>
                </span>
              ),
            )}
          </Marquee>
        </section>

        {/* ————— Navy storytelling band ————— */}
        <section data-theme="navy" className="bg-obsidian">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="font-mono text-12 tracking-[0.22em] text-champagne uppercase">
              05 · On midnight navy
            </p>
            <h2 className="mt-3 max-w-xl font-display text-39 tracking-display text-mineral">
              Hold the moment.{" "}
              <em className="text-champagne not-italic">Forever.</em>
            </h2>
            <p className="mt-4 max-w-lg text-16 text-mist">
              The dark-luxury register: true gold lives here, buttons keep
              royal as the one interactive color, focus rings turn gold.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button>Preserve a memory</Button>
              <Button variant="secondary">Our craft</Button>
              <Badge variant="atelierPick">Bestseller</Badge>
              <Badge variant="madeToOrder">New</Badge>
              <RatingStars rating={5} />
            </div>
          </div>
        </section>

        {/* ————— Testimonials (canvas) ————— */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionLabel n="06" title="Testimonials" />
          <div className="grid gap-6 md:grid-cols-2">
            {MOCK_TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.quote} {...t} />
            ))}
          </div>
        </section>

        {/* ————— Forms (white band) ————— */}
        <section className="bg-sand">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionLabel n="07" title="Form fields · validation · newsletter" />
            <div className="grid gap-6 md:grid-cols-2">
              <TextField label="Your name" name="lab-name" required placeholder="Full name" />
              <TelField
                label="Phone (WhatsApp)"
                name="lab-phone"
                required
                placeholder="+91 …"
                hint="We confirm every order on WhatsApp."
              />
              <EmailField
                label="Email"
                name="lab-email"
                placeholder="you@example.com"
                error="That email address doesn't look right."
                defaultValue="not-an-email"
              />
              <SelectField
                label="Occasion"
                name="lab-occasion"
                placeholder="Choose an occasion"
                options={[
                  { value: "birthday", label: "Birthday" },
                  { value: "anniversary", label: "Anniversary" },
                  { value: "wedding", label: "Wedding gift" },
                ]}
              />
              <div className="md:col-span-2">
                <TextareaField
                  label="Notes for the artist"
                  name="lab-notes"
                  placeholder="Tell us about the piece you imagine…"
                />
              </div>
            </div>
            <div className="mt-12 max-w-xl">
              <NewsletterForm />
            </div>
          </div>
        </section>

        {/* ————— Customization controls (canvas) ————— */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <SectionLabel n="08" title="Customization controls" />
          <CustomizationDemo />
        </section>

        {/* ————— Order flow pieces (white band) ————— */}
        <section className="bg-sand">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <SectionLabel n="09" title="Order summary · uploader · overlays" />
            <div className="grid items-start gap-8 lg:grid-cols-2">
              <OrderSummaryPreview
                message={MOCK_WA_MESSAGE}
                productTitle="Ocean Wave Coaster Set"
                selections={[...MOCK_SELECTIONS]}
                customer={{ ...MOCK_CUSTOMER }}
              />
              <div className="space-y-8">
                <UploaderDemo />
                <OverlayDemo />
              </div>
            </div>
            <div className="mt-12 grid gap-10 lg:grid-cols-2">
              <div>
                <h3 className="mb-4 font-body text-16 font-medium text-ink">
                  Accordion
                </h3>
                <Accordion type="single" collapsible>
                  <AccordionItem value="care">
                    <AccordionTrigger>Care instructions</AccordionTrigger>
                    <AccordionContent>
                      Wipe with a soft, dry cloth. Keep away from prolonged
                      direct sunlight; resin loves light, not heat.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="lead">
                    <AccordionTrigger>How long does it take?</AccordionTrigger>
                    <AccordionContent>
                      Every piece is poured to order — most ship in 7–10 days.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <div>
                <h3 className="mb-4 font-body text-16 font-medium text-ink">
                  Tabs
                </h3>
                <Tabs defaultValue="specs">
                  <TabsList>
                    <TabsTrigger value="specs">Specs</TabsTrigger>
                    <TabsTrigger value="materials">Materials</TabsTrigger>
                    <TabsTrigger value="shipping">Shipping</TabsTrigger>
                  </TabsList>
                  <TabsContent value="specs">
                    <p className="text-14 text-graphite">
                      20 cm hexagon · 8 mm thick · felt-padded base.
                    </p>
                  </TabsContent>
                  <TabsContent value="materials">
                    <p className="text-14 text-graphite">
                      Non-toxic UV epoxy resin, gold leaf, preserved botanicals.
                    </p>
                  </TabsContent>
                  <TabsContent value="shipping">
                    <p className="text-14 text-graphite">
                      Insured shipping across India; details settled on
                      WhatsApp.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer
        whatsappHref={WA_HREF}
        exploreLinks={[...FOOTER_LINKS.explore]}
        studioLinks={[...FOOTER_LINKS.studio]}
        journalLinks={[...FOOTER_LINKS.journal]}
        legalLinks={[...FOOTER_LINKS.legal]}
      />
      <SfToaster />
    </>
  );
}
