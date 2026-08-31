/**
 * Studio loading skeleton (ENG-803). Data-heavy admin screens (inquiries,
 * products) get feedback while their server queries run instead of a blank
 * frame. Reuses the light card tokens so it reads as the admin, not the site.
 */
export default function StudioLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-foreground/8" />
      <div className="h-4 w-80 max-w-full rounded bg-foreground/5" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl border border-border bg-card shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
