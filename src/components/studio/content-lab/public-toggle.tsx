"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setDemoContentPublic } from "@/actions/demo";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * The one control that turns `SiteSettings.demoContentPublic` on or off,
 * shared by `/studio/content-lab` (server-fetched `initial`, no flicker) and
 * the Settings screen's "Demo content" section (which fetches its own
 * initial value, since it has no server-rendered parent to hand one in).
 *
 * Renders only the checkbox, its label and the warning line — the caller
 * supplies any surrounding card/section chrome.
 */
export function PublicToggle({
  id = "demo-content-public",
  initial,
  disabled,
}: {
  id?: string;
  initial: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(checked: boolean) {
    const previous = value;
    setValue(checked);
    startTransition(async () => {
      const result = await setDemoContentPublic(checked);
      if (!result.ok) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success(
        checked
          ? "Demo content is now visible on the live site."
          : "Demo content is hidden from the live site again.",
      );
    });
  }

  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={value}
        disabled={disabled || pending}
        onCheckedChange={(checked) => toggle(checked === true)}
      />
      <div className="space-y-1">
        <Label htmlFor={id}>Show demo content on the live site</Label>
        <p className="text-sm text-muted-foreground">
          Demo pieces will show on the live site marked DEMO CONTENT; they are
          never in the sitemap or search-engine data.
        </p>
      </div>
    </div>
  );
}
