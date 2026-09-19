// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  KanbanBoard,
  KanbanCardShell,
  KanbanColumn,
  KanbanMoveSelect,
  type KanbanMoveOption,
} from "@/components/studio/kanban";
import { STATUS_LABELS, STATUS_ORDER } from "@/components/studio/inquiries/labels";
import type { InquiryStatus } from "@/generated/prisma/enums";

/**
 * The shared Kanban primitives are PRESENTATIONAL on purpose — hooks,
 * server calls and state live in the consumer — so they render to static
 * markup with no DOM and no database. The interaction test mounts the move
 * select in happy-dom for the one thing markup cannot prove: that a change
 * reaches `onMove` with the right value.
 */

const OPTIONS: readonly KanbanMoveOption<InquiryStatus>[] = STATUS_ORDER.map(
  (status) => ({ value: status, label: STATUS_LABELS[status] }),
);

describe("KanbanColumn", () => {
  it("renders the lane label and the TRUE count, not the rendered-card count", () => {
    const html = renderToStaticMarkup(
      createElement(
        KanbanColumn,
        { label: "Quoted", count: 14 },
        createElement("li", null, "one of the two shown"),
      ),
    );
    expect(html).toContain("Quoted");
    expect(html).toContain("14");
    expect(html).not.toContain("Nothing at this stage");
  });

  it("renders the empty state only when the lane is empty", () => {
    const html = renderToStaticMarkup(
      createElement(KanbanColumn, {
        label: "Delivered",
        count: 0,
        empty: true,
      }),
    );
    expect(html).toContain("Nothing at this stage");
    // An empty lane renders no card list at all.
    expect(html).not.toContain("<ul");
  });
});

describe("KanbanBoard lanes", () => {
  it("derive from the entity's real enum — no invented stages", () => {
    const html = renderToStaticMarkup(
      createElement(
        KanbanBoard,
        null,
        STATUS_ORDER.map((status) =>
          createElement(KanbanColumn, {
            key: status,
            label: STATUS_LABELS[status],
            count: 0,
            empty: true,
          }),
        ),
      ),
    );
    // Exactly the seven active InquiryStatus lanes, in order — and no
    // spec-invented stage ever appears beside them.
    for (const status of STATUS_ORDER) {
      expect(html).toContain(STATUS_LABELS[status]);
    }
    expect(html).not.toContain("Curing");
    expect(html).not.toContain("Approved");
  });
});

describe("KanbanMoveSelect", () => {
  it("renders every option with the current value selected and the accessible name", () => {
    const html = renderToStaticMarkup(
      createElement(KanbanMoveSelect, {
        value: "NEW" as InquiryStatus,
        options: OPTIONS,
        onMove: () => {},
        ariaLabel: "Stage for Asha's commission",
      }),
    );
    expect(html).toContain("Stage for Asha&#x27;s commission");
    expect(html).toContain('value="NEW"');
    for (const status of STATUS_ORDER) {
      expect(html).toContain(`value="${status}"`);
    }
  });

  it("carries the disabled state while a move is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(KanbanMoveSelect, {
        value: "QUOTED" as InquiryStatus,
        options: OPTIONS,
        disabled: true,
        onMove: () => {},
        ariaLabel: "Stage for a card",
      }),
    );
    expect(html).toContain("disabled");
  });

  it("calls onMove with the next status when the selection changes", () => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const moves: InquiryStatus[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(KanbanMoveSelect, {
          value: "NEW" as InquiryStatus,
          options: OPTIONS,
          onMove: (next) => moves.push(next as InquiryStatus),
          ariaLabel: "Stage for a card",
        }),
      );
    });
    const select = host.querySelector("select");
    expect(select).not.toBeNull();
    act(() => {
      if (select) {
        select.value = "CONTACTED";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(moves).toEqual(["CONTACTED" as InquiryStatus]);
    act(() => root.unmount());
    host.remove();
  });
});

describe("KanbanCardShell", () => {
  it("fades while its move is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(KanbanCardShell, { busy: true }, "card"),
    );
    expect(html).toContain("opacity-60");
  });
});
