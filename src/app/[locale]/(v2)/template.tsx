import type { ReactNode } from "react";

import { PageTransition } from "@/components/motion/page-transition";

/**
 * Gentle page-enter transition. template.tsx re-mounts on every navigation,
 * so the animation replays per route. The effect itself lives in
 * PageTransition (components/motion, DESIGN.md B4) so 2.0 work and this
 * template share one implementation.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
