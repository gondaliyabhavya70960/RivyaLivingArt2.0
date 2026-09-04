import { COPY_SLOTS, EDITABLE_COPY_SLOTS } from "@/lib/site-copy";
import { SITE_IMAGE_SLOTS } from "@/lib/site-images";

import { LabSection } from "./lab-section";

/**
 * Live counts read straight from the two CMS registries (`src/lib/
 * site-copy.ts`, `src/lib/site-images.ts`) — the number on screen is
 * whatever is actually registered right now, never a figure someone typed
 * into a comment and forgot to update.
 */
export function ContentTab() {
  const groups = new Map<string, number>();
  for (const slot of SITE_IMAGE_SLOTS) {
    groups.set(slot.group, (groups.get(slot.group) ?? 0) + 1);
  }

  return (
    <div className="space-y-16">
      <LabSection index={1} title="Site copy slots">
        <div className="grid max-w-sm gap-4 sm:grid-cols-2">
          <div className="rounded-image border border-hairline p-6">
            <p className="u-micro">Total slots</p>
            <p className="mt-1 font-mono text-39 text-ink">
              {COPY_SLOTS.length}
            </p>
          </div>
          <div className="rounded-image border border-hairline p-6">
            <p className="u-micro">Editable in /studio/site-copy</p>
            <p className="mt-1 font-mono text-39 text-ink">
              {EDITABLE_COPY_SLOTS.length}
            </p>
          </div>
        </div>
      </LabSection>

      <LabSection index={2} title="Site image slots">
        <div className="rounded-image border border-hairline p-6 sm:w-fit">
          <p className="u-micro">Total slots</p>
          <p className="mt-1 font-mono text-39 text-ink">
            {SITE_IMAGE_SLOTS.length}
          </p>
        </div>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...groups.entries()].map(([group, count]) => (
            <li
              key={group}
              className="flex items-center justify-between rounded-image border border-hairline px-4 py-3"
            >
              <span className="text-14 text-ink">{group}</span>
              <span className="u-num text-14 text-graphite">{count}</span>
            </li>
          ))}
        </ul>
      </LabSection>
    </div>
  );
}
