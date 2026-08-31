import type { ReactNode } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { signOut } from "@/lib/auth";
import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { InquiryStatus, ReviewStatus } from "@/generated/prisma/enums";
import { Logo } from "@/components/layout/logo";
import { StudioNav } from "@/components/studio/sidebar";
import { CommandPalette } from "@/components/studio/command-palette";
import { SidebarCollapseToggle } from "@/components/studio/sidebar-collapse";
import { StudioMobileNav } from "@/components/studio/mobile-nav";
import { StudioTopbar } from "@/components/studio/topbar";

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
 * The two notification counts are the only queries this layout adds: they are
 * the two queues in this Studio that wait on a human, and the bar renders a
 * count rather than a decorative dot.
 */
export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireStaffPage();

  const [newCommissions, pendingApprovals] = await Promise.all([
    db.inquiry.count({ where: { status: InquiryStatus.NEW } }),
    db.scrapedProduct.count({ where: { reviewStatus: ReviewStatus.PENDING } }),
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
      {/* Skip link — first focusable element, bypasses the sidebar nav. */}
      <a
        href="#studio-content"
        className="sr-only rounded-full focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:bg-card focus:px-5 focus:py-3 focus:text-small focus:font-medium focus:text-foreground focus:shadow-e2 focus:outline-none focus:ring-2 focus:ring-focus"
      >
        Skip to content
      </a>

      {/* Desktop sidebar — 256px, inside §12.2's 240–260px band. */}
      <aside
        data-theme="navy"
        className="fixed inset-y-0 start-0 z-40 hidden w-64 flex-col overflow-y-auto border-e border-hairline-dk bg-obsidian px-3 py-6 lg:flex [--background:var(--obsidian)] [--ring:var(--focus)] [[data-sidebar-collapsed]_&]:w-20 [[data-sidebar-collapsed]_&]:px-2"
      >
        <div className="px-3 [[data-sidebar-collapsed]_&]:hidden">
          <Logo href="/studio" className="h-7 text-mineral" />
          <p className="u-micro mt-2 text-mist/70">STUDIO</p>
        </div>
        <div className="mt-9 flex-1">
          <StudioNav role={session.user.role} />
        </div>
        <SidebarCollapseToggle />
        <div className="mt-3 border-t border-hairline-dk px-3 pt-4 [[data-sidebar-collapsed]_&]:hidden">
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
        className="min-w-0 flex-1 px-5 pb-24 pt-16 sm:px-8 lg:ms-64 lg:pt-0 [[data-sidebar-collapsed]_&]:lg:ms-20"
      >
        <StudioTopbar
          email={session?.user?.email ?? ""}
          role={session.user.role}
          newCommissions={newCommissions}
          pendingApprovals={pendingApprovals}
          signOut={signOutAction}
        />
        {children}
      </main>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}
