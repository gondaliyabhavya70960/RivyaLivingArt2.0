import { Icon, ICON_NAMES } from "@/components/icons";
import {
  EmptyFaqsArt,
  EmptyInquiriesArt,
  EmptyJournalArt,
  EmptyMediaArt,
  EmptyPortfolioArt,
  EmptyProductsArt,
  EmptyScraperArt,
  EmptySearchArt,
  EmptySubscribersArt,
  EmptyTestimonialsArt,
} from "@/components/icons/empty-art";
import {
  CONTENT_STATUS_ICON,
  INQUIRY_STATUS_ICON,
  MEDIA_TYPE_ICON,
  PRODUCT_IMAGE_ROLE_ICON,
  PROVENANCE_ICON,
  REVIEW_STATUS_ICON,
  ROLE_ICON,
  SCRAPE_JOB_STATUS_ICON,
  SIZE_TIER_ICON,
  TESTIMONIAL_STATUS_ICON,
} from "@/components/icons/status";

import { LabSection } from "./lab-section";

/**
 * The Icons sheet — §4.5's "every mark at 16/20/24, on all three elevation
 * steps, with its name string".
 *
 * The three grounds are the point of the sheet rather than a flourish. Every
 * mark is `stroke="currentColor"`, so the only way to know a mark reads on
 * `elev-2` as well as on the page ground is to look at it on both — and the
 * elevation ladder (D30) is what a Studio panel is actually built from.
 *
 * The three SIZES are the other half: a 24px grid at 16px is where a mark
 * either holds its shape or turns to mud, and that is a drawing decision no
 * review of the source can make.
 */

const STATUS_MAPS = [
  ["InquiryStatus", INQUIRY_STATUS_ICON],
  ["ContentStatus", CONTENT_STATUS_ICON],
  ["TestimonialStatus", TESTIMONIAL_STATUS_ICON],
  ["ReviewStatus", REVIEW_STATUS_ICON],
  ["ScrapeJobStatus", SCRAPE_JOB_STATUS_ICON],
  ["MediaType", MEDIA_TYPE_ICON],
  ["Provenance", PROVENANCE_ICON],
  ["ProductImageRole", PRODUCT_IMAGE_ROLE_ICON],
  ["ProductSizeTier", SIZE_TIER_ICON],
  ["Role", ROLE_ICON],
] as const;

const EMPTY_ART = [
  ["products", EmptyProductsArt],
  ["inquiries", EmptyInquiriesArt],
  ["media", EmptyMediaArt],
  ["blog", EmptyJournalArt],
  ["portfolio", EmptyPortfolioArt],
  ["testimonials", EmptyTestimonialsArt],
  ["faqs", EmptyFaqsArt],
  ["subscribers", EmptySubscribersArt],
  ["scraper runs", EmptyScraperArt],
  ["search — no results", EmptySearchArt],
] as const;

const GROUNDS = [
  ["elev-0 · page", "bg-elev-0"],
  ["elev-1 · panel", "bg-elev-1"],
  ["elev-2 · raised", "bg-elev-2"],
] as const;

export function IconsTab() {
  return (
    <div className="space-y-16">
      <LabSection index={1} title="Every mark, at every size, on every step">
        <p className="mb-6 max-w-2xl text-14 text-graphite">
          {ICON_NAMES.length} hand-authored marks. 24px grid, 1.5px stroke,
          round caps and joins, <code className="font-mono text-12">fill</code>{" "}
          none, <code className="font-mono text-12">stroke</code> currentColor —
          so each one inherits the ink of wherever it is dropped. Check them at{" "}
          <strong>16</strong>, which is the table size and the one where a 24px
          drawing either holds or turns to mud.
        </p>
        <div className="space-y-4">
          {GROUNDS.map(([label, ground]) => (
            <div key={ground} className={`rounded-image ${ground} p-5`}>
              <p className="u-micro mb-4">{label}</p>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {ICON_NAMES.map((name) => (
                  <li key={name} className="flex items-center gap-3">
                    <span className="flex items-baseline gap-2 text-ink">
                      <Icon name={name} size={16} />
                      <Icon name={name} size={20} />
                      <Icon name={name} size={24} />
                    </span>
                    <code className="font-mono text-12 text-graphite">
                      {name}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LabSection>

      <LabSection index={2} title="Status marks, read from the real enums">
        <p className="mb-6 max-w-2xl text-14 text-graphite">
          Every value below comes from{" "}
          <code className="font-mono text-12">prisma/schema.prisma</code> via
          the generated client, and each map is a{" "}
          <code className="font-mono text-12">
            Record&lt;Enum, IconName&gt;
          </code>{" "}
          — so adding a state to the schema stops this project compiling until
          the state has a mark. Three of the four briefs merged into this work
          named statuses that do not exist here (<em>poured</em>,{" "}
          <em>shipped</em>, five roles); a mark for a state that cannot occur is
          worse than a missing one, because it renders in a legend and a reader
          reasonably concludes the pipeline has a stage it does not.
        </p>
        <p className="mb-6 max-w-2xl text-14 text-graphite">
          Read them <strong>in one ink</strong>, which is how they are printed
          here on purpose: §16 forbids communicating state by colour alone, and
          a set of status dots that differ only in hue breaks that rule with an
          icon instead of a swatch. If two of these are hard to tell apart
          below, they are hard to tell apart in a table.
        </p>
        <div className="space-y-6">
          {STATUS_MAPS.map(([name, map]) => (
            <div key={name}>
              <p className="u-micro mb-3">{name}</p>
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {Object.entries(map).map(([value, icon]) => (
                  <li key={value} className="flex items-center gap-2">
                    <Icon name={icon} size={18} className="text-ink" />
                    <code className="font-mono text-12 text-graphite">
                      {value}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LabSection>

      <LabSection index={3} title="Empty-state art — and its resting frame">
        <p className="mb-6 max-w-2xl text-14 text-graphite">
          One per list surface, 96px, drawn at 1px on a 96 grid rather than
          scaled from the 24px set — a 1.5px stroke enlarged four times is a 6px
          stroke and reads as a cartoon. Each self-draws once over 600ms via{" "}
          <code className="font-mono text-12">stroke-dashoffset</code>. Reload
          to see it. Under{" "}
          <code className="font-mono text-12">prefers-reduced-motion</code> the
          animation does not exist at all and the mark renders complete — not a
          0.01ms version of the same draw, which on a line drawing is a flicker
          rather than an absence.
        </p>
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {EMPTY_ART.map(([label, Mark]) => (
            <li
              key={label}
              className="flex flex-col items-center gap-3 rounded-image bg-elev-1 p-5"
            >
              <Mark size={72} />
              <code className="text-center font-mono text-12 text-graphite">
                {label}
              </code>
            </li>
          ))}
        </ul>
      </LabSection>

      <LabSection index={4} title="What is deliberately NOT here">
        <div className="max-w-2xl space-y-3 text-14 text-graphite">
          <p>
            <strong className="text-ink">Interface glyphs.</strong>{" "}
            <code className="font-mono text-12">lucide-react</code> stays for
            search, edit, delete, save, settings, chevron and close (owner
            decision 14). Those are shapes a person already knows; replacing
            them with abstract brand art costs recognition and buys nothing.
            What is hand-authored is what lucide cannot know — this
            studio&rsquo;s craft, and this schema&rsquo;s state.
          </p>
          <p>
            <strong className="text-ink">A generated set.</strong> Every mark
            here is hand-authored SVG (owner decision 15). No Higgsfield, no
            second icon package.
          </p>
          <p>
            <strong className="text-ink">Colour variants.</strong> There is one
            of each mark, and it inherits its ink. A{" "}
            <code className="font-mono text-12">
              variant=&quot;danger&quot;
            </code>{" "}
            prop would be a second place for a colour decision that the row
            already made.
          </p>
        </div>
      </LabSection>
    </div>
  );
}
