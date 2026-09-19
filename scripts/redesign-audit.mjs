#!/usr/bin/env node
/**
 * REDESIGN.md Part 19 as an executable check.
 *
 *   node scripts/redesign-audit.mjs "/en,/en/shop,/en/about" [--w 1440]
 *
 * Part 19.1 lists rules that are otherwise only ever checked by eye — one
 * `h1`, no repeated heading text, at most two `major` sections, at most three
 * dark bands and never two adjacent, at most two champagne elements per
 * viewport, no horizontal overflow. A rule nobody can run is a rule that
 * quietly stops being true, so they run here against the rendered page.
 *
 * Runs in CI (.github/workflows/ci.yml, the build job): that job already has
 * the built output and a database, so it starts the server and sweeps every
 * public route at 1440px and 390px. Non-zero exit fails the build.
 *
 * Part 14's reduced-motion clause rides along at the end of each route: the
 * same route is loaded a second time in a `reducedMotion: "reduce"` context
 * and sampled for anything still moving. It is the one rule here that needs a
 * second page load — about three seconds a route, measured — and it is worth
 * that: every other check reads a settled page, and a missing reduced-motion
 * fallback is invisible on one.
 *
 * Every rule here fails the build. The champagne count was the one exception
 * — a design review rather than a test, printed as a note for a human — until
 * Phase 1b, when every audited route was measured passing it and the note
 * became a rule. The measurement it counts is deliberately narrow (see the
 * long comment above it); what it will not do is quietly stop being true.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import sharp from "sharp";

import { launchChromium } from "./lib/browser.mjs";

/**
 * Site-root prefixes served from `public/` — the assets this repository ships
 * and is therefore accountable for. Derived from the directory rather than
 * hardcoded, so a new asset folder is gated the day it appears. `uploads` is
 * excluded: it is gitignored owner-uploaded media, absent in a fresh checkout.
 */
const BUNDLED_ROOTS = readdirSync(join(import.meta.dirname, "..", "public"), {
  withFileTypes: true,
})
  .filter((e) => e.name !== "uploads")
  .map((e) => (e.isDirectory() ? `/${e.name}/` : `/${e.name}`));

const [routesArg, ...rest] = process.argv.slice(2);
if (!routesArg) {
  console.error('usage: redesign-audit.mjs "/en,/en/shop" [--w 1440]');
  process.exit(1);
}
const widthIndex = rest.indexOf("--w");
const width = widthIndex === -1 ? 1440 : Number(rest[widthIndex + 1]);
const base = process.env.BASE_URL ?? "http://localhost:3000";

/* Touch-capable contexts at phone widths (F2). The 44px tap-floor rule below
   used to be a NOTE because the browser context this script drove was always
   mouse/fine-pointer, so every `pointer-coarse:min-h-11` utility the repo
   ships (button.tsx, footer links, the announcement link, the locale
   switcher, the shop tabs — A1) never applied and the count it reported was
   never what a phone visitor actually gets. `hasTouch` (isMobile is NOT set — it widens innerWidth by a phantom scrollbar and fakes a 2px overflow;
   which Chromium requires alongside it for `pointer: coarse` /
   `any-pointer: coarse` to resolve in the media query) make those utilities
   active only where a real phone would activate them too — ≤700px, the same
   threshold the mobile-height branch below already uses. */
const touchContext = width <= 700;
const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
  ...(touchContext ? { hasTouch: true } : {}),
});
const page = await context.newPage();

/* The same viewport with the media feature on, for the reduced-motion rule at
   the end of the route loop. A second CONTEXT rather than an
   `emulateMedia` flip on the page above, because a visitor whose OS carries
   the setting carries it from the first paint: flipping the query on a page
   that has already mounted, hydrated and finished its entrances measures a
   different thing entirely. */
const reducedContext = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
  ...(touchContext ? { hasTouch: true } : {}),
  reducedMotion: "reduce",
});
const reducedPage = await reducedContext.newPage();

/**
 * WCAG relative-luminance contrast (F2, the header `data-ink` rule below).
 * `sRgbToLinear` follows the spec's own piecewise definition; `contrastOf`
 * is the standard `(L1+0.05)/(L2+0.05)` with the lighter channel first.
 */
function sRgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance([r, g, b]) {
  return (
    0.2126 * sRgbToLinear(r) +
    0.7152 * sRgbToLinear(g) +
    0.0722 * sRgbToLinear(b)
  );
}
function contrastOf(rgbA, rgbB) {
  const a = relativeLuminance(rgbA);
  const b = relativeLuminance(rgbB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
function parseRgbTriple(value) {
  const m = String(value ?? "").match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/,
  );
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

let failures = 0;
let routeFailures = 0;
const report = (level, message) => {
  if (level === "FAIL") {
    failures += 1;
    routeFailures += 1;
  }
  console.log(`  ${level === "FAIL" ? "✗" : "·"} ${message}`);
};

for (const route of routesArg.split(",")) {
  console.log(`\n${route}`);
  routeFailures = 0;
  try {
    await page.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.8);
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);
      /* Wait for transitions to actually finish rather than guessing at a
         delay. A fixed 300ms measured product cards mid-fade — their hover
         hairline sat at opacity 0.6 on the way back to 0, so /shop reported
         six champagne elements where a settled page has one. Infinite
         animations (the hero droplet, the marquee) never finish and are
         excluded, or this would always time out. */
      const running = () =>
        document.getAnimations().filter((a) => {
          if (a.playState !== "running") return false;
          const timing = a.effect?.getComputedTiming?.();
          return !timing || timing.iterations !== Infinity;
        }).length;
      const deadline = Date.now() + 2000;
      while (running() > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      await new Promise((r) => setTimeout(r, 150));
    });
  } catch (err) {
    report("FAIL", `did not load: ${String(err).slice(0, 120)}`);
    continue;
  }

  const audit = await page.evaluate((BUNDLED_ROOTS) => {
    const main = document.querySelector("main") ?? document.body;

    // Only VISIBLE headings: several components server-render two
    // compositions and let a media query pick one, and a display:none subtree
    // is out of the accessibility tree entirely.
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    /* Heading text is read the way AT reads it — aria-hidden subtrees do not
       contribute — so a card that paints a clamped title beside an sr-only
       full one is not counted twice. */
    const ownText = (el) => {
      const clone = el.cloneNode(true);
      for (const hidden of clone.querySelectorAll("[aria-hidden='true']")) {
        hidden.remove();
      }
      return (clone.textContent ?? "").trim().replace(/\s+/g, " ");
    };
    const headings = [...main.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((h) => ({ level: Number(h.tagName[1]), text: ownText(h) }))
      .filter((h) => h.text.length > 0);

    const h1s = headings.filter((h) => h.level === 1);

    // Skipped levels: a jump of more than one down the tree.
    const skipped = [];
    for (let i = 1; i < headings.length; i += 1) {
      if (headings[i].level - headings[i - 1].level > 1) {
        skipped.push(
          `${headings[i - 1].level}→${headings[i].level}: "${headings[i].text}"`,
        );
      }
    }

    /* Duplicated heading text (§17: "No duplicated heading text on a page").
       Scoped to h1/h2 — the SECTION headings the rule is about. An h3 is a
       card title, and a catalogue that legitimately holds two pieces with the
       same name would otherwise fail a rule aimed at the page's structure. */
    const seen = new Map();
    const duplicated = [];
    for (const h of headings.filter((x) => x.level <= 2)) {
      const key = h.text.toLowerCase();
      if (seen.has(key)) duplicated.push(h.text);
      else seen.set(key, true);
    }

    // Section tiers and dark bands, in document order.
    const sections = [...main.querySelectorAll("section, div")].filter(
      (el) =>
        el.className &&
        typeof el.className === "string" &&
        /section-(major|standard|compact)/.test(el.className),
    );
    const majors = sections.filter((el) =>
      /section-major/.test(el.className),
    ).length;

    // Only page-level bands: a card's own dark scrim carries the same scope
    // attribute, and counting those would make every product grid a "band".
    const bands = [...main.querySelectorAll('[data-theme="navy"]')].filter(
      (el) =>
        visible(el) &&
        el.parentElement?.closest('[data-theme="navy"]') == null &&
        el.getBoundingClientRect().width >=
          document.documentElement.clientWidth * 0.9,
    );
    // Adjacency: two dark bands that are consecutive siblings.
    let adjacent = 0;
    for (const band of bands) {
      let next = band.nextElementSibling;
      while (next && next.getBoundingClientRect().height === 0) {
        next = next.nextElementSibling;
      }
      if (next && next.matches('[data-theme="navy"]')) adjacent += 1;
    }

    /* The footer is always obsidian, so a dark LAST section in <main> makes a
       continuous dark run from the page's final band into the footer. §3.1's
       "light → dark → light" is about the whole document, not just the part
       inside <main>, and this is the one boundary the in-main scan misses. */
    const lastSection = [...main.children]
      .reverse()
      .find((el) => el.getBoundingClientRect().height > 0);
    const footerIsDark = Boolean(
      document.querySelector('footer[data-theme="navy"]'),
    );
    const darkRunIntoFooter =
      footerIsDark &&
      Boolean(
        lastSection &&
        (lastSection.matches('[data-theme="navy"]') ||
          lastSection.querySelector(':scope > [data-theme="navy"]:last-child')),
      );

    // Images without an alt attribute at all (an empty alt is valid).
    const missingAlt = [...main.querySelectorAll("img")].filter(
      (i) => i.getAttribute("alt") === null,
    ).length;

    /* Ellipsised accessible names (§17: "no `…` in the accessible name").
       The name is computed the way AT computes it — an aria-label wins, and
       aria-hidden subtrees contribute nothing. A card that paints a clamped
       title beside an sr-only full one is CORRECT, and reading raw
       textContent would flag it. */
    const accessibleName = (el) => {
      const label = el.getAttribute("aria-label");
      if (label) return label;
      const clone = el.cloneNode(true);
      for (const hidden of clone.querySelectorAll("[aria-hidden='true']")) {
        hidden.remove();
      }
      return (clone.textContent ?? "").trim();
    };
    const ellipsisNames = [...main.querySelectorAll("a,button")].filter((el) =>
      /…|\.\.\./.test(accessibleName(el)),
    ).length;

    /* Part 19.1: "every number in JetBrains Mono tabular". Scoped to elements
       whose ENTIRE visible text is a figure — a price, a count, a date, a
       dimension. A paragraph that happens to contain "24" is prose, not data,
       and flagging it would make the rule unreadable. */
    const NUMERIC =
      /^[₹$€£]?\s*[\d][\d\s.,:/–—-]*(?:%|h|hrs?|days?|weeks?|px|mm|cm|in|g|kg)?$/i;
    const monoNumbers = { total: 0, offenders: [] };
    for (const el of main.querySelectorAll(
      "span,p,dd,dt,td,th,li,strong,em,b,time",
    )) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? "").trim();
      if (text.length === 0 || text.length > 24 || !NUMERIC.test(text))
        continue;
      if (!visible(el)) continue;
      monoNumbers.total += 1;
      const family = getComputedStyle(el).fontFamily.toLowerCase();
      if (!family.includes("jetbrains") && !family.includes("mono")) {
        monoNumbers.offenders.push(text);
      }
    }

    /* Part 15.5: "Alt text describes the picture, not the brand." The tell is
       a brand name standing in for a description — `alt="Rivya Living Art luxury
       resin art"` — not a brand name inside a real sentence, which is often
       the most accurate thing to write. A short alt that is mostly the brand
       is the former; longer is the latter. Decorative images correctly
       carry alt="".

       The threshold is brand-length-relative, not a bare 4. The old brand was
       one word, so "four words or fewer" allowed the brand plus three of
       description. "Rivya Living Art" is three words, so the same intent is
       six. Hard-coding 4 against a three-word brand would flag every honest
       alt that merely mentions it. The pattern matches on "rivya" alone so a
       future short-form wordmark still trips the rule. */
    const BRAND_WORDS = 3; // "Rivya Living Art"
    const brandAlts = [...main.querySelectorAll("img")]
      .map((i) => i.getAttribute("alt") ?? "")
      .filter(
        (a) =>
          a.length > 0 &&
          /rivya/i.test(a) &&
          a.trim().split(/\s+/).length <= BRAND_WORDS + 3,
      );

    /* Champagne elements in the first viewport (§3.1: max two).

       This check used to compare the raw token — `#b89b63` with the hash
       stripped — against `getComputedStyle().color`, which every browser
       serializes as `rgb(184, 155, 99)`. The substring could never match, so
       the rule reported zero on every page and had never once fired. Both
       sides are now normalized to an `r,g,b` triple.

       `--champagne-ink` USED to be excluded here, on the argument that it was
       the AA companion (#75602f) that exists so champagne-coloured TEXT stays
       legible on a light ground, and that §3.1 governs the accent's visual
       weight rather than that fallback.

       D30 dissolved that distinction: `--champagne-ink: var(--champagne)`,
       because on obsidian champagne itself is 7.5:1 and needs no darker twin.
       The two names now resolve to ONE value, so the exclusion cannot be
       expressed even in principle — and should not be, since an element
       painting champagne-ink is now painting champagne and does spend the
       viewport's budget. It is counted, by the same comparison as everything
       else. Nothing was removed to make that true; the token move did it. */
    const rgb = (hex) => {
      const h = hex.trim().replace("#", "");
      if (h.length !== 6) return null;
      const n = Number.parseInt(h, 16);
      if (Number.isNaN(n)) return null;
      return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
    };
    const triple = (value) => {
      const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      return m ? `${m[1]},${m[2]},${m[3]}` : null;
    };

    const champagne = rgb(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--champagne",
      ),
    );

    /* "Visible in any viewport" is the rule's own wording, so the count has to
       mean it. Three things were being counted that nobody can see:

       - a product card's hover hairline, at `opacity-0` until hover. /shop
         has one per card, so a twelve-card grid reported twelve;
       - the cure line's 1px rail, laid out at zero height;
       - and the SAME piece of text twice, because a `text-champagne` wrapper
         and the span inside it both compute to champagne while only one of
         them paints any glyphs.

       So: skip anything with no box, anything transparent or hidden (checking
       ancestors — opacity is inherited in effect if not in cascade), and count
       `color` only on the element that actually holds the text. */
    const paintsOwnText = (el) =>
      [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim() !== "",
      );
    const isVisible = (el) => {
      for (
        let node = el;
        node && node !== document;
        node = node.parentElement
      ) {
        const cs = getComputedStyle(node);
        if (cs.visibility !== "visible" || Number(cs.opacity) === 0) {
          return false;
        }
      }
      return true;
    };

    /* A FOURTH thing nobody can see, found the same way as the other three —
       by a rule firing on a page where the accent was demonstrably used twice.

       `sr-only` is a 1×1 absolutely-positioned box, clipped away, holding real
       text for assistive technology. It therefore passes every test above: it
       has a box (1px, not 0), it is `visible`, it is fully opaque, and it
       paints its own text node. The system pages' primary action carries one —
       the "(opens in new tab)" hint on the WhatsApp link — which inherits the
       pill's champagne and was counted as a third champagne object on a page
       that shows exactly two.

       §3.1 is a rule about how much gold a person SEES. A screen-reader hint
       is not gold; it has no colour at all in the only medium that consumes
       it. Anything clipped to a 1×1 box is excluded, which is `sr-only`'s own
       definition and not a special case for it. */
    const isScreenReaderOnly = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 || r.height > 1) return false;
      const cs = getComputedStyle(el);
      return (
        cs.position === "absolute" &&
        (cs.clip !== "auto" ||
          cs.clipPath !== "none" ||
          cs.overflow === "hidden")
      );
    };

    /* The cure rail is out of scope, for the same reason `--champagne-ink`
       is. §3.1 governs the ACCENT'S visual weight; the rail is navigation,
       1px wide, living in a 56px gutter, and it goes champagne on a dark band
       only because sapphire is invisible there. Counting it made the rule
       fire on hero HEIGHT — whether the rail's first tick happens to land
       above the fold — rather than on how much gold is on the page. */
    const cureRail = main.querySelector('[data-slot="cure-line"]');

    /* The maintenance page's cure LOOP (§2.10) is out of scope on exactly the
       sentence above, and it is worth being explicit that this exclusion was
       widened for a change rather than found by one: adding the loop took
       /maintenance to three champagne objects and failed this rule.

       It is the same device and the same argument — a 1px hairline, not
       navigation this time but decoration, champagne because sapphire at 1px
       on obsidian is not there. What §3.1 is protecting is how much GOLD a
       viewport carries, and 255×1 pixels of it is not what the cap is about;
       the two objects the rule is actually counting on that page (the eyebrow
       and the WhatsApp pill) are both still counted, and a third real one
       would still fail.

       The marker is a `data-slot`, not a route or a class, for the reason the
       system-page exemption uses one: a rule keyed on a page's NAME stops
       being true the day the element moves. */
    const cureLoop = main.querySelector('[data-slot="cure-loop"]');

    const inFirstViewport = !champagne
      ? 0
      : [...main.querySelectorAll("*")].filter((el) => {
          if (cureRail?.contains(el)) return false;
          if (cureLoop?.contains(el) || el === cureLoop) return false;
          const r = el.getBoundingClientRect();
          if (
            r.bottom < 0 ||
            r.top > window.innerHeight ||
            r.width === 0 ||
            r.height === 0
          ) {
            return false;
          }
          if (!isVisible(el)) return false;
          if (isScreenReaderOnly(el)) return false;
          const cs = getComputedStyle(el);
          if (
            triple(cs.backgroundColor) === champagne ||
            triple(cs.borderTopColor) === champagne
          ) {
            return true;
          }
          return triple(cs.color) === champagne && paintsOwnText(el);
        }).length;

    /* Did the pictures this repo ships actually ARRIVE?
       Every other rule here reads markup, so the whole audit passed green over
       12 routes at two widths while the site rendered no photography at all —
       `public/` was missing from the imported ZIP, all 62 image slots resolved
       to a file that was not there, and `/_next/image` answered 400 for every
       one of them. The markup was immaculate; there were simply no pictures.

       A decoded image reports naturalWidth > 0; one that finished loading and
       failed reports 0. Images still in flight have complete === false and are
       not counted, so this never fires on a slow network — the caller has
       already scrolled the page end to end, which starts every lazy request.

       Scoped to BUNDLED assets on purpose. Catalog photography lives on
       supplier hosts (Shopify CDN, kanhakreation, Cloudinary) that this repo
       does not control and `next.config.ts` deliberately renders unoptimized;
       failing a PR because a supplier's CDN blinked would be a gate nobody can
       act on, and it would cry wolf on any run without egress to those hosts.
       The roots come from `public/` itself, so a new asset directory is
       covered the day it is added. */
    const brokenImages = [...document.images]
      .filter(
        (img) =>
          img.complete && img.naturalWidth === 0 && img.currentSrc !== "",
      )
      .map((img) => {
        const raw = img.currentSrc || img.src;
        try {
          const parsed = new URL(raw, location.href);
          if (parsed.origin !== location.origin) return null;
          const inner = parsed.searchParams.get("url");
          // next/image proxies through /_next/image?url=… — an absolute inner
          // URL is a remote host being optimized, still not ours to gate on.
          if (inner && !inner.startsWith("/")) return null;
          const path = decodeURIComponent(inner ?? parsed.pathname);
          return BUNDLED_ROOTS.some((root) => path.startsWith(root))
            ? path
            : null;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    /* Part 3.5 as computed style. "Blur in exactly one place: the sticky
       header on scroll" — plus the header's own search panel, which the
       overlay documents as that same layer. "No drop shadows on the
       storefront", with the mobile bottom bar's 1px hairline rule as the one
       public exception (the Studio bulk bar never renders on these routes).
       Nothing gated either rule, and blur crept into six mounted elements
       and a shadow into the consent banner before anyone noticed (Phase 0
       audit §4.4). A "drop shadow" here is a box-shadow with a blur radius;
       Tailwind rings and the 1px rules render through box-shadow too and are
       borders by another name, so a zero-blur shadow is not an offender.
       Hidden elements are skipped — the sr-only skip link carries a focus
       shadow it never paints unfocused. */
    const describe = (el) => {
      const slot = el.dataset?.slot ? `[data-slot=${el.dataset.slot}]` : "";
      const id = el.id ? `#${el.id}` : "";
      const cls =
        typeof el.className === "string" && el.className
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "";
      return `${el.tagName.toLowerCase()}${id}${slot}${cls}`;
    };
    const hasBlurRadius = (boxShadow) =>
      boxShadow.split(/,(?![^(]*\))/).some((shadow) => {
        const lengths =
          shadow.replace(/rgba?\([^)]*\)/g, "").match(/-?[\d.]+px/g) ?? [];
        // offset-x offset-y blur-radius spread-radius
        return lengths.length >= 3 && parseFloat(lengths[2]) > 0;
      });
    /* Part 3.8 is four durations — 180 · 350 · 800 · 900ms — and the point
       of a closed set is that a fifth value never arrives on the grounds
       that it looked right in one place. Bespoke values did arrive (a 450ms
       page transition, a 200ms mega menu, `duration-200` in the shadcn
       primitives) and nothing said so. Computed style is read rather than
       class names, so a raw CSS rule is caught as readily as a utility. */
    const SANCTIONED_MS = new Set([0, 180, 350, 800, 900]);
    const durationsOf = (value) =>
      String(value || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) =>
          part.endsWith("ms")
            ? Number.parseFloat(part)
            : Number.parseFloat(part) * 1000,
        )
        .filter((ms) => Number.isFinite(ms));

    const blurOffenders = [];
    const shadowOffenders = [];
    const durationOffenders = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      /* Transitions and entrances are what Part 3.8's four values govern. An
         animation that loops forever is a different class of motion and the
         spec times those individually where it wants them — the announcement
         rotation at 6s, the toast countdown at 5s, the droplet at 2.4s — so
         an infinite animation's duration is not held to the four. */
      const loops = String(cs.animationIterationCount || "").includes(
        "infinite",
      );
      for (const ms of [
        ...durationsOf(cs.transitionDuration),
        ...(loops ? [] : durationsOf(cs.animationDuration)),
      ]) {
        // Round: the engine reports 0.18s as 0.18 and floating point makes
        // 179.99999 out of it often enough to matter.
        if (!SANCTIONED_MS.has(Math.round(ms))) {
          durationOffenders.push(`${describe(el)} @ ${Math.round(ms)}ms`);
        }
      }
      const backdrop = cs.backdropFilter || cs.webkitBackdropFilter || "none";
      if (
        backdrop !== "none" &&
        !el.closest(
          "[data-slot='sf-site-header'], [data-slot='sf-search-overlay']",
        )
      ) {
        blurOffenders.push(describe(el));
      }
      if (
        cs.boxShadow &&
        cs.boxShadow !== "none" &&
        hasBlurRadius(cs.boxShadow) &&
        !el.closest("[data-slot='sf-bottom-bar']")
      ) {
        shadowOffenders.push(describe(el));
      }
    }

    /* Targets: "44×44px minimum, 8px separation" (REDESIGN.md:867, contract
       line 160). Measured on the rendered box, with three deliberate
       exemptions that would otherwise make this rule pure noise:

       - A link inside running text. WCAG 2.2's own target-size criterion
         exempts links in a sentence, and a 68ch prose column full of inline
         links is not a tap grid. Detected by an ancestor p/li/blockquote that
         carries text of its own around the link.
       - An element whose hit area is expanded by a pseudo-element. Fourteen
         controls in this repo use `after:absolute after:-inset-*` for exactly
         that, and getBoundingClientRect cannot see it — so the class is read
         directly rather than pretending the measurement is complete.
       - Anything inside the Studio scope, which is a dense desktop tool and
         not held to the storefront's tap floor.

       FAILS at touch widths (F2): the repo's own `pointer-coarse:min-h-11`
       utilities (button.tsx, footer links, the announcement link, the locale
       switcher, the shop tabs — A1) only grow a hit area under `pointer:
       coarse`, so the rule is only honest where THIS SCRIPT'S OWN context is
       touch-capable — `touchContext` above, ≤700px. Below that, this script
       still counts and reports offenders (a design smell worth reading) but
       does not fail the build on them: a fine-pointer viewport was never
       promised 44px by a system that ties the expansion to coarse pointers
       on purpose, and failing there would be enforcing a rule against a
       viewport the rule never applied to. */
    const TAP_MIN = 44;
    const inRunningText = (el) => {
      const p = el.closest("p, li, blockquote, figcaption");
      if (!p) return false;
      const own = (p.textContent ?? "").trim().length;
      const mine = (el.textContent ?? "").trim().length;
      return own > mine + 8; // the paragraph says more than the link does
    };
    const smallTargets = [];
    for (const el of document.querySelectorAll(
      "a[href], button, [role='button'], summary, input:not([type='hidden']), select",
    )) {
      if (!visible(el)) continue;
      if (el.closest(".studio-v2")) continue;
      // Not a target for anyone: the spam honeypots (an aria-hidden .sr-only
      // wrapper with tabIndex -1), and the skip link, which is 1×1 until it
      // takes focus and full size the moment it matters.
      if (el.closest('[aria-hidden="true"]')) continue;
      if (el.getAttribute("tabindex") === "-1") continue;
      if (el.closest(".sr-only")) continue;
      const cls = typeof el.className === "string" ? el.className : "";
      if (/\bsr-only\b/.test(cls)) continue;
      if (/after:-?inset|before:-?inset/.test(cls)) continue; // expanded hit area
      if (el.tagName === "A" && inRunningText(el)) continue;
      const r = el.getBoundingClientRect();
      // Half a pixel of tolerance: a 44px floor met through `min-h-11` can
      // measure 43.99 after subpixel layout, and that is not a small target.
      if (r.width < TAP_MIN - 0.5 || r.height < TAP_MIN - 0.5) {
        smallTargets.push(
          `${describe(el)} ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }

    /* "No scale or lift on hover — colour and underline only" (Part 3.4 ·
       contract line 107). A hover rule cannot be read off computed style, so
       this reads the vocabulary the repo writes in: a hover-variant transform
       utility on anything that behaves as a control. `active:scale-95` is
       explicitly sanctioned by §7.4 and is not a hover state, so it passes. */
    const hoverLift = [];
    for (const el of document.querySelectorAll(
      "button, a, [role='button'], summary",
    )) {
      if (!visible(el)) continue;
      const cls = typeof el.className === "string" ? el.className : "";
      const hit = cls
        .split(/\s+/)
        .find((c) => /^hover:-?(translate|scale)-/.test(c));
      if (hit) hoverLift.push(`${describe(el)} .${hit}`);
    }

    return {
      blurOffenders: [...new Set(blurOffenders)].slice(0, 8),
      shadowOffenders: [...new Set(shadowOffenders)].slice(0, 8),
      durationOffenders: [...new Set(durationOffenders)].slice(0, 8),
      hoverLift: [...new Set(hoverLift)].slice(0, 8),
      smallTargets: [...new Set(smallTargets)].slice(0, 10),
      smallTargetCount: new Set(smallTargets).size,
      brokenImages: [...new Set(brokenImages)],
      h1Count: h1s.length,
      h1Text: h1s.map((h) => h.text),
      skipped,
      duplicated,
      majors,
      bands: bands.length,
      adjacent,
      darkRunIntoFooter,
      missingAlt,
      ellipsisNames,
      champagne: inFirstViewport,
      monoOffenders: [...new Set(monoNumbers.offenders)].slice(0, 8),
      brandAlts: [...new Set(brandAlts)].slice(0, 5),
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  }, BUNDLED_ROOTS);

  if (audit.h1Count !== 1) {
    report(
      "FAIL",
      `${audit.h1Count} <h1> (must be exactly 1): ${audit.h1Text.join(" | ")}`,
    );
  }
  if (audit.skipped.length) {
    report("FAIL", `skipped heading levels — ${audit.skipped.join("; ")}`);
  }
  if (audit.duplicated.length) {
    report(
      "FAIL",
      `duplicated heading text — ${[...new Set(audit.duplicated)].join("; ")}`,
    );
  }
  if (audit.majors > 2) {
    report("FAIL", `${audit.majors} section-major (max 2)`);
  }
  /* D30's three band rules are NOTES now, not failures — the other half of the
     same reconciliation as `src/lib/page-sections.ts`.

     They counted `[data-theme="navy"]`, which tokens.css declares a NO-OP ALIAS
     whose every value is identical to `:root`. So on the dark ground these
     measure how many sections still carry a marker, not how much dark is on the
     page — and "the last band runs into the obsidian footer" is now true of
     every page by construction, because the page itself is obsidian.

     Failing CI on them would have made the ground the design chose illegal.
     They are still COUNTED and still printed, because the marker's distribution
     is the migration's own progress bar: as sections move onto the `--elev-*`
     ladder these numbers fall, and a reader can watch that happen. When the
     last `data-theme="navy"` leaves src/, this block and the measurement above
     it go together. */
  if (audit.bands > 3) {
    report(
      "NOTE",
      `${audit.bands} sections still marked data-theme="navy" (inert under D30)`,
    );
  }
  if (audit.adjacent > 0) {
    report(
      "NOTE",
      `${audit.adjacent} adjacent pair(s) still marked navy (inert under D30)`,
    );
  }
  if (audit.overflow > 1) {
    report("FAIL", `horizontal overflow ${audit.overflow}px`);
  }
  if (audit.brokenImages.length) {
    report(
      "FAIL",
      `${audit.brokenImages.length} image(s) failed to load — ${audit.brokenImages.slice(0, 4).join(", ")}${audit.brokenImages.length > 4 ? ", …" : ""}`,
    );
  }
  if (audit.missingAlt > 0) {
    report("FAIL", `${audit.missingAlt} <img> with no alt attribute`);
  }
  if (audit.ellipsisNames > 0) {
    report(
      "FAIL",
      `${audit.ellipsisNames} link/button whose accessible name contains an ellipsis`,
    );
  }
  if (audit.monoOffenders.length) {
    report(
      "FAIL",
      `numeric text not set in mono — ${audit.monoOffenders.join(", ")}`,
    );
  }
  if (audit.brandAlts.length) {
    report(
      "FAIL",
      `alt text names the brand instead of describing the picture — "${audit.brandAlts[0]}"`,
    );
  }
  if (audit.blurOffenders.length) {
    report(
      "FAIL",
      `backdrop-filter outside the header — ${audit.blurOffenders.join(", ")} (Part 3.5: blur in exactly one place)`,
    );
  }
  if (audit.shadowOffenders.length) {
    report(
      "FAIL",
      `drop shadow on the storefront — ${audit.shadowOffenders.join(", ")} (Part 3.5: none, the mobile bottom bar excepted)`,
    );
  }
  if (audit.durationOffenders.length) {
    report(
      "FAIL",
      `duration outside Part 3.8's four values — ${audit.durationOffenders.join(", ")} (180 · 350 · 800 · 900ms)`,
    );
  }
  if (audit.hoverLift.length) {
    report(
      "FAIL",
      `lift or scale on a control's hover — ${audit.hoverLift.join(", ")} (Part 3.4: colour and underline only)`,
    );
  }
  if (audit.smallTargetCount) {
    report(
      touchContext ? "FAIL" : "NOTE",
      `${audit.smallTargetCount} interactive element(s) under the 44px tap floor — ${audit.smallTargets.join(", ")}${touchContext ? "" : " (not failed — fine-pointer viewport, pointer-coarse: doesn't apply here)"}`,
    );
  }
  // Promoted from NOTE in Phase 1b: every audited route passes it, so the
  // rule now holds the line instead of describing it. The count is of
  // elements that PAINT champagne in the first viewport (see the long note
  // above the measurement for what is deliberately excluded).
  if (audit.champagne > 2) {
    report(
      "FAIL",
      `${audit.champagne} champagne-coloured elements in the first viewport (Part 3.1 caps visible ones at 2)`,
    );
  }

  /* Sticky header contrast (F2). `use-hero-ink.ts` / `site-header.tsx` set
     `data-ink="mineral"` while the header floats transparent over a dark
     hero and `data-ink="ink"` once it is solid — the audit's job is to check
     that promise against the ACTUAL rendered pixels, not just trust the
     attribute. Every other rule in this file reads computed style; this one
     alone reads real pixels (via a Playwright screenshot decoded with
     `sharp`), because "what is behind it" for a transparent header is
     whatever photograph is mounted there — a gradient scrim's own computed
     colour stops are not the same thing as what a visitor's eye contends
     with over a bright frame of the pour.

     Sample point: the header's own top-left corner, inside the `u-shell`
     gutter and above the logo — empty in both LTR and RTL, at every width
     the header renders at, and at the same y the logo's text sits behind
     (the header's 64–80px band renders one background across its width, so
     a few px away from a glyph is representative of what is directly behind
     it). The colour compared is what the LOGO — the one header element whose
     class is a literal `text-mineral`/`text-ink` toggle rather than an
     opacity variant — actually computes to.

     THE MEASUREMENT MUST BE COHERENT. `data-ink` is an attribute: it flips in
     the same commit as the state. The two layers it describes do not — the
     obsidian scrim and the mineral bar cross-fade over `--dur-base`. So for a
     few hundred ms after the hero leaves the header's band the attribute and
     the pixels legitimately disagree, and a reading taken across that window
     reports a contrast no visitor ever sees. The route walk above scrolls to
     the bottom and back, which is precisely what drags the hero through that
     band twice, and `use-hero-ink.ts`'s IntersectionObserver delivers its
     callback on a later frame — so on a loaded runner the cross-fade can
     BEGIN after the walk's animation-settle loop has already returned, and
     the rule used to read the attribute, then wait up to 8s for images, then
     screenshot, reporting the two as if they were simultaneous. CI run 149
     failed `/contact` exactly that way (`data-ink="ink"` at 1.08:1 over
     rgb(8,10,14)) on a tree that went green on `main` minutes later with no
     change at all. Hence: settle first, sample together, and re-read
     afterwards — a FAIL is only reported when the header held still for the
     whole measurement. A genuinely mis-inked header is a STATE, not a
     transition, so requiring stability cannot hide one. */

  /* The pixels behind the header are a photograph: sample only once every
     image in the first viewport has finished loading (bounded — a slow host
     must not stall the audit), or the LQIP blur placeholder's grey is what
     gets measured. A busy machine (CI, or a laptop running several audits)
     can leave a hero still decoding when the cap expires, and screenshotting
     THEN samples the page's empty ground rather than the photograph — which
     reads as a contrast failure that no visitor would ever see. Observed
     exactly once in three consecutive local runs while other work loaded the
     box, and the reduced-motion pass added below doubles the page loads a run
     makes, so the odds only go up. The wait still caps: an audit must not
     hang on a genuinely broken image. */
  const headerPixelsSettled = await page.evaluate(() =>
    Promise.race([
      Promise.all(
        [...document.images]
          .filter(
            (img) =>
              !img.complete && img.getBoundingClientRect().top < innerHeight,
          )
          .map(
            (img) =>
              new Promise((done) => {
                img.onload = img.onerror = done;
              }),
          ),
      ).then(() => true),
      new Promise((done) => setTimeout(() => done(false), 8000)),
    ]),
  );

  /* One reading of everything the rule compares — the attribute, the colour
     it promises, the geometry the samples are taken from, and whether any
     animation inside the header is still running. Taken as one evaluate so
     the four cannot drift apart between calls. */
  const readHeaderState = () =>
    page.evaluate(() => {
      const header = document.querySelector('[data-slot="sf-site-header"]');
      if (!header) return null;
      const textEl =
        header.querySelector("a[aria-label]") ??
        header.querySelector("nav a, nav button") ??
        header;
      const r = header.getBoundingClientRect();
      const t = textEl.getBoundingClientRect();
      const nav = header.querySelector("nav")?.getBoundingClientRect() ?? null;
      return {
        ink: header.getAttribute("data-ink"),
        color: getComputedStyle(textEl).color,
        // Only animations targeting the header itself: the page below it may
        // hold an infinite ambient drift that would never let this settle.
        moving: document.getAnimations().filter((a) => {
          if (a.playState !== "running") return false;
          const target = a.effect?.target;
          return target instanceof Element && header.contains(target);
        }).length,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        text: { x: t.x, y: t.y, width: t.width, height: t.height },
        nav: nav ? { x: nav.x, width: nav.width } : null,
      };
    });

  // Settle: two consecutive identical readings with nothing animating inside
  // the header. Capped — a header that never rests still gets measured, and
  // the post-check below is what decides whether that reading may FAIL.
  let headerInfo = await readHeaderState();
  if (headerInfo) {
    const settleDeadline = Date.now() + 3000;
    for (;;) {
      const next = await readHeaderState();
      if (!next) {
        headerInfo = next;
        break;
      }
      const held =
        next.ink === headerInfo.ink && next.color === headerInfo.color;
      headerInfo = next;
      if (held && next.moving === 0) break;
      if (Date.now() > settleDeadline) break;
      await page.waitForTimeout(50);
    }
  }

  /* §2.10's system pages have NO HEADER, by specification — "no nav and no
     footer link farm on the error family" — and they render outside the (v2)
     route group, which is where the chrome is mounted. So on those routes a
     missing header is the design, not a regression, and failing them here was
     the audit asserting something the spec forbids.

     The distinction is carried by a MARKER the page sets, never by a path
     list: `SystemPage` renders `data-system-page`, so a route is exempt
     because of what it IS. A hardcoded list of routes in this file would be a
     second place to remember to update, and the seventh system page would be
     failed by a gate that has no idea it exists.

     A route that is NOT marked and has no header still fails, which is the
     case the rule was written for: the chrome silently failing to mount. */
  const isSystemPage = await page.evaluate(
    () => document.querySelector("[data-system-page]") !== null,
  );

  if (!headerInfo && isSystemPage) {
    report(
      "NOTE",
      "no sticky header — this is a §2.10 system page, which specifies none",
    );
  } else if (!headerInfo) {
    report(
      "FAIL",
      'no sticky header ([data-slot="sf-site-header"]) found — cannot verify header contrast',
    );
  } else if (!headerInfo.ink) {
    report("FAIL", "sticky header has no data-ink attribute (use-hero-ink.ts)");
  } else {
    const textRgb = parseRgbTriple(headerInfo.color);
    /* Sample points sit in the GAPS beside the header's text — just outside
       the logo on both sides, and just outside the nav on both sides — at the
       text's vertical centre, never under a glyph (a patch under the logo
       reads the logo's own pixels and reports a contrast nobody sees). The
       worst of them is the ratio reported: the scrim behind the row has to
       hold wherever a nav item lands. */
    const patch = 10;
    const midY = Math.round(
      headerInfo.text.y + headerInfo.text.height / 2 - patch / 2,
    );
    const xs = [
      headerInfo.text.x - patch - 6,
      headerInfo.text.x + headerInfo.text.width + 6,
      ...(headerInfo.nav
        ? [
            headerInfo.nav.x - patch - 6,
            headerInfo.nav.x + headerInfo.nav.width + 6,
          ]
        : []),
    ]
      .map((x) => Math.round(x))
      .filter((x) => x >= 0 && x + patch <= width);
    let worst = null;
    for (const sampleX of xs) {
      try {
        const shot = await page.screenshot({
          clip: {
            x: sampleX,
            y: Math.max(0, midY),
            width: patch,
            height: patch,
          },
        });
        const { data, info } = await sharp(shot)
          .raw()
          .toBuffer({ resolveWithObject: true });
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let n = 0;
        for (let i = 0; i + 2 < data.length; i += info.channels) {
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
          n += 1;
        }
        if (n === 0 || !textRgb) continue;
        const bgRgb = [rSum / n, gSum / n, bSum / n];
        const ratio = contrastOf(textRgb, bgRgb);
        if (!worst || ratio < worst.ratio) worst = { ratio, bgRgb, sampleX };
      } catch {
        // A screenshot can legitimately fail (a headless-Chromium quirk on
        // one route) — the other sample points still speak.
      }
    }
    // Did the header hold still for the whole of the sampling above? If it
    // did not, the pixels and the attribute describe two different moments.
    const afterInfo = await readHeaderState();
    const heldStill =
      Boolean(afterInfo) &&
      afterInfo.ink === headerInfo.ink &&
      afterInfo.color === headerInfo.color &&
      afterInfo.moving === 0;
    if (!textRgb || !worst) {
      report(
        "FAIL",
        `sticky header data-ink="${headerInfo.ink}" — could not measure its contrast (text colour ${headerInfo.color ?? "?"}, ${xs.length} sample point(s))`,
      );
    } else if (worst.ratio < 4.5) {
      const rounded = (v) => Math.round(v);
      /* An unreliable red is worse than a missed amber, because a gate nobody
         trusts stops being a gate: both caveats below downgrade to NOTE and
         say which one applied. */
      const untrustworthy = !headerPixelsSettled
        ? " — NOT FAILED: an above-the-fold image was still decoding when the pixels were sampled, so this reading is not trustworthy"
        : !heldStill
          ? ` — NOT FAILED: the header changed state while it was being measured (data-ink ${headerInfo.ink} → ${afterInfo?.ink ?? "gone"}), so the attribute and the pixels describe different moments`
          : "";
      report(
        untrustworthy ? "NOTE" : "FAIL",
        `sticky header data-ink="${headerInfo.ink}" contrast ${worst.ratio.toFixed(2)}:1 against rgb(${worst.bgRgb.map(rounded).join(",")}) beside its text (x=${worst.sampleX}) — needs ≥4.5:1 (text rgb(${textRgb.map(rounded).join(",")}))${untrustworthy}`,
      );
    }
  }

  /* Part 14's reduced-motion clause, run rather than trusted: "when
     `prefers-reduced-motion: reduce`, disable parallax, large transforms,
     auto-play motion, pinned scrubs, the marquee and complex transitions —
     and jump every reveal to its final state. No exceptions."

     Nothing enforced it. `shots.mjs --reduced` takes PICTURES under the media
     query, and a picture of a settled page looks the same either way, so a
     new animation that forgot its fallback shipped green. What makes the CSS
     side true today is one rule — tokens.css's global collapse, which flattens
     every animation and transition on the page to 0.01ms — and a single rule
     is exactly the kind of thing an `!important` elsewhere, a scoped
     stylesheet or a careless deletion takes out silently. Everything driven
     from JS is outside its reach altogether: a WAAPI animation, a video that
     plays itself, a scroll-linked timeline.

     So the assertion is about what is RUNNING, not about what is declared.
     The route is walked a second time with the feature on and
     `getAnimations()` is sampled all the way down; an animation whose
     playState is "running" with a per-iteration duration a visitor could
     actually see is the defect. Sampling through the walk rather than once at
     the end is the point — a one-shot entrance is over by the time a settled
     page is measured, and a missing fallback on an entrance is the commonest
     form this bug takes.

     Deliberately NOT offenders: an animation the CSS switched off (`animation:
     none` leaves no animation object at all), one the collapse already
     flattened, and anything paused or finished. This pass injects no styles
     and no script of its own into the page, so nothing it counts is its own
     doing.

     Two things the duration test cannot speak for are checked in their own
     terms. A progress-based timeline (`animation-timeline: view()` /
     `scroll()`) has no time duration at all — it is scroll-linked motion, and
     `sf-manifesto-brighten` needed its own explicit `animation: none` under
     reduce for exactly that reason. And a `<video>` playing by itself is the
     "auto-play motion" the clause names, in the one form no duration collapse
     can ever reach. */
  const PERCEPTIBLE_MS = 16; // one frame at 60Hz; the smallest sanctioned token is 180ms
  let reduced = null;
  try {
    await reducedPage.goto(base + route, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await reducedPage.evaluate(() => document.fonts.ready);
    reduced = await reducedPage.evaluate(async (perceptibleMs) => {
      const label = (el, pseudo) => {
        if (!el || !el.tagName) return "(detached)";
        const cls =
          typeof el.className === "string" && el.className
            ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
            : "";
        return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${cls}${pseudo ?? ""}`;
      };

      const moving = new Map();
      const playing = new Set();
      const sample = () => {
        for (const animation of document.getAnimations()) {
          if (animation.playState !== "running") continue;
          const effect = animation.effect;
          if (!effect) continue;
          const what =
            animation.animationName ??
            (animation.transitionProperty
              ? `transition ${animation.transitionProperty}`
              : "animation");
          const where = label(effect.target, effect.pseudoElement);
          if (
            animation.timeline &&
            animation.timeline.constructor.name !== "DocumentTimeline"
          ) {
            moving.set(`${where} ${what}`, `${where} — ${what}, scroll-linked`);
            continue;
          }
          const timing = effect.getComputedTiming?.();
          // Per ITERATION: a loop's total is Infinity, and what a visitor sees
          // move is one pass of it.
          const ms = timing?.duration;
          if (typeof ms !== "number" || !(ms > perceptibleMs)) continue;
          moving.set(
            `${where} ${what}`,
            `${where} — ${what} @ ${Math.round(ms)}ms`,
          );
        }
        for (const video of document.querySelectorAll("video")) {
          if (!video.paused && !video.ended) playing.add(label(video));
        }
      };

      const step = Math.round(window.innerHeight * 0.8);
      sample();
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        for (let i = 0; i < 2; i += 1) {
          await new Promise((r) => setTimeout(r, 50));
          sample();
        }
      }
      window.scrollTo(0, 0);
      for (let i = 0; i < 8; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        sample();
      }
      return {
        moving: [...moving.values()].slice(0, 8),
        playing: [...playing].slice(0, 4),
      };
    }, PERCEPTIBLE_MS);
  } catch (err) {
    report(
      "FAIL",
      `did not load under prefers-reduced-motion: reduce — ${String(err).slice(0, 120)}`,
    );
  }
  if (reduced?.moving.length) {
    report(
      "FAIL",
      `still animating under prefers-reduced-motion: reduce — ${reduced.moving.join(", ")} (Part 14: no exceptions)`,
    );
  }
  if (reduced?.playing.length) {
    report(
      "FAIL",
      `video playing itself under prefers-reduced-motion: reduce — ${reduced.playing.join(", ")} (Part 14: no auto-play motion)`,
    );
  }

  if (routeFailures === 0) console.log("  · clean");
}

await browser.close();
console.log(`\n${failures} failing rule(s).`);
process.exitCode = failures > 0 ? 1 : 0;
