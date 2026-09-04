import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { Reveal } from "@/components/motion/reveal";

import { LabSection } from "./lab-section";

const MOCK_CURE_MARKS: readonly CureMark[] = [
  { id: "lab-mark-01", label: "THE POUR" },
  { id: "lab-mark-02", label: "THE GILD" },
  { id: "lab-mark-03", label: "THE CURE", dark: true },
];

/**
 * The two signature devices (REDESIGN.md §2.6/§2.7) plus the two generic
 * motion primitives — reviewed in place, not described.
 */
export function MotionTab() {
  return (
    <div className="space-y-16">
      <LabSection index={1} title="Reveal — rise + fade on scroll">
        <p className="mb-4 text-14 text-graphite">
          16–24px rise + opacity, 350ms, once. Scroll the page to trigger it;
          under reduced motion it jumps straight to the final state.
        </p>
        <Reveal>
          <div className="rounded-image bg-sand p-8 font-display text-25 text-ink">
            This block rises into place.
          </div>
        </Reveal>
      </LabSection>

      <LabSection
        index={2}
        title="Meniscus reveal — the only image reveal on the site"
      >
        <p className="mb-4 text-14 text-graphite">
          A horizontal edge rises from the bottom with a bright leading line.
          Scroll this frame out of view and back to see it fire.
        </p>
        <div className="relative aspect-[4/5] max-w-sm overflow-hidden rounded-image">
          <MeniscusImage
            src="/media/v3/story-cure.avif"
            alt="A cured resin surface catching light"
            fill
            sizes="384px"
            imageClassName="object-cover"
          />
        </div>
      </LabSection>

      <LabSection index={3} title="Cure line — mock marks">
        <p className="mb-4 text-14 text-graphite">
          Fixed in the left gutter (≥1024px only — below that it collapses to a
          top progress bar, not shown here), tracking THIS page&apos;s own
          scroll against the three anchors below. Real component, real
          measurement, mock section content.
        </p>
        <CureLine marks={MOCK_CURE_MARKS} />
        <div className="space-y-6 lg:ps-cure">
          <div id="lab-mark-01" className="rounded-image bg-sand p-6">
            <p className="u-micro">01 · The pour</p>
          </div>
          <div id="lab-mark-02" className="rounded-image bg-sand p-6">
            <p className="u-micro">02 · The gild</p>
          </div>
          <div
            id="lab-mark-03"
            data-theme="navy"
            className="rounded-image bg-obsidian p-6 text-mineral"
          >
            <p className="u-micro">03 · The cure</p>
          </div>
        </div>
      </LabSection>

      <LabSection index={4} title="Reduced motion">
        <p className="max-w-lg text-14 text-graphite">
          <code className="font-mono text-12">
            prefers-reduced-motion: reduce
          </code>{" "}
          disables parallax, large transforms, autoplay, pinned scrubs and the
          marquee, and jumps every reveal straight to its final state — set it
          in your OS/browser settings and reload this page to verify: the Reveal
          block above should render fully visible immediately, with no
          animation.
        </p>
      </LabSection>
    </div>
  );
}
