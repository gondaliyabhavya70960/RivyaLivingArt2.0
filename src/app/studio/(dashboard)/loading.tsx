/**
 * Studio loading skeleton (ENG-803). Data-heavy admin screens (inquiries,
 * products) get feedback while their server queries run instead of a blank
 * frame. Reuses the light card tokens so it reads as the admin, not the site.
 *
 * FLAT, no shimmer (roadmap Phase 10). The pulse it used to carry is motion
 * with no information in it — it says "still waiting", which the shape
 * already says — and Part 14 rejects motion that is decoration. A still
 * placeholder at the right size does the whole job.
 */
export default function StudioLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-foreground/8" />
      <div className="h-4 w-80 max-w-full rounded bg-foreground/5" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-card border border-border bg-card shadow-e1"
          />
        ))}
      </div>
    </div>
  );
}
