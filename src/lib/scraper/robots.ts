/**
 * Minimal, polite robots.txt gate (server-only). Fetches and caches each
 * host's robots.txt for the process lifetime and answers "may we fetch this
 * path?" for the groups matching our bot or `*`. Supports `*` wildcards and
 * `$` end-anchors; longest matching rule wins, ties favour Allow. Fails OPEN
 * (allows) when robots.txt is missing or unreachable, per convention.
 */
import { SCRAPER_UA } from "@/lib/scraper/types";
import { safeFetch } from "@/lib/scraper/ssrf";

/** Our product token, for matching `User-agent:` groups. */
const BOT_TOKEN = "rivyalivingartresearchbot";

type Rule = { pattern: string; allow: boolean };

const cache = new Map<string, Rule[]>();

function origin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    return baseUrl.replace(/\/+$/, "");
  }
}

/** Parse robots.txt into the flat rule list that applies to our bot. */
function parseRobots(text: string): Rule[] {
  const lines = text.split(/\r?\n/);
  // Group state: a group is a run of User-agent lines followed by rules.
  let groupAgents: string[] = [];
  let collecting = false; // are we inside a User-agent block header?
  const applicable: Rule[] = [];
  let groupApplies = false;

  const agentApplies = (agents: string[]) =>
    agents.some(
      (a) => a === "*" || BOT_TOKEN.includes(a) || a.includes(BOT_TOKEN),
    );

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!collecting) {
        // Starting a new group header — reset accumulated agents.
        groupAgents = [];
        collecting = true;
      }
      groupAgents.push(value.toLowerCase());
      groupApplies = agentApplies(groupAgents);
      continue;
    }

    collecting = false; // any non-user-agent line ends the header
    if (!groupApplies) continue;
    if (field === "disallow") applicable.push({ pattern: value, allow: false });
    else if (field === "allow") applicable.push({ pattern: value, allow: true });
  }
  return applicable;
}

async function loadRules(baseUrl: string): Promise<Rule[]> {
  const key = origin(baseUrl);
  const cached = cache.get(key);
  if (cached) return cached;

  let rules: Rule[] = [];
  try {
    const res = await safeFetch(`${key}/robots.txt`, {
      headers: { "User-Agent": SCRAPER_UA, Accept: "text/plain" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) rules = parseRobots(await res.text());
  } catch {
    // Unreachable robots.txt → fail open.
  }
  cache.set(key, rules);
  return rules;
}

/** Convert a robots pattern (`*` wildcard, `$` end-anchor) into a RegExp. */
function toRegExp(pattern: string): RegExp {
  let re = "^";
  for (const ch of pattern) {
    if (ch === "*") re += ".*";
    else if (ch === "$") re += "$";
    else re += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(re);
}

/**
 * True when our bot may fetch `path` on this host. Empty/absent rules → true.
 * `Disallow:` with an empty value explicitly allows everything.
 */
export async function isPathAllowed(
  baseUrl: string,
  path: string,
): Promise<boolean> {
  const rules = await loadRules(baseUrl);
  if (rules.length === 0) return true;

  let best: { len: number; allow: boolean } | null = null;
  for (const rule of rules) {
    if (rule.pattern === "") {
      // "Disallow:" (empty) = allow all; "Allow:" (empty) is ignored.
      if (!rule.allow && (best === null || best.len === 0)) {
        best = { len: 0, allow: true };
      }
      continue;
    }
    if (!toRegExp(rule.pattern).test(path)) continue;
    const len = rule.pattern.length;
    // Longest match wins; on a tie, Allow beats Disallow.
    if (!best || len > best.len || (len === best.len && rule.allow)) {
      best = { len, allow: rule.allow };
    }
  }
  return best ? best.allow : true;
}
