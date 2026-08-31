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
 * The champagne count is the one finding that does NOT fail. It is a design
 * review rather than a test — the selector cannot tell a hairline from a
 * headline — so it prints as a note and a human decides.
 */
import { launchChromium } from "./lib/browser.mjs";

const [routesArg, ...rest] = process.argv.slice(2);
if (!routesArg) {
  console.error('usage: redesign-audit.mjs "/en,/en/shop" [--w 1440]');
  process.exit(1);
}
const widthIndex = rest.indexOf("--w");
const width = widthIndex === -1 ? 1440 : Number(rest[widthIndex + 1]);
const base = process.env.BASE_URL ?? "http://localhost:3000";

const browser = await launchChromium();
const context = await browser.newContext({
  viewport: { width, height: width < 700 ? 844 : 900 },
});
const page = await context.newPage();

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

  const audit = await page.evaluate(() => {
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
        skipped.push(`${headings[i - 1].level}→${headings[i].level}: "${headings[i].text}"`);
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
    const sections = [...main.querySelectorAll("section, div")].filter((el) =>
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
    const NUMERIC = /^[₹$€£]?\s*[\d][\d\s.,:/–—-]*(?:%|h|hrs?|days?|weeks?|px|mm|cm|in|g|kg)?$/i;
    const monoNumbers = { total: 0, offenders: [] };
    for (const el of main.querySelectorAll(
      "span,p,dd,dt,td,th,li,strong,em,b,time",
    )) {
      if (el.children.length > 0) continue;
      const text = (el.textContent ?? "").trim();
      if (text.length === 0 || text.length > 24 || !NUMERIC.test(text)) continue;
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

       `--champagne-ink` (#75602f) is deliberately NOT counted: it is the AA
       companion that exists so champagne-coloured TEXT is legible, and §3.1
       is a rule about the accent's visual weight, not about that fallback. */
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
      getComputedStyle(document.documentElement).getPropertyValue("--champagne"),
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
      for (let node = el; node && node !== document; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.visibility !== "visible" || Number(cs.opacity) === 0) {
          return false;
        }
      }
      return true;
    };

    /* The cure rail is out of scope, for the same reason `--champagne-ink`
       is. §3.1 governs the ACCENT'S visual weight; the rail is navigation,
       1px wide, living in a 56px gutter, and it goes champagne on a dark band
       only because sapphire is invisible there. Counting it made the rule
       fire on hero HEIGHT — whether the rail's first tick happens to land
       above the fold — rather than on how much gold is on the page. */
    const cureRail = main.querySelector('[data-slot="cure-line"]');

    const inFirstViewport = !champagne
      ? 0
      : [...main.querySelectorAll("*")].filter((el) => {
          if (cureRail?.contains(el)) return false;
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
          const cs = getComputedStyle(el);
          if (
            triple(cs.backgroundColor) === champagne ||
            triple(cs.borderTopColor) === champagne
          ) {
            return true;
          }
          return triple(cs.color) === champagne && paintsOwnText(el);
        }).length;

    return {
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
  });

  if (audit.h1Count !== 1) {
    report("FAIL", `${audit.h1Count} <h1> (must be exactly 1): ${audit.h1Text.join(" | ")}`);
  }
  if (audit.skipped.length) {
    report("FAIL", `skipped heading levels — ${audit.skipped.join("; ")}`);
  }
  if (audit.duplicated.length) {
    report("FAIL", `duplicated heading text — ${[...new Set(audit.duplicated)].join("; ")}`);
  }
  if (audit.majors > 2) {
    report("FAIL", `${audit.majors} section-major (max 2)`);
  }
  if (audit.bands > 3) {
    report("FAIL", `${audit.bands} dark bands (max 3)`);
  }
  if (audit.adjacent > 0) {
    report("FAIL", `${audit.adjacent} pair(s) of adjacent dark bands`);
  }
  if (audit.darkRunIntoFooter) {
    report("FAIL", "the page's last band is dark and runs straight into the obsidian footer");
  }
  if (audit.overflow > 1) {
    report("FAIL", `horizontal overflow ${audit.overflow}px`);
  }
  if (audit.missingAlt > 0) {
    report("FAIL", `${audit.missingAlt} <img> with no alt attribute`);
  }
  if (audit.ellipsisNames > 0) {
    report("FAIL", `${audit.ellipsisNames} link/button whose accessible name contains an ellipsis`);
  }
  if (audit.monoOffenders.length) {
    report("FAIL", `numeric text not set in mono — ${audit.monoOffenders.join(", ")}`);
  }
  if (audit.brandAlts.length) {
    report("FAIL", `alt text names the brand instead of describing the picture — "${audit.brandAlts[0]}"`);
  }
  // Advisory only — the selector cannot tell a hairline from a headline.
  if (audit.champagne > 2) {
    report("NOTE", `${audit.champagne} champagne-coloured elements in the first viewport (spec caps visible ones at 2 — review by eye)`);
  }
  if (routeFailures === 0) console.log("  · clean");
}

await browser.close();
console.log(`\n${failures} failing rule(s).`);
process.exitCode = failures > 0 ? 1 : 0;
