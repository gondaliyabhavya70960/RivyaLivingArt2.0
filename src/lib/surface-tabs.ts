/**
 * The three tabs of the per-page composer, as plain data.
 *
 * Lives here — not in `surface-tabs.tsx` — because that file is a client
 * module, and a function exported from a client module becomes a client
 * REFERENCE on the server: calling it from the page throws "Attempted to call
 * isSurfaceTab() from the server". The first version did exactly that, and
 * the whole screen fell to the error boundary — which still passed the Studio
 * audit, because an error page is a perfectly accessible page. The vocabulary
 * is shared; the component is not.
 */
export const SURFACE_TABS = ["words", "pictures", "order"] as const;
export type SurfaceTab = (typeof SURFACE_TABS)[number];

export function isSurfaceTab(
  value: string | null | undefined,
): value is SurfaceTab {
  return (SURFACE_TABS as readonly string[]).includes(value ?? "");
}
