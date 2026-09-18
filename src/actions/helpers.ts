import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";

import { defaultLocale, locales } from "@/i18n/config";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Guard for studio server actions. Throws for unauthenticated calls
 * (middleware should have blocked them already — this is defense in depth).
 *
 * Beyond the token check it re-validates the principal against the database
 * on every call (SEC-106): a deleted user (row gone), a demoted user (fresh
 * role no longer in `roles`), or a session invalidated by a password reset
 * (tokenVersion bumped) is rejected immediately, instead of retaining access
 * until the JWT expires. One indexed primary-key lookup per call.
 */
export async function requireStaff(roles: Role[] = ["ADMIN", "EDITOR"]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const fresh = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, tokenVersion: true },
  });
  if (
    !fresh ||
    fresh.tokenVersion !== session.user.tokenVersion ||
    !roles.includes(fresh.role)
  ) {
    throw new Error("Unauthorized");
  }

  // Reflect the authoritative role back onto the session for callers.
  session.user.role = fresh.role;
  return session;
}

/**
 * Page-level twin of requireStaff for studio server components: answers the
 * request instead of throwing when the principal is no longer valid, so a
 * revoked session can't keep *viewing* the admin either (SEC-106).
 *
 * ## Its two failures are different questions, and they now get different
 * ## answers (owner decision 8, §2.10)
 *
 * This function used to redirect BOTH of them, and the second redirect was the
 * problem:
 *
 *   no session / stale token   → /studio/login        (unchanged, and right)
 *   valid session, wrong role  → /studio              (WAS this; now 403)
 *
 * An EDITOR who opened an ADMIN-only page was bounced to the dashboard with no
 * explanation, landed somewhere they had not asked for, and lost the URL they
 * tried — so they could not tell "you may not see this" from "that link was
 * broken", and could not show anyone what they had attempted.
 *
 * `forbidden()` renders the 403 boundary IN PLACE, at the URL they asked for,
 * with a real 403 status and Next's own `noindex`. It is an interrupt, so it
 * unwinds the render: nothing behind the guard has been composed, let alone
 * sent. `studio/forbidden.tsx` is the UI.
 *
 * The session branch stays a redirect on purpose. Those two are not
 * symmetrical: a forbidden user is signed in and the way out is OUT, while an
 * expired session's way out is BACK IN, and a login screen is where that
 * happens. Rendering a 401 page with a "sign in" link would put one extra
 * click in front of the thing they already have to do.
 */
export async function requireStaffPage(roles: Role[] = ["ADMIN", "EDITOR"]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/studio/login");

  const fresh = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, tokenVersion: true },
  });
  if (!fresh || fresh.tokenVersion !== session.user.tokenVersion) {
    // The session was valid and is not any more — a password reset bumped
    // tokenVersion, or the row is gone. `?reason=expired` is what lets the
    // login screen say so instead of showing a bare form to someone who was
    // signed in a second ago.
    redirect("/studio/login?reason=expired");
  }
  if (!roles.includes(fresh.role)) {
    forbidden();
  }
  session.user.role = fresh.role;
  return session;
}

/**
 * Public-route revalidation after a content mutation (ENG-801). Studio actions
 * revalidate their own /studio/* paths; this maps a mutated entity to the
 * public routes that render it so owner edits appear on the live site without
 * waiting out the 5-minute ISR window. A new content type is one map entry
 * rather than edits scattered across the action files.
 *
 * `slug` narrows the refresh to one detail route where the entity has one
 * (product, blogPost, portfolio, page, customPage). For "testimonial" it is
 * the slug of the linked PRODUCT — a testimonial has no page of its own, but
 * the PDP it is attached to does.
 */
export type RevalidatableEntity =
  | "product"
  | "category"
  | "blogPost"
  | "portfolio"
  | "faq"
  | "testimonial"
  | "page"
  | "customPage";

/**
 * Every URL one public path is served at.
 *
 * `localePrefix: "as-needed"` (src/i18n/routing.ts) keeps English on the
 * unprefixed URL and gives every other locale its own — and every one of those
 * is a SEPARATE cache entry. Revalidating only `/shop` therefore refreshed
 * English and left the other eight languages serving stale content for the
 * rest of the ISR window: up to 300s on most routes, 86400s on a PDP. An owner
 * editing a Hindi product saw nothing change and edited it again.
 */
function localizedPaths(path: string): string[] {
  return locales.map((locale) =>
    locale === defaultLocale ? path : `/${locale}${path}`,
  );
}

/** Same expansion for a dynamic route pattern revalidated as a "page". */
function revalidateLocalizedPattern(pattern: string) {
  for (const path of localizedPaths(pattern)) revalidatePath(path, "page");
}

export function revalidatePublic(entity: RevalidatableEntity, slug?: string) {
  // Not localized — one file at the root, listing every locale's URLs.
  revalidatePath("/sitemap.xml");

  // Landing pages read OTHER entities: the block catalogue grew readers for
  // products, collections, journal posts, cases, testimonials and FAQs, so a
  // lander is stale the moment any of those changes and nothing here said so.
  // Its own `customPage` arm only ever covered edits to the page itself.
  if (entity !== "page") revalidateLocalizedPattern("/p/[slug]");

  const paths: string[] = [];
  switch (entity) {
    case "product":
      paths.push("/", "/shop");
      revalidateLocalizedPattern("/shop/[category]");
      if (slug) paths.push(`/product/${slug}`);
      else revalidateLocalizedPattern("/product/[slug]");
      break;
    case "category":
      paths.push("/", "/shop");
      revalidateLocalizedPattern("/shop/[category]");
      break;
    case "blogPost":
      paths.push("/blog");
      if (slug) paths.push(`/blog/${slug}`);
      else revalidateLocalizedPattern("/blog/[slug]");
      break;
    case "portfolio":
      paths.push("/portfolio");
      if (slug) paths.push(`/portfolio/${slug}`);
      else revalidateLocalizedPattern("/portfolio/[slug]");
      break;
    case "faq":
      // /faq is not the only place an FAQ is answered: the PDP renders the
      // top three (product/[slug]/page.tsx), and the commission and
      // large-format pages carry their own picks. Refreshing only /faq left a
      // withdrawn answer — a wrong price, a lead time the owner has changed —
      // live on all 4,385 product pages until ISR expired.
      paths.push("/faq", "/custom-order", "/large-resin-art");
      revalidateLocalizedPattern("/product/[slug]");
      break;
    case "testimonial":
      // Every page that renders a words band. `slug` is the PRODUCT slug the
      // testimonial is linked to (its own id is never a URL); without one,
      // every PDP is refreshed, since the resolver can filter per product.
      paths.push("/", "/custom-order", "/large-resin-art");
      if (slug) paths.push(`/product/${slug}`);
      else revalidateLocalizedPattern("/product/[slug]");
      break;
    case "page":
      if (slug) paths.push(`/${slug}`);
      break;
    case "customPage":
      if (slug) paths.push(`/p/${slug}`);
      else revalidateLocalizedPattern("/p/[slug]");
      break;
  }
  for (const path of paths) {
    for (const localized of localizedPaths(path)) revalidatePath(localized);
  }
}

/** Wraps an action body into a uniform ActionResult, hiding raw errors. */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    console.error("Action failed:", error);
    const message =
      error instanceof Error && error.message === "Unauthorized"
        ? "You are not allowed to do that."
        : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
