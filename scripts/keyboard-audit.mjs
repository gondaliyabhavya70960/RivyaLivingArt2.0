#!/usr/bin/env node
/**
 * The keyboard contract for the storefront's overlays (REDESIGN.md Part 17 ·
 * §19.6 · WCAG 2.1 2.1.1/2.1.2/2.4.3).
 *
 *   node scripts/keyboard-audit.mjs [--w 1440]
 *
 * `a11y-audit.mjs` runs axe over a page as it sits. Axe cannot press a key, so
 * the one thing an overlay must get right — open by keyboard, trap focus,
 * close on Escape, hand focus back to the control that opened it — was checked
 * by nobody. A drawer that opens but strands focus behind it passes every gate
 * this repo had, and a keyboard user is simply stuck.
 *
 * Each overlay is driven the way a keyboard user drives it: focus the trigger,
 * press the key, then assert on the DOM and on `document.activeElement`.
 *
 *   drawer  `button[aria-controls="site-drawer"]` → Enter → `#site-drawer`
 *   search  `[data-slot="sf-search-trigger"]`     → Enter → `[data-slot="sf-search-overlay"]`
 *   mega    `[data-slot="sf-mega-trigger"]`       → focus → `#shop-mega`
 *
 * The mega menu opens on focus rather than on a key, which IS its keyboard
 * path (`onFocus` in site-header.tsx) — so focusing the trigger is the action.
 *
 * NOT covered: the portfolio/product lightbox. It lives on detail routes,
 * which CI does not sweep because their slugs are content rather than code
 * (ci.yml AUDIT_ROUTES). Roadmap Phase 17 gives CI deterministic detail slugs;
 * the lightbox joins this file then, and until it does that gap is stated here
 * rather than left to be inferred from a passing run.
 */
import { launchChromium } from "./lib/browser.mjs";

const rest = process.argv.slice(2);
const widthIndex = rest.indexOf("--w");
const width = widthIndex === -1 ? 1440 : Number(rest[widthIndex + 1]);
const base = process.env.BASE_URL ?? "http://localhost:3000";

/** Every overlay the shared chrome owns, and how a keyboard reaches it. */
const OVERLAYS = [
  {
    name: "drawer",
    trigger: 'button[aria-controls="site-drawer"]',
    panel: "#site-drawer",
    open: "Enter",
    modal: true,
  },
  {
    name: "search",
    trigger: '[data-slot="sf-search-trigger"]',
    panel: '[data-slot="sf-search-overlay"]',
    open: "Enter",
    modal: true,
  },
  {
    /* NOT a dialog — `role="region"`, opened by focusing the trigger. The
       distinction decides what to assert: a modal must PULL focus in, and a
       disclosure must NOT. Pulling focus here would trap anyone who merely
       tabbed past the Shop link on their way to the rest of the header. What
       it owes instead is that Tab reaches its contents, and that Escape
       dismisses it (WCAG 1.4.13). This check asserted the modal rule against
       it at first and reported a defect that was not there. */
    name: "mega menu",
    trigger: '[data-slot="sf-mega-trigger"]',
    panel: "#shop-mega",
    open: null,
    modal: false,
  },
];

/**
 * Poll a focus predicate to a deadline instead of sampling once. Focus
 * restoration runs in a React effect after the overlay unmounts, so a single
 * read immediately after the panel disappears is a race — one that reported
 * two failures against code that was correct before this was added.
 */
async function settles(page, predicate, arg, timeout = 2000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(predicate, arg)) return true;
    if (Date.now() > deadline) return false;
    await page.waitForTimeout(50);
  }
}

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.log(`  ✗ ${message}`);
};
const pass = (message) => console.log(`  · ${message}`);

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
});
const page = await context.newPage();

console.log(`\nkeyboard paths @ ${width}px`);

for (const overlay of OVERLAYS) {
  /* A FRESH LOAD PER OVERLAY. Driving all three in sequence on one page made
     this check flaky — the previous overlay's Escape leaves focus restoration
     in flight, and the next overlay's assertions raced it. Three page loads
     cost a few seconds; a gate that fails one run in four costs its own
     credibility. */
  await page.goto(base + "/", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.evaluate(() => document.fonts.ready);

  const trigger = page.locator(overlay.trigger).first();
  if ((await trigger.count()) === 0 || !(await trigger.isVisible())) {
    // Not a failure: the chrome is responsive on purpose, and a control that
    // is not offered at this width has no keyboard path to check.
    pass(`${overlay.name}: no trigger at this width — skipped`);
    continue;
  }

  await trigger.focus();
  const focusedTrigger = await settles(
    page,
    (sel) => document.activeElement?.matches(sel) ?? false,
    overlay.trigger,
  );
  if (!focusedTrigger) {
    fail(`${overlay.name}: the trigger cannot take keyboard focus`);
    continue;
  }

  if (overlay.open) await page.keyboard.press(overlay.open);
  const panel = page.locator(overlay.panel).first();
  try {
    await panel.waitFor({ state: "visible", timeout: 3000 });
  } catch {
    fail(
      `${overlay.name}: ${overlay.open ? `${overlay.open} on the trigger` : "focusing the trigger"} did not open ${overlay.panel}`,
    );
    continue;
  }

  const focusIn = (sel) =>
    settles(
      page,
      (s) => document.querySelector(s)?.contains(document.activeElement) ?? false,
      sel,
    );
  const focusNotIn = async (sel) =>
    !(await page.evaluate(
      (s) => document.querySelector(s)?.contains(document.activeElement) ?? false,
      sel,
    ));

  if (overlay.modal) {
    // 2.4.3 — a modal must move focus in, or the keyboard user is left behind
    // it operating a page they cannot see.
    if (await focusIn(overlay.panel)) {
      pass(`${overlay.name}: opens and takes focus`);
    } else {
      fail(`${overlay.name}: modal opened but focus stayed outside it`);
    }
  } else {
    // A disclosure must NOT steal focus, but its contents must be reachable
    // from the trigger by Tab — otherwise it is decoration for mouse users.
    if (!(await focusNotIn(overlay.panel))) {
      fail(`${overlay.name}: a non-modal disclosure pulled focus into itself`);
    } else {
      /* Reachable by Tab, not necessarily the NEXT stop. The panel renders
         after the header row, so tabbing crosses the remaining nav links and
         the search control first — measured at seven presses. That is DOM
         order matching visual order, not a defect; requiring one press
         reported a failure against correct markup. What matters is that a
         keyboard user gets there at all, and that the panel stays open while
         they do. */
      const MAX_TABS = 12;
      let reachedAt = 0;
      for (let i = 1; i <= MAX_TABS; i += 1) {
        await page.keyboard.press("Tab");
        if (await focusNotIn(overlay.panel)) continue;
        reachedAt = i;
        break;
      }
      if (reachedAt) {
        pass(
          `${overlay.name}: opens on focus, contents reachable in ${reachedAt} tab(s)`,
        );
      } else {
        fail(
          `${overlay.name}: opened, but its contents are unreachable within ${MAX_TABS} tabs`,
        );
      }
      await trigger.focus(); // back to the trigger for the Escape assertion
    }
  }

  // 2.1.2 — Escape is the documented way out of every one of these.
  await page.keyboard.press("Escape");
  try {
    await panel.waitFor({ state: "hidden", timeout: 3000 });
    pass(`${overlay.name}: Escape closes it`);
  } catch {
    fail(`${overlay.name}: Escape did not close it — focus is trapped`);
    continue;
  }

  const focusReturned = await settles(
    page,
    (sel) => document.activeElement?.matches(sel) ?? false,
    overlay.trigger,
  );
  if (!focusReturned) {
    fail(`${overlay.name}: focus was not returned to the trigger on close`);
  } else {
    pass(`${overlay.name}: returns focus to its trigger`);
  }
}

await browser.close();

if (failures > 0) {
  console.error(`\n✗ ${failures} keyboard-path failure(s) at ${width}px.`);
  process.exit(1);
}
console.log(`\n✓ every overlay keyboard path holds at ${width}px.`);
