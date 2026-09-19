import type { Metadata } from "next";
import Link from "next/link";

import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { loadStarterFixtures } from "@/lib/starter/fixtures";
import { CONCEPT_STUDY_KIND } from "@/lib/portfolio-kind";
import { Role } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/studio/page-header";
import { FormSection } from "@/components/studio/form-section";
import { StarterPanel } from "@/components/studio/content-health/starter-panel";

export const metadata: Metadata = { title: "Content Health" };

/**
 * Content Health — what the site actually has, and what is missing.
 *
 * Distinct from Content Lab on purpose. Content Lab is the FIXTURES screen:
 * synthetic rows, marked `isDemo`, refused on a production database. This is
 * the GENUINE content screen: how much real content exists, how much of it is
 * unfinished, and a way to add the starter library that closes the gaps.
 * Putting both on one page would invite exactly the confusion that makes
 * someone seed demo data onto a live site.
 *
 * Every number here counts `isDemo: false` unless the column says otherwise,
 * so a seeded throwaway database reads the same as production does.
 */

type Row = { label: string; value: number | string; note?: string };

function Table({ rows }: { rows: Row[] }) {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <dt className="text-muted-foreground">
            {row.label}
            {row.note && (
              <span className="block text-xs opacity-70">{row.note}</span>
            )}
          </dt>
          <dd className="font-mono tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function ContentHealthPage() {
  await requireStaffPage([Role.ADMIN]);

  const real = { isDemo: false } as const;

  const [
    faqTotal,
    faqPublished,
    posts,
    postsPublished,
    postsNoCover,
    portfolioTotal,
    portfolioPublished,
    portfolioConcepts,
    portfolioNoImages,
    testimonialsTotal,
    testimonialsPublished,
    testimonialsGranted,
    researchTotal,
    mediaTotal,
    mediaNoAlt,
    inquiriesTotal,
    inquiriesDemo,
  ] = await Promise.all([
    db.faq.count({ where: real }),
    db.faq.count({ where: { ...real, status: "PUBLISHED" } }),
    db.blogPost.count({ where: real }),
    db.blogPost.count({ where: { ...real, status: "PUBLISHED" } }),
    db.blogPost.count({ where: { ...real, coverImage: null } }),
    db.portfolio.count({ where: real }),
    db.portfolio.count({ where: { ...real, status: "PUBLISHED" } }),
    db.portfolio.count({
      where: { ...real, resultsMeta: { path: ["kind"], equals: CONCEPT_STUDY_KIND } },
    }),
    db.portfolio.count({ where: { ...real, images: { none: {} } } }),
    db.testimonial.count({ where: real }),
    db.testimonial.count({ where: { ...real, status: "PUBLISHED" } }),
    db.testimonial.count({ where: { ...real, permissionStatus: "GRANTED" } }),
    db.researchRecord.count({ where: real }),
    db.media.count({ where: real }),
    db.media.count({ where: { ...real, OR: [{ alt: null }, { alt: "" }] } }),
    db.inquiry.count({ where: real }),
    db.inquiry.count({ where: { isDemo: true } }),
  ]);

  const fixtures = loadStarterFixtures();

  return (
    <div>
      <PageHeader
        eyebrow="THE REAL CONTENT"
        title="Content Health"
        description="What the public site actually has, what is unfinished, and what the starter library would add. Every count here is genuine content — demo rows are managed in Content Lab."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <FormSection
          title="Starter content"
          description="Editorial content written for this studio: the FAQ library, portfolio concept studies and internal competitor research. It is added, never overwritten — anything already in the database is left exactly as it is."
        >
          <StarterPanel
            counts={{
              Faq: fixtures.faqs.length,
              Portfolio: fixtures.concepts.length,
              ResearchRecord: fixtures.research.length,
            }}
          />
        </FormSection>

        <FormSection
          title="FAQ"
          description="The FAQ page is the cheapest trust surface on the site and the one customers reach for before messaging."
        >
          <Table
            rows={[
              { label: "Questions", value: faqTotal },
              { label: "Published", value: faqPublished },
              {
                label: "Unpublished",
                value: faqTotal - faqPublished,
                note: "Drafts are invisible to visitors.",
              },
            ]}
          />
        </FormSection>

        <FormSection title="Journal">
          <Table
            rows={[
              { label: "Articles", value: posts },
              { label: "Published", value: postsPublished },
              {
                label: "Without a cover image",
                value: postsNoCover,
                note: "These render, but the listing tile has nothing to show.",
              },
            ]}
          />
        </FormSection>

        <FormSection title="Portfolio">
          <Table
            rows={[
              { label: "Cases", value: portfolioTotal },
              { label: "Published", value: portfolioPublished },
              {
                label: "Concept studies",
                value: portfolioConcepts,
                note: "Labelled as studio design studies, never as client commissions.",
              },
              {
                label: "Without any images",
                value: portfolioNoImages,
                note: "A case page with no photography is not worth publishing.",
              },
            ]}
          />
        </FormSection>

        <FormSection
          title="Testimonials"
          description="Only a customer's real, permitted words belong here. Nothing on this screen will ever write one for you."
        >
          <Table
            rows={[
              { label: "Testimonials", value: testimonialsTotal },
              { label: "Published", value: testimonialsPublished },
              {
                label: "With permission granted",
                value: testimonialsGranted,
                note: "Publishing needs permission; the review schema only counts these.",
              },
            ]}
          />
        </FormSection>

        <FormSection title="Research, media and inquiries">
          <Table
            rows={[
              {
                label: "Research records",
                value: researchTotal,
                note: "Internal only — never published, never in the sitemap.",
              },
              { label: "Media files", value: mediaTotal },
              {
                label: "Media without alt text",
                value: mediaNoAlt,
                note: "Alt text set here is inherited everywhere the file is used.",
              },
              { label: "Genuine inquiries", value: inquiriesTotal },
              {
                label: "Demo inquiries",
                value: inquiriesDemo,
                note: "Excluded from analytics. Managed in Content Lab.",
              },
            ]}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Demo rows are counted and removed on the{" "}
            <Link href="/studio/content-lab" className="underline">
              Content Lab
            </Link>{" "}
            screen.
          </p>
        </FormSection>
      </div>
    </div>
  );
}
