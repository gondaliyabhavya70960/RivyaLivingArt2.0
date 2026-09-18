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

      <LabSection
        index={4}
        title="Interaction layer — the five §6 primitives"
      >
        <p className="mb-6 max-w-2xl text-14 text-graphite">
          Four of these five are already running on this page and cannot be
          isolated into a swatch, so what follows is where to LOOK rather than
          a copy of each. The contract asks every primitive to register here
          with its reduced-motion frame shown beside the animated one; for a
          global bar and a pointer, the honest version of that is an
          instruction you can carry out in ten seconds, not a second instance
          rendered in a box — a mock scroll bar in a card would be a different
          object with the same paint.
        </p>
        <dl className="grid gap-6 sm:grid-cols-2">
          {[
            {
              id: "§6.3",
              name: "Scroll hairline",
              live: "At the very top of this viewport, already tracking. Scroll and watch the 2px champagne rule fill from the leading edge.",
              rest: "No reduced-motion frame to show: the fill is a 1:1 map of your own scroll, so nothing runs on its own. It hides entirely on any page shorter than 1.5× the viewport — narrow this window until the lab is short and it disappears.",
            },
            {
              id: "§6.4",
              name: "Route bar",
              live: "Click any tab above. It trickles to 70% over 800ms, completes on commit, fades in 180ms.",
              rest: "Under reduced motion it jumps straight to 70% and waits — it still tells you a navigation is happening, it just stops animating toward a number it is guessing at.",
            },
            {
              id: "§6.7",
              name: "Menu skin",
              live: "Open any Select or dropdown in the Components tab. The highlight is a champagne veil sliding from the leading edge, and ARROW KEYS produce exactly the same veil as the mouse — that is the point of keying it off Radix's data-highlighted.",
              rest: "The veil appears without travelling.",
            },
            {
              id: "§6.8",
              name: "Field",
              live: "Focus a field in the States tab: a champagne hairline draws across the rule from the leading edge. An invalid field holds an alert-coloured rule — a state, not a moment.",
              rest: "Both states are instant, and the error shake does not run at all.",
            },
            {
              id: "§6.15",
              name: "Tooltip",
              live: "120ms delay, mono 11px, 4px below. Hover an icon-only control — and TAB to one, because it answers keyboard focus too.",
              rest: "Appears and disappears with no fade.",
            },
            {
              id: "§6.1",
              name: "Cursor",
              live: "Storefront only, so NOT on this page — the Studio and the lab are tools and keep the system cursor. Open the public site with a mouse: an 8px champagne dot tracks exactly, a 36px hairline ring trails it, and the ring opens over anything clickable.",
              rest: "Never mounts at all — under reduced motion, on a coarse pointer, or on touch, the native cursor is simply the cursor.",
            },
          ].map((row) => (
            <div key={row.id} className="rounded-image bg-sand p-5">
              <dt className="mb-2 flex items-baseline gap-2">
                <span className="font-mono text-12 text-champagne-ink">
                  {row.id}
                </span>
                <span className="font-display text-20 text-ink">
                  {row.name}
                </span>
              </dt>
              <dd className="space-y-2 text-14 text-graphite">
                <p>{row.live}</p>
                <p>
                  <span className="u-micro">Reduced motion</span> {row.rest}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </LabSection>

      <LabSection index={5} title="Reduced motion">
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
