"use client";

import { type ComponentProps, type MouseEvent } from "react";
import { useTransitionRouter } from "next-view-transitions";

import { Link } from "@/i18n/navigation";

/**
 * A next-intl Link whose same-tab left-clicks drive the navigation through
 * next-view-transitions' router, wrapping it in document.startViewTransition
 * so paired view-transition-name elements morph (guide Phase 2: shop card →
 * PDP gallery). Everything else — locale prefixing, prefetch, semantics,
 * middle/modified clicks, new-tab — is the plain Link untouched. Falls back
 * to a normal client navigation when the browser lacks startViewTransition
 * or the visitor prefers reduced motion (Next 16.3 has no viewTransition
 * flag and React 19 stable ships no <ViewTransition>, so this thin driver
 * is the supported path; see audit/FINDINGS.md Phase 2 notes).
 */
export function MorphLink({ onClick, ...props }: ComponentProps<typeof Link>) {
  const router = useTransitionRouter();

  return (
    <Link
      {...props}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.currentTarget.target === "_blank" ||
          typeof document.startViewTransition !== "function" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          return;
        }
        event.preventDefault();
        // The rendered href is already locale-prefixed by the intl Link.
        const href = event.currentTarget.getAttribute("href");
        if (href) router.push(href);
      }}
    />
  );
}
