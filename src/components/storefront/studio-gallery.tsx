import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { SectionHeading } from "@/components/storefront/section-heading";
import { cn } from "@/lib/utils";

/** One photograph of the real studio. Local `/media` art only — Part 0. */
export type StudioPhoto = {
  src: string;
  /** The slot's 20px LQIP when one is recorded for the resolved file — null
   *  is the resolver's own "none known", forwarded as it stands. */
  blurDataURL?: string | null;
  alt: string;
};

/**
 * A mono fact beside the photographs — `ADDRESS` and nothing else today.
 * Rendered only when the owner has actually filled the field in Site
 * Settings; an empty value never reaches this component, so the block is a
 * real fact or it is absent (§16 — no placeholder pretending to be data).
 */
export type StudioFact = {
  /** Mono micro label, pre-translated: "ADDRESS". */
  label: string;
  value: string;
  /** Optional destination — the studio's Google Maps URL. */
  href?: string;
  /** Screen-reader suffix for an external link (Common.openInNewTab). */
  newTabLabel?: string;
};

/* Full literals: Tailwind's scanner cannot extract a class assembled from a
   template string, and the column count is data-driven. */
const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * The studio, in photographs — REDESIGN.md §11.3 item 6 ("three photographs,
 * address, hours") and §11.5 item 7 ("four photographs of the real studio
 * space").
 *
 * One component for both because they are the same block: a section heading,
 * a row of real studio photography revealed through the meniscus mask, and —
 * underneath — whatever verifiable facts the studio actually has on file.
 *
 * **Facts, not furniture.** The address comes from `getSiteSettings()`. When
 * the owner has not filled it, the row simply does not render: Part 0 forbids
 * inventing studio detail, and a greyed-out "123 Studio Lane" would be
 * exactly that. Opening hours have no field in the data model at all, so
 * nothing here pretends to know them.
 *
 * Server component — photographs and text, no state.
 */
export function StudioGallery({
  eyebrow,
  heading,
  intro,
  headingId,
  photos,
  facts = [],
  action,
  tone = "mineral",
  className,
}: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  /** Id for the section's `aria-labelledby` — Part 17. */
  headingId: string;
  photos: StudioPhoto[];
  facts?: StudioFact[];
  action?: React.ReactNode;
  tone?: "mineral" | "sand";
  className?: string;
}) {
  if (photos.length === 0) return null;

  const columns = COLUMNS[Math.min(photos.length, 4)] ?? COLUMNS[3];

  return (
    <section
      data-slot="sf-studio-gallery"
      aria-labelledby={headingId}
      className={cn(
        "section-standard",
        tone === "sand" ? "bg-sand" : "bg-mineral",
        className,
      )}
    >
      <div className="u-shell flex flex-col gap-12">
        <SectionHeading
          id={headingId}
          eyebrow={eyebrow}
          title={heading}
          intro={intro}
          action={action}
        />

        <ul className={cn("grid gap-4 md:gap-6", columns)}>
          {photos.map((photo) => (
            <li key={photo.src}>
              <MeniscusImage
                src={photo.src}
                blurDataURL={photo.blurDataURL}
                alt={photo.alt}
                width={900}
                height={1125}
                sizes="(min-width:1024px) 24vw, (min-width:640px) 45vw, 90vw"
                className="aspect-[4/5] rounded-image"
                imageClassName="object-cover"
              />
            </li>
          ))}
        </ul>

        {facts.length > 0 ? (
          <dl className="flex flex-col gap-6 border-t border-hairline pt-8 sm:flex-row sm:gap-16">
            {facts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-2">
                <dt className="u-micro">{fact.label}</dt>
                <dd className="max-w-prose font-body text-body leading-relaxed text-ink in-data-[theme=navy]:text-mineral">
                  {fact.href ? (
                    <a
                      href={fact.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-input underline decoration-hairline underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
                    >
                      {fact.value}
                      {fact.newTabLabel ? (
                        <span className="sr-only"> {fact.newTabLabel}</span>
                      ) : null}
                    </a>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}
