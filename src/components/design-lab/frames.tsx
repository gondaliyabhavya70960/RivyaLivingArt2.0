import { LabSection } from "./lab-section";

const WIDTHS = [360, 390, 768, 1280] as const;

/**
 * The live homepage at REDESIGN.md's four audit widths, side by side. The
 * storefront ships `X-Frame-Options: SAMEORIGIN` (same origin the design
 * lab itself runs on), so these frames load without a CSP change.
 */
export function ResponsiveTab() {
  return (
    <LabSection index={1} title="The homepage at the four audit widths">
      <p className="mb-6 max-w-2xl text-14 text-graphite">
        360 and 390 (phone), 768 (tablet), 1280 (desktop) — the widths
        `redesign-audit.mjs` and `a11y-audit.mjs` check on every PR. Each frame
        is unscaled: what you see is the pixel width in the label.
      </p>
      <div className="flex flex-wrap items-start gap-6 overflow-x-auto pb-4">
        {WIDTHS.map((width) => (
          <div key={width} className="shrink-0">
            <p className="u-micro mb-2">
              {width}
              <span aria-hidden> px</span>
            </p>
            <iframe
              src="/"
              title={`Homepage preview at ${width} pixels wide`}
              style={{ width, height: 900 }}
              className="border border-hairline bg-background"
            />
          </div>
        ))}
      </div>
    </LabSection>
  );
}
