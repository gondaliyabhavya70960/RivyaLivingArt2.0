"use client";

import { useEffect, useState } from "react";

import { getDemoContentStatus } from "@/actions/demo";
import { FormSection } from "@/components/studio/form-section";
import { PublicToggle } from "@/components/studio/content-lab/public-toggle";

/**
 * The Settings screen's twin of the Content Lab public-visibility switch
 * (`/studio/content-lab`) — the same `SiteSettings.demoContentPublic`
 * column and the same `<PublicToggle>`, so either screen always agrees on
 * the current value. Self-fetching (rather than taking the value as a prop)
 * so this section can be appended to `SettingsForm` without changing what
 * the settings page passes it.
 */
export function DemoContentSection() {
  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState(false);
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDemoContentStatus().then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setInitial(result.data.demoContentPublic);
        setHost(result.data.host);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <FormSection
      title="Demo content"
      description="The Content Lab fixtures — sample products, journal posts, case studies and testimonials seeded for previewing the design. Manage the full set from Content Lab in the sidebar."
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <PublicToggle id="settings-demo-content-public" initial={initial} />
          <p className="text-sm text-muted-foreground">
            Off the production database this content is always visible, so this
            switch only matters in production
            {host ? ` (currently: ${host})` : ""}.
          </p>
        </>
      )}
    </FormSection>
  );
}
