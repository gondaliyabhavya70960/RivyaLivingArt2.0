import Link from "next/link";

import { AuthShell } from "@/components/studio/auth-shell";

/**
 * The Studio's 403 — §2.10, and the twin of `[locale]/forbidden.tsx`.
 *
 * `requireStaffPage` calls `forbidden()` when a valid staff session opens a
 * page its role does not cover (an EDITOR on an ADMIN-only screen). Next
 * renders this boundary IN PLACE, at the URL that was asked for, with a real
 * 403 and its own injected `noindex`.
 *
 * ## Why it wears the auth shell rather than the storefront's system page
 *
 * A person seeing this is signed in and inside the admin. The storefront's
 * obsidian system page — with its WhatsApp · Home · Shop footer strip — would
 * hand a staffer three ways to leave the product they are trying to work in.
 * `AuthShell` is the Studio's own frame for "something about your account is
 * the subject", which is exactly what this is, and it keeps the Studio's
 * chrome, type and density.
 *
 * ## The two exits, and why neither of them is a sign-in link
 *
 * A 403 here means the session is fine and the ROLE is not, so "sign in again"
 * would be advice that cannot work: signing in again produces the same role.
 * The honest exits are back to the dashboard (a page they certainly may see)
 * and to whoever can change it. `Role` has exactly two values — ADMIN and
 * EDITOR — so "ask an administrator" names a real person, not a support queue.
 *
 * ## Nothing from behind the guard appears here
 *
 * `forbidden()` is an interrupt: it unwinds the render at the point the guard
 * threw, so the page's data was never fetched, never composed and never sent.
 * This boundary is built entirely from static copy for that reason — a
 * "you cannot see X" message that names X has already leaked X.
 */
export default function StudioForbidden() {
  return (
    <AuthShell
      title="This bench is closed."
      subtitle="Your account does not cover this part of Studio. Nothing is wrong with your sign-in."
      footer={
        <span>
          Roles are changed by an administrator in Studio → Users.
        </span>
      }
    >
      <div className="space-y-5">
        <p className="rounded-input border-s-2 border-warning/60 bg-warning/8 px-4 py-3 text-small leading-relaxed text-warning">
          403 · staff only
        </p>
        <Link
          href="/studio"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-primary px-7 text-sm font-medium text-primary-foreground shadow-e1 outline-none transition-colors duration-(--dur-fast) hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          Back to the dashboard
        </Link>
      </div>
    </AuthShell>
  );
}
