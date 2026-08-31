import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these `Link`/`redirect`/`useRouter`/
 * `usePathname` in place of the next/navigation equivalents throughout the
 * public site so locale prefixes are added/stripped automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
