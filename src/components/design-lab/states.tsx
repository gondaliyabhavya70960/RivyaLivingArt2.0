import { Button } from "@/components/storefront/button";
import { TextField } from "@/components/storefront/form-field";

import { LabSection } from "./lab-section";

/**
 * The six-state contract (REDESIGN.md Part 9) demonstrated across more than
 * one primitive, plus the two states the Components tab does not cover:
 * focus and success. Default/disabled/loading are static specimens;
 * hover/focus/active are the REAL controls below — mouse over, tab to and
 * press one to see them, rather than a screenshot of a pseudo-class.
 */
export function StatesTab() {
  return (
    <div className="space-y-16">
      <LabSection index={1} title="Default · disabled · loading">
        <p className="mb-4 text-14 text-graphite">
          Disabled is 40% opacity PLUS a stated reason, never a silently dead
          control. Loading replaces the label with a spinner at a locked width.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button>Default</Button>
          <Button disabled reason="Select a size first">
            Disabled
          </Button>
          <Button loading loadingLabel="Saving">
            Loading
          </Button>
        </div>
      </LabSection>

      <LabSection index={2} title="Hover · focus · active — try these">
        <p className="mb-4 text-14 text-graphite">
          Real, interactive. Colour and underline transition on hover only — no
          scale, no lift. Tab to the second button to see the 2px sapphire focus
          ring at 3px offset.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button>Hover me</Button>
          <Button variant="secondary">Tab to me, then press Enter</Button>
          <Button variant="ghost">Click and hold</Button>
        </div>
      </LabSection>

      <LabSection index={3} title="Form field — default · error · disabled">
        <div className="grid max-w-xl gap-5">
          <TextField
            label="Default"
            name="lab-state-default"
            placeholder="Type here"
          />
          <TextField
            label="Error"
            name="lab-state-error"
            defaultValue="not-an-email"
            error="That doesn't look right."
          />
          <TextField
            label="Disabled"
            name="lab-state-disabled"
            defaultValue="Locked"
            disabled
          />
        </div>
      </LabSection>

      <LabSection index={4} title="Success — explicit confirmation">
        <div
          role="status"
          className="max-w-md rounded-image border border-success/40 bg-success/8 p-4 text-14 text-success"
        >
          Your inquiry was sent — we&apos;ll reply on WhatsApp shortly.
        </div>
      </LabSection>
    </div>
  );
}
