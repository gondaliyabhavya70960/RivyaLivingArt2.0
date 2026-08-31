import { Skeleton } from "@/components/storefront/skeletons";

/**
 * /whatsapp-order pending UI (H11). Mirrors the v2.0 fallback page at first
 * paint on the canvas ground — masthead lines (eyebrow, Fraunces heading,
 * #RR reference, body), the saved-message card, the action row (WhatsApp +
 * copy + call), then the what-happens-next lines. No text, no spinner: the
 * wrapper announces busy state (`role="status"
      aria-busy`) language-free;
 * every block is a decorative token-only skeleton (reduced-motion collapse
 * freezes the pulse inside Skeleton itself).
 */
export default function WhatsAppOrderLoading() {
  return (
    <section
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-3xl px-5 py-16 md:px-6 md:py-24"
    >
      {/* Masthead — eyebrow, heading, reference, body lines */}
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 h-9 w-full max-w-md md:h-11" />
      <Skeleton className="mt-4 h-6 w-24" />
      <Skeleton className="mt-4 h-4 w-full max-w-prose" />
      <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />

      {/* The saved-message card block */}
      <Skeleton className="mt-8 h-64 w-full rounded-card" />

      {/* Action row — WhatsApp, copy and call silhouettes */}
      <div className="mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
        <Skeleton className="h-12 w-48 rounded-card" />
        <Skeleton className="h-12 w-40 rounded-card" />
        <Skeleton className="h-12 w-44 rounded-card" />
      </div>

      {/* What-happens-next + keep-browsing lines */}
      <div className="mt-10 border-t border-hairline pt-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-3 h-4 w-64" />
      </div>
    </section>
  );
}
