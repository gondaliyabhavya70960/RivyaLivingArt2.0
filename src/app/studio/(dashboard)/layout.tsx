import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { signOut } from "@/lib/auth";
import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { InquiryStatus } from "@/generated/prisma/enums";
import { getStudioInbox } from "@/lib/studio-inbox";
import { Logo } from "@/components/layout/logo";
import { StudioNav } from "@/components/studio/sidebar";
import { CommandPalette } from "@/components/studio/command-palette";
import { SidebarCollapseToggle } from "@/components/studio/sidebar-collapse";
import { StudioMobileNav } from "@/components/studio/mobile-nav";
import { StudioTopbar } from "@/components/studio/topbar";
import { UnsavedChangesDialog } from "@/components/studio/unsaved-changes-dialog";

/**
 * Studio shell — REDESIGN.md §12.2: "a creative atelier management system,
 * not a generic admin template."
 *
 *   Sidebar 240–260px, dark, minimal, small Lucide icons + text, the active
 *   item marked by a champagne line. Top bar: page title left; search,
 *   notifications, WhatsApp shortcut and profile right. Main content, with an
 *   optional right-hand activity panel.
 *
 * The sidebar and the mobile bar carry `data-theme="navy"` so `--focus`
 * resolves champagne (Part 16) and inks resolve mineral/mist; two scoped
 * custom-property overrides re-point the shadcn hooks the primitives still
 * read — `--ring` (base `:focus-visible` outline) onto `--focus`, and
 * `--background` (ring-offset) onto the obsidian ground.
 *
 * New-commission count and the studio inbox are the only queries this layout
 * adds: `newCommissions` seeds the mobile bar's dot and the topbar's own
 * "new commission" item (`getStudioInbox()` deliberately covers everything
 * BUT inquiries — that queue already headlines the dashboard), and the inbox
 * itself is the rest of what waits on a human across the Studio.
 */
export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireStaffPage();

  const [newCommissions, inbox] = await Promise.all([
    db.inquiry.count({ where: { status: InquiryStatus.NEW } }),
    getStudioInbox(),
  ]);

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/studio/login" });
  };

  return (
    <div className="flex min-h-svh bg-background">
      {/* Collapse restore before first paint — reads the per-device flag and
          stamps <html data-sidebar-collapsed> so the CSS variants below
          render the collapsed shell without a flash. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            'try{if(localStorage.getItem("rr-studio-sidebar")==="1")document.documentElement.setAttribute("data-sidebar-collapsed","")}catch(e){}',
        }}
      />
      <CommandPalette role={session.user.role} />
      {/* The unsaved-changes confirmation. Mounted here, once, because it has
          to outlive the form it asks about — the whole point is that the form
          is being navigated away from. It talks to the guard hook through the
          module store, the same shape the drawer and the palette use. */}
      <UnsavedChangesDialog />
      {/* Skip link — first focusable element, bypasses the sidebar nav. */}
      <a
        href="#studio-content"
        className="sr-only rounded-full focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-(--z-studio-skip) focus:bg-card focus:px-5 focus:py-3 focus:text-small focus:font-medium focus:text-foreground focus:shadow-e2 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Skip to content
      </a>

      {/* Sidebar — an 80px icon RAIL from 640px, the full 256px panel (inside
          §12.2's 240–260px band) from 1024px.

          It used to be `lg:flex` alone, which meant a tablet — the device an
          owner actually reviews commissions on from the sofa — got the PHONE
          chrome: no persistent nav at all, every navigation a drawer open. The
          rail is the same nav with its labels dropped, so between 640 and
          1024 the sections stay one tap away.

          Below `lg` the rail is not collapsible: there is no room for the
          panel, so `data-sidebar-collapsed` (the owner's per-device choice) is
          scoped to `lg` and up rather than applying at every width. */}
      <aside
        data-theme="navy"
        className="fixed inset-y-0 start-0 z-40 hidden w-20 flex-col overflow-y-auto border-e border-hairline-dk bg-obsidian px-2 py-6 sm:flex lg:w-64 lg:px-3 [--background:var(--obsidian)] [--ring:var(--focus)] [[data-sidebar-collapsed]_&]:lg:w-20 [[data-sidebar-collapsed]_&]:lg:px-2"
      >
        <div className="px-3 max-lg:hidden [[data-sidebar-collapsed]_&]:hidden">
          <Logo href="/studio" className="h-7 text-mineral" />
          <p className="u-micro mt-2 text-mist/70">STUDIO</p>
        </div>
        <div className="mt-9 flex-1">
          <StudioNav role={session.user.role} />
        </div>
        <div className="max-lg:hidden">
          <SidebarCollapseToggle />
        </div>
        <div className="mt-3 border-t border-hairline-dk px-3 pt-4 max-lg:hidden [[data-sidebar-collapsed]_&]:hidden">
          <p className="truncate text-small text-mineral">
            {session?.user?.email}
          </p>
          <p className="u-micro mt-1 text-mist/70">{session?.user?.role}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-input text-small text-mist underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-mineral hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-input text-small text-mist underline-offset-4 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-mineral hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none"
            >
              View site ↗
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile top bar + slide-in nav (§12.6). */}
      <StudioMobileNav
        email={session?.user?.email ?? ""}
        role={session.user.role}
        newCommissions={newCommissions}
        signOut={signOutAction}
      />

      <main
        id="studio-content"
        className="min-w-0 flex-1 px-5 pb-24 pt-16 sm:ms-20 sm:px-8 sm:pt-0 lg:ms-64 [[data-sidebar-collapsed]_&]:lg:ms-20"
      >
        <StudioTopbar
          email={session?.user?.email ?? ""}
          role={session.user.role}
          newCommissions={newCommissions}
          inbox={inbox}
          signOut={signOutAction}
        />
        {children}
      </main>
      {/* Sonner's `richColors` paints its OWN palette — the success toast is
          a hardcoded `hsl(143, 85%, 96%)`, nowhere near this repo's
          `--success` — so every confirmation in the Studio arrived
          in a green the design system does not contain. The flag stays on,
          because it is what gives success/error/warning distinct treatments
          at all; its variables are repointed at the tokens instead. They
          They are the `.studio-v2` scope's own names — `--surface`, `--text`,
          `--border`, not the shadcn `--card`/`--foreground` aliases. Sonner
          portals its list to `document.body`, and `.studio-v2` sits on
          `<html>`, so the scope does reach it; but an undefined custom
          property makes the whole `color-mix()` invalid at computed-value
          time and the declaration is dropped SILENTLY — the first version of
          this used `var(--card)`, which does not exist here, and every toast
          came out with a transparent background while the text colours looked
          right. Measured, not assumed (see the PR).

          D30 (tokens.css) deleted the `prefers-color-scheme: dark` block this
          last sentence used to point at ("the dark block re-points the same
          names, so it follows for free"). Nothing here needs updating for
          that: the names are still `--surface`, `--text` and `--border`, and
          their values now come straight from `:root` instead of from a media
          query. The Studio is dark unconditionally, so the toasts are too. */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        style={
          {
            "--normal-bg": "var(--surface)",
            "--normal-text": "var(--text)",
            "--normal-border": "var(--border)",
            "--success-bg":
              "color-mix(in oklab, var(--success) 8%, var(--surface))",
            "--success-text": "var(--success)",
            "--success-border":
              "color-mix(in oklab, var(--success) 40%, transparent)",
            "--error-bg":
              "color-mix(in oklab, var(--alert) 8%, var(--surface))",
            "--error-text": "var(--alert)",
            "--error-border":
              "color-mix(in oklab, var(--alert) 40%, transparent)",
            "--warning-bg":
              "color-mix(in oklab, var(--warning) 8%, var(--surface))",
            "--warning-text": "var(--warning)",
            "--warning-border":
              "color-mix(in oklab, var(--warning) 40%, transparent)",
            "--info-bg": "color-mix(in oklab, var(--info) 8%, var(--surface))",
            "--info-text": "var(--info)",
            "--info-border":
              "color-mix(in oklab, var(--info) 40%, transparent)",
          } as CSSProperties
        }
      />
    </div>
  );
}
