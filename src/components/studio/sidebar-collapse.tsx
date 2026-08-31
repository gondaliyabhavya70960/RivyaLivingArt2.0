"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "rr-studio-sidebar";
const ATTR = "data-sidebar-collapsed";

/**
 * The collapsed flag lives on <html> (a `data-sidebar-collapsed` attribute)
 * so the server-rendered shell can restyle itself with pure CSS variants and
 * the layout's pre-hydration script can restore it before first paint. That
 * makes the DOM the source of truth, so the toggle reads it as an EXTERNAL
 * STORE rather than mirroring it into React state from an effect — no
 * cascading render, and no stale copy if anything else flips the attribute.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getSnapshot() {
  return document.documentElement.hasAttribute(ATTR);
}

/** No DOM on the server — the shell renders expanded, then hydrates. */
function getServerSnapshot() {
  return false;
}

export function SidebarCollapseToggle() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = () => {
    const next = !collapsed;
    const root = document.documentElement;
    if (next) root.setAttribute(ATTR, "");
    else root.removeAttribute(ATTR);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked — the toggle still works for this page view.
    }
    for (const listener of listeners) listener();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="flex min-h-11 w-full items-center gap-3 rounded-input px-3 text-small text-mist outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:bg-mineral/6 hover:text-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none [[data-sidebar-collapsed]_&]:justify-center"
    >
      {collapsed ? (
        <PanelLeftOpen aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
      ) : (
        <PanelLeftClose aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
      )}
      <span className="[[data-sidebar-collapsed]_&]:hidden">Collapse</span>
    </button>
  );
}
