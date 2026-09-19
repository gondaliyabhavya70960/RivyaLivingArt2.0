import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The board and the detail sheet call Studio actions — the TEST replaces
// them, so no database or auth layer loads.
vi.mock("@/actions/scraper-review", () => ({
  updateStagedProduct: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/actions/scraper-shortlist", () => ({
  setShortlistState: vi.fn(async () => ({
    ok: true,
    data: { moved: 1, already: 0, blocked: [] },
  })),
  setShortlistNote: vi.fn(async () => ({ ok: true })),
  setShortlistTags: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  usePathname: () => "/studio/scraper/review",
  useSearchParams: () => new URLSearchParams(),
}));

import { ScraperKanban } from "@/components/studio/scraper/scraper-kanban";
import {
  SCRAPER_KANBAN_LANES,
  SHORTLIST_LANE_ICON,
  describeScraperMoveToast,
  scraperMoveOptions,
} from "@/components/studio/scraper/scraper-kanban-model";
import { SHORTLIST_STATE_LABELS, ShortlistState } from "@/lib/scraper/shortlist";
import type { InboxCounts, InboxRow } from "@/lib/scraper/shortlist-query";

const row = (id: string, state: ShortlistState): InboxRow => ({
  researchProductId: id,
  twinId: `twin-${id}`,
  twinImported: false,
  title: `Staged product ${id}`,
  slug: `staged-product-${id}`,
  url: "https://example.com/p/1",
  sourceKey: "example",
  sourceName: "Example Store",
  sourceTier: null,
  vertical: "resin",
  category: "Clocks",
  shortTagline: null,
  description: null,
  priceMin: 2499,
  priceMax: 3499,
  timeline: null,
  materials: null,
  dimensions: null,
  images: [],
  imageAlts: [],
  suggestedSizeTier: null,
  state,
  note: null,
  tags: [],
  reason: null,
  changedBy: null,
  changedAt: null,
  updated: false,
  firstSeen: new Date("2026-09-01"),
  lastSeen: new Date("2026-09-10"),
});

const COUNTS: InboxCounts = {
  NEW: 5,
  REVIEW: 2,
  SHORTLISTED: 1,
  CONFIRMED: 0,
  REJECTED: 0,
  INSPIRATION_ONLY: 0,
  DUPLICATE: 0,
};

function renderBoard(rows: InboxRow[]) {
  return renderToStaticMarkup(
    createElement(ScraperKanban, {
      rows,
      counts: COUNTS,
      truncated: false,
      totalMatching: rows.length,
    }),
  );
}

describe("scraperMoveOptions — the state machine IS the menu", () => {
  it("never offers Confirmed from New, Review or the parking lots", () => {
    for (const state of [
      "NEW",
      "REVIEW",
      "INSPIRATION_ONLY",
      "DUPLICATE",
      "REJECTED",
    ] as const) {
      const values = scraperMoveOptions(state).map((o) => o.value);
      expect(values).not.toContain("CONFIRMED");
      expect(values[0]).toBe(state); // current state first
    }
  });

  it("offers Confirmed first among the targets from Shortlisted — the gate", () => {
    const values = scraperMoveOptions("SHORTLISTED").map((o) => o.value);
    expect(values).toContain("CONFIRMED");
    expect(values.indexOf("CONFIRMED")).toBe(1);
  });

  it("lets a Confirmed card go only back to Shortlisted", () => {
    expect(scraperMoveOptions("CONFIRMED").map((o) => o.value)).toEqual([
      "CONFIRMED",
      "SHORTLISTED",
    ]);
  });
});

describe("ScraperKanban", () => {
  it("renders the funnel first, then the parking lots, with true counts", () => {
    const html = renderBoard([row("r1", "REVIEW"), row("r2", "SHORTLISTED")]);
    // Lane headers, not the same word inside a card's badge or an option:
    // each header's label lands immediately after its lane icon's </svg>.
    const order = SCRAPER_KANBAN_LANES.map((s) =>
      html.indexOf(`</svg>${SHORTLIST_STATE_LABELS[s]}`),
    );
    for (const index of order) expect(index).toBeGreaterThan(-1);
    for (let i = 1; i < order.length; i++) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
    expect(html).toContain(">5<"); // NEW lane's true count
    expect(html.match(/Nothing at this stage/g)).toHaveLength(5);
  });

  it("a Review card's select hides Confirmed; a Shortlisted card's shows it", () => {
    const reviewHtml = renderBoard([row("r1", "REVIEW")]);
    const optionValues = reviewHtml.match(/value="([A-Z_]+)/g) ?? [];
    expect(optionValues).not.toContain('value="CONFIRMED"');

    const shortlistedHtml = renderBoard([row("r2", "SHORTLISTED")]);
    expect(shortlistedHtml).toContain('value="CONFIRMED"');
  });

  it("covers every lane with an icon mark (exhaustive by type)", () => {
    for (const state of SCRAPER_KANBAN_LANES) {
      expect(SHORTLIST_LANE_ICON[state]).toBeTruthy();
    }
    expect(Object.keys(SHORTLIST_LANE_ICON)).toHaveLength(7);
  });
});

describe("describeScraperMoveToast — mirrors the inbox's wording", () => {
  it("says what moved, what was already there, and what was blocked", () => {
    expect(
      describeScraperMoveToast("REVIEW", { moved: 3, already: 1, blocked: 0 }),
    ).toBe("3 moved · 1 already there");
  });

  it("names the gate on a blocked confirm", () => {
    expect(
      describeScraperMoveToast("CONFIRMED", { moved: 2, already: 0, blocked: 4 }),
    ).toBe("2 confirmed · 4 skipped — only shortlisted items can be confirmed");
  });
});
