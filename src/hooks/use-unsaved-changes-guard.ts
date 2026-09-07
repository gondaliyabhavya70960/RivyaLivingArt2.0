"use client";

import { useEffect } from "react";

import { unsavedChanges } from "@/lib/unsaved-changes-signal";

/**
 * Guards a form's unsaved edits.
 *
 * It used to warn on `beforeunload` ONLY, and said so in its own header: "no
 * in-app navigation interception". That is the half that almost never fires.
 * An owner editing a product does not close the tab — they click Products in
 * the sidebar, or a breadcrumb, or the logo. Every one of those is an in-app
 * navigation, and every one of them **silently discarded the edit**, with no
 * warning of any kind. Seven forms carried this.
 *
 * So the guard now also intercepts in-app navigation, in the one place it can
 * be caught without wrapping every link: a capture-phase listener on the
 * document. Next's App Router has no `router.events` to subscribe to, and
 * `next/link` navigates on click, so catching the click before it reaches the
 * link is what there is.
 *
 * What it deliberately does NOT intercept, because these are the visitor
 * asking for a different thing entirely:
 *
 * - modified clicks (⌘/ctrl/shift/alt, middle button) — those open a new tab
 *   and leave the form exactly where it is;
 * - `target="_blank"`, `download`, and non-http protocols (`mailto:`, `tel:`);
 * - a different origin — the beforeunload handler covers leaving the site;
 * - same-page fragments (`#anchor`), which do not unmount anything;
 * - anything inside `[data-unsaved-allow]`, the opt-out for a form's own
 *   Cancel link, which means to discard.
 *
 * **Browser Back is NOT covered**, and a `popstate` handler that claimed to
 * cover it was removed on 2026-09-07 after being measured dead: Next's app
 * router registers its own `popstate` listener at mount, so it runs first
 * and has unmounted the form — whose cleanup clears the dirty count — before
 * this hook's listener fires. Covering Back needs a same-URL sentinel entry
 * pushed when the form goes dirty, so the pop lands on an identical entry
 * and nothing unmounts; that is recorded as open on the roadmap rather than
 * shipped half-working. The command palette, which navigates with
 * `router.push`, asks the same question itself before it goes.
 *
 * The confirmation itself is `<UnsavedChangesDialog/>`, mounted once in the
 * dashboard layout — an ancestor of every form, so it cannot be rendered from
 * here. The two halves talk through `unsaved-changes-signal.ts`, the same
 * module-store pattern the drawer and the palette use.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    unsavedChanges.setDirty(true);
    return () => unsavedChanges.setDirty(false);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      // A modified or non-primary click is "open this elsewhere", not "leave".
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.closest("[data-unsaved-allow]")) return;

      // `anchor.href` is already absolute, so this also filters mailto:/tel:.
      let url: URL;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // A fragment on the page we are already on unmounts nothing.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash
      ) {
        return;
      }
      if (!unsavedChanges.isDirty()) return;

      event.preventDefault();
      unsavedChanges.ask(url.pathname + url.search + url.hash);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isDirty]);
}
