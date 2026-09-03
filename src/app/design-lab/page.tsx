import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { requireStaffPage } from "@/actions/helpers";
import { ComponentsTab } from "@/components/design-lab/components";
import { SectionsTab } from "@/components/design-lab/sections";
import { MotionTab } from "@/components/design-lab/motion";
import { ResponsiveTab } from "@/components/design-lab/frames";
import { StatesTab } from "@/components/design-lab/states";
import { ContentTab } from "@/components/design-lab/content";

const TABS = [
  { key: "components", label: "Components" },
  { key: "sections", label: "Sections" },
  { key: "motion", label: "Motion" },
  { key: "responsive", label: "Responsive" },
  { key: "states", label: "States" },
  { key: "content", label: "Content" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | undefined): value is TabKey {
  return TABS.some((tab) => tab.key === value);
}

function TabNav({ active }: { active: TabKey }) {
  return (
    <nav
      aria-label="Design lab sections"
      className="sticky top-0 z-10 border-b border-hairline bg-mineral/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap gap-1 px-6 py-3">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={
              tab.key === "components"
                ? "/design-lab"
                : `/design-lab?tab=${tab.key}`
            }
            aria-current={active === tab.key ? "page" : undefined}
            className={
              active === tab.key
                ? "rounded-full bg-obsidian px-4 py-1.5 font-mono text-12 uppercase tracking-[0.1em] text-mineral"
                : "rounded-full px-4 py-1.5 font-mono text-12 uppercase tracking-[0.1em] text-graphite transition-colors hover:text-ink"
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/**
 * The design lab — REDESIGN.md's staff-only review surface (D17) for the
 * live v3 storefront primitives, replacing the old v2 "Phase 1 kitchen
 * sink" (which rendered v2.0-tokened components deleted or superseded long
 * ago: `product-card.tsx`, `tabs.tsx`, `order-summary-preview.tsx`,
 * `marquee.tsx` — none of them import here any more, and are removed in
 * this same change). Six tabs, switched by `?tab=`, each a thin server
 * component:
 *
 *   Components — button variants/sizes/states, badge, filter chip,
 *     accordion, form field, empty/error/loading states, rating stars.
 *   Sections   — SectionHeading, a CollectionCard trio, CatalogProductCard
 *     on mock data, TestimonialCard.
 *   Motion     — Reveal, a MeniscusImage demo, a CureLine mock, the
 *     reduced-motion note.
 *   Responsive — four same-origin iframes onto the live homepage at
 *     360/390/768/1280.
 *   States     — the six-state contract (default/hover/focus/active/
 *     disabled/loading) plus empty/error/loading list states.
 *   Content    — copy-slot and image-slot counts read from the live
 *     registries, so the number on screen is never stale.
 *
 * Mock data lives in `mock-data.ts`, quarantined by
 * `design-lab-isolation.test.ts`. Two independent gates keep it off the
 * public site: `requireStaffPage()` (HARD RULE 3 — mock products are never
 * publicly reachable) and the production-only 404 below, which holds even
 * for a logged-in staff member on a live deploy.
 */
export default async function DesignLabPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireStaffPage();

  // Mock data must never serve in production (Part 0): 404 on Vercel prod
  // AND on any non-Vercel production build; only dev and Vercel previews
  // render the lab, regardless of who is signed in.
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV !== "preview"
  ) {
    notFound();
  }

  // The lab lives outside the [locale] tree (middleware-excluded), but
  // several primitives resolve a request locale — seed it explicitly.
  setRequestLocale("en");

  const { tab: rawTab } = await searchParams;
  const tab: TabKey = isTabKey(rawTab) ? rawTab : "components";

  return (
    <main className="pb-24">
      <header className="mx-auto max-w-6xl px-6 py-12">
        <p className="font-mono text-12 tracking-[0.22em] text-champagne-ink uppercase">
          Staff only · dev &amp; preview only
        </p>
        <h1 className="mt-3 font-display text-49 tracking-display text-ink">
          Design lab
        </h1>
        <p className="mt-4 max-w-2xl text-16 text-graphite">
          The live v3 storefront components, reviewed against REDESIGN.md at
          1280 and 375. Mock data only — never a catalog, and this page 404s
          outside development and preview builds.
        </p>
      </header>

      <TabNav active={tab} />

      <div className="mx-auto max-w-6xl px-6 py-12">
        {tab === "components" && <ComponentsTab />}
        {tab === "sections" && <SectionsTab />}
        {tab === "motion" && <MotionTab />}
        {tab === "responsive" && <ResponsiveTab />}
        {tab === "states" && <StatesTab />}
        {tab === "content" && <ContentTab />}
      </div>
    </main>
  );
}
