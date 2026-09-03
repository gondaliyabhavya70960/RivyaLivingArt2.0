import { Star } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Badge } from "@/components/storefront/badge";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { ErrorState } from "@/components/storefront/error-state";
import {
  SelectField,
  TelField,
  TextField,
  TextareaField,
} from "@/components/storefront/form-field";
import { RatingStars } from "@/components/storefront/rating-stars";
import {
  ProductCardSkeleton,
  TextSkeleton,
} from "@/components/storefront/skeletons";
import { buildWaLink } from "@/lib/whatsapp";
import { FilterChipsDemo } from "@/app/design-lab/demos";

import { LabSection } from "./lab-section";

const WA_HREF = buildWaLink("Hello Rivya Living Art! (design lab specimen)");

/**
 * Every live storefront primitive at the component level — REDESIGN.md
 * Part 3 (buttons, badges, form fields) and Part 9 (the six-state and
 * empty/error/loading contracts). One instance per variant, side by side,
 * so a drift from spec is visible without opening a real page.
 */
export function ComponentsTab() {
  return (
    <div className="space-y-16">
      <LabSection index={1} title="Buttons">
        <p className="mb-4 text-14 text-graphite">
          Five variants × three sizes. No scale or lift on hover — colour and
          underline only (Part 14).
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Primary · sm</Button>
          <Button size="md">Primary · md</Button>
          <Button size="lg">Primary · lg</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button variant="secondary">Secondary</Button>
          <Button variant="whatsapp" asChild>
            <a href={WA_HREF}>Place order on WhatsApp</a>
          </Button>
          <Button variant="ghost">Ghost</Button>
        </div>
        <div
          className="mt-4 flex flex-wrap items-center gap-4 rounded-image bg-obsidian p-6"
          data-theme="navy"
        >
          <Button variant="premium">Premium (dark ground)</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button disabled reason="Add your phone number">
            Disabled with reason
          </Button>
          <Button loading loadingLabel="Sending">
            Loading
          </Button>
        </div>
      </LabSection>

      <LabSection index={2} title="Badges &amp; filter chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="atelierPick">Atelier pick</Badge>
          <Badge variant="madeToOrder">Made to order · 7 days</Badge>
          <Badge variant="shipsIn">Ships in 7–10 days</Badge>
        </div>
        <div className="mt-6">
          <FilterChipsDemo />
        </div>
      </LabSection>

      <LabSection index={3} title="Rating stars">
        <div className="flex flex-wrap items-center gap-6">
          <RatingStars rating={5} />
          <RatingStars rating={4} />
          <RatingStars rating={0} />
        </div>
      </LabSection>

      <LabSection index={4} title="Accordion">
        <Accordion type="single" collapsible className="max-w-xl">
          <AccordionItem value="care">
            <AccordionTrigger>Care instructions</AccordionTrigger>
            <AccordionContent>
              Wipe with a soft, dry cloth. Keep away from prolonged direct
              sunlight; resin loves light, not heat.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="lead">
            <AccordionTrigger>How long does it take?</AccordionTrigger>
            <AccordionContent>
              Every piece is poured to order — most ship in 7–10 days.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </LabSection>

      <LabSection index={5} title="Form fields">
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            label="Your name"
            name="lab-name"
            required
            placeholder="Full name"
          />
          <TelField
            label="Phone (WhatsApp)"
            name="lab-phone"
            required
            placeholder="+91 …"
            hint="We confirm every order on WhatsApp."
          />
          <TextField
            label="Email"
            name="lab-email"
            type="email"
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
      </LabSection>

      <LabSection index={6} title="Empty · error · loading states">
        <p className="mb-4 text-14 text-graphite">
          §9&apos;s contract: statement → one line of direction → one action.
          Never shown alongside populated content.
        </p>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-image border border-hairline p-6">
            <p className="mb-3 font-mono text-12 text-graphite uppercase">
              Empty
            </p>
            <EmptyState
              statement="No commissions yet."
              direction="Your next project starts with an idea."
              action={<Button size="sm">Start a commission</Button>}
            />
          </div>
          <div className="rounded-image border border-hairline p-6">
            <p className="mb-3 font-mono text-12 text-graphite uppercase">
              Error
            </p>
            <ErrorState
              statement="Something went wrong."
              reassurance="Nothing was lost — try again, or reach us directly."
              retryLabel="Try again"
              whatsappHref={WA_HREF}
              whatsappLabel="Message us on WhatsApp"
              headingLevel="h3"
            />
          </div>
        </div>
        <div className="mt-8">
          <p className="mb-3 font-mono text-12 text-graphite uppercase">
            Loading — flat sand skeletons, no shimmer
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ProductCardSkeleton />
            <div className="space-y-4 pt-2">
              <TextSkeleton lines={4} />
            </div>
          </div>
        </div>
      </LabSection>

      <LabSection index={7} title="Icon-only button (44px floor)">
        <Button size="icon" aria-label="Add to wishlist">
          <Star aria-hidden />
        </Button>
      </LabSection>
    </div>
  );
}
