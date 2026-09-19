import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The board's move handler calls the existing Server Action — the TEST
// replaces it with a spy, so no database or auth layer loads at all.
vi.mock("@/actions/products", () => ({
  setProductsStatus: vi.fn(async () => ({
    ok: true,
    data: {
      updated: 1,
      skippedRewrite: 0,
      skippedUntiered: 0,
      skippedPlaceholder: 0,
      skippedNoImage: 0,
    },
  })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

import { ProductsKanban } from "@/components/studio/products/products-kanban";
import {
  PRODUCT_KANBAN_STATUSES,
  PRODUCT_MOVE_OPTIONS,
  describeMoveToast,
} from "@/components/studio/products/products-kanban-model";
import { resolveKanbanView } from "@/components/studio/kanban";
import type { ProductRow } from "@/components/studio/products/product-list";

const untieredRow: ProductRow = {
  id: "p1",
  title: "Ocean River Dining Table",
  categoryName: "Resin Furniture & Surfaces",
  priceMin: 84999,
  priceMax: null,
  status: "DRAFT",
  isDemo: false,
  featured: false,
  needsRewrite: false,
  tier: null,
  sizeTier: null,
  inStock: true,
  imported: false,
  demoted: false,
  thumbnailUrl: null,
  updatedAt: "19 Sep 2026",
};

const rewriteRow: ProductRow = {
  ...untieredRow,
  id: "p2",
  title: "Varmala Preservation Clock",
  priceMin: 3499,
  priceMax: 4999,
  needsRewrite: true,
  sizeTier: "MEDIUM_FORMAT",
};

const liveRow: ProductRow = {
  ...untieredRow,
  id: "p3",
  title: "Geode Coaster Set",
  status: "PUBLISHED",
  sizeTier: "SMALL_FORMAT",
};

const LANES: Record<ProductRow["status"], ProductRow[]> = {
  DRAFT: [untieredRow, rewriteRow],
  REVIEW: [],
  PUBLISHED: [liveRow],
  ARCHIVED: [],
};
const COUNTS = { DRAFT: 2, REVIEW: 0, PUBLISHED: 14, ARCHIVED: 0 };

function renderBoard() {
  return renderToStaticMarkup(
    createElement(ProductsKanban, {
      lanes: LANES,
      counts: COUNTS,
      laneCap: 30,
    }),
  );
}

describe("ProductsKanban", () => {
  it("renders the four real statuses as lanes, in workflow order", () => {
    const html = renderBoard();
    const draft = html.indexOf("Draft");
    const review = html.indexOf("Review");
    const published = html.indexOf("Published");
    const archived = html.indexOf("Archived");
    expect(draft).toBeGreaterThan(-1);
    expect(draft).toBeLessThan(review);
    expect(review).toBeLessThan(published);
    expect(published).toBeLessThan(archived);
    // And no conceptual stage ever becomes a lane (the prompt's own rule).
    expect(html).not.toContain("Incomplete");
    expect(html).not.toContain("Ready</h3>");
  });

  it("shows TRUE counts on lane headers, not the rendered slice", () => {
    const html = renderBoard();
    expect(html).toContain("14"); // PUBLISHED total, with one card rendered
    // …and the cap note says so when a lane renders a slice.
    expect(html).toContain("MOST RECENTLY UPDATED PER LANE");
  });

  it("renders the workflow markers as card flags — never as lanes", () => {
    const html = renderBoard();
    expect(html).toContain("No tier yet");
    expect(html).toContain("needs rewrite");
    expect(html).toContain("Ocean River Dining Table");
    expect(html).toContain("₹84,999");
    expect(html).toContain("₹3,499 – ₹4,999");
    // Two lanes are empty; the other two are not.
    expect(html.match(/Nothing at this stage/g)).toHaveLength(2);
  });

  it("offers every status on every card's move control — the server guards", () => {
    const html = renderBoard();
    for (const status of PRODUCT_KANBAN_STATUSES) {
      expect(html).toContain(`value="${status}"`);
    }
    expect(html).toContain('value="DRAFT"');
    expect(html).toContain('value="PUBLISHED"');
    expect(PRODUCT_MOVE_OPTIONS).toHaveLength(4);
  });
});

describe("describeMoveToast — a refused publish says exactly why", () => {
  const base = {
    updated: 0,
    skippedRewrite: 0,
    skippedUntiered: 0,
    skippedPlaceholder: 0,
    skippedNoImage: 0,
  };

  it("names the missing tier", () => {
    const toast = describeMoveToast("PUBLISHED", "Ocean Table", {
      ...base,
      skippedUntiered: 1,
    });
    expect(toast.kind).toBe("warning");
    expect(toast.message).toContain("no product tier is set");
    expect(toast.message).toContain("was not published");
  });

  it("names the concept placeholder cover", () => {
    const toast = describeMoveToast("PUBLISHED", "Ocean Table", {
      ...base,
      skippedPlaceholder: 1,
    });
    expect(toast.message).toContain("concept placeholder");
  });

  it("names the missing photograph and the scraped-content rewrite", () => {
    const toast = describeMoveToast("PUBLISHED", "Ocean Table", {
      ...base,
      skippedNoImage: 1,
      skippedRewrite: 1,
    });
    expect(toast.message).toContain("no photograph at all");
    expect(toast.message).toContain("rewrite of scraped content");
  });

  it("celebrates a real publish and a plain move", () => {
    expect(
      describeMoveToast("PUBLISHED", "Ocean Table", { ...base, updated: 1 }),
    ).toEqual({ kind: "success", message: '"Ocean Table" is published.' });
    expect(
      describeMoveToast("ARCHIVED", "Ocean Table", { ...base, updated: 1 })
        .message,
    ).toContain("moved to archived");
  });
});

describe("resolveKanbanView", () => {
  it("lets the URL win, falls back to the stored preference", () => {
    expect(resolveKanbanView("kanban", "table")).toBe("kanban");
    expect(resolveKanbanView("table", "kanban")).toBe("table");
    expect(resolveKanbanView(null, "kanban")).toBe("kanban");
    // A typo or stale link never invents a third view.
    expect(resolveKanbanView("grid", "kanban")).toBe("kanban");
    expect(resolveKanbanView("grid", "table")).toBe("table");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
