import type { ProductListFilter } from "@/components/studio/products/product-filter";
import { productListHref } from "@/components/studio/products/product-filter-links";

/**
 * The Overview's "on your desk" band — plan §3 S2, "become the morning
 * ACTION QUEUE".
 *
 * The KPI cards below it answer *how is the business doing*; this answers
 * *what is waiting on me*, which is a different question and the one an owner
 * opens the Studio to ask. The numbers are not new — most of them already
 * existed on `/studio/content-gaps`, a screen nobody visits before there is a
 * reason to.
 *
 * Two rules:
 *
 * 1. **A zero card is not built.** Part 9's "a panel with nothing in it is
 *    never constructed" — a queue that always shows six rows teaches an owner
 *    to stop reading it. An empty queue is one calm line instead.
 * 2. **Every card's link lands on exactly the rows it counted**, through the
 *    filter builders rather than a template string. A card that says 27 and
 *    opens a list of 4,399 is worse than no card: it spends the owner's trust
 *    and their time at once.
 *
 * Pure, so the six thresholds and the six links can be pinned by test — the
 * branch is what matters here, and a branch living in JSX is untestable in a
 * repo with no component-test runner.
 */
export type ActionQueueCounts = {
  /** NEW inquiries whose first reply is already late. */
  staleInquiries: number;
  /** Published products with no image at all. */
  publishedNoImage: number;
  /** Published products still carrying a concept placeholder. */
  publishedPlaceholder: number;
  /** Published products the scraper flagged and nobody has rewritten. */
  publishedNeedsRewrite: number;
  /** Drafts nobody has touched in 30 days. */
  staleDrafts: number;
};

export type ActionQueueCard = {
  key: keyof ActionQueueCounts;
  count: number;
  /** The thing that is waiting, in the owner's words. */
  title: string;
  /** Why it matters — one clause, never a second sentence. */
  why: string;
  href: string;
};

/** Hours a NEW inquiry may sit before the queue calls it late. */
export const STALE_INQUIRY_HOURS = 24;

/**
 * The late-first-reply population, as a Prisma clause — shared by the
 * Overview card that counts it and the `/studio/inquiries?stale=1` list it
 * opens, so the two can never mean different rows.
 *
 * It is a STATUS clause as much as an age one: an inquiry that has been
 * answered is not late however old it is.
 *
 * `now` is a parameter, and the callers hold it: reading the clock inside a
 * component is a `react-hooks/purity` error here, and two reads inside one
 * request would give the count and the list different windows.
 */
export function staleInquiryWhere(now: Date) {
  return {
    status: "NEW" as const,
    createdAt: {
      lt: new Date(now.getTime() - STALE_INQUIRY_HOURS * 60 * 60 * 1000),
    },
  };
}

const productHref = (filter: ProductListFilter) => productListHref(filter);

export function buildActionQueue(counts: ActionQueueCounts): ActionQueueCard[] {
  const all: ActionQueueCard[] = [
    {
      key: "staleInquiries",
      count: counts.staleInquiries,
      title: `Unanswered for over ${STALE_INQUIRY_HOURS} hours`,
      why: "Every order here finishes in a conversation — this is the queue of conversations nobody has started.",
      href: "/studio/inquiries?stale=1",
    },
    {
      key: "publishedNoImage",
      count: counts.publishedNoImage,
      title: "Live with no photograph",
      why: "The card falls back to a monogram tile on every rail it appears in.",
      href: productHref({ status: "PUBLISHED", media: "none" }),
    },
    {
      key: "publishedPlaceholder",
      count: counts.publishedPlaceholder,
      title: "Live on a concept placeholder",
      why: "A placeholder cover is the picture WhatsApp shows a customer while they agree to buy something else.",
      href: productHref({ status: "PUBLISHED", media: "placeholder" }),
    },
    {
      key: "publishedNeedsRewrite",
      count: counts.publishedNeedsRewrite,
      title: "Live, still awaiting a rewrite",
      why: "The PDP hides the scraped copy until someone writes it, so the page is a tagline and a spec sheet.",
      href: productHref({ status: "PUBLISHED", rewrite: "flagged" }),
    },
    {
      key: "staleDrafts",
      count: counts.staleDrafts,
      title: "Drafts untouched for a month",
      why: "Either they are nearly ready or they are abandoned, and only you know which.",
      href: productHref({ status: "DRAFT", stale: "30d" }),
    },
  ];
  return all.filter((card) => card.count > 0);
}
