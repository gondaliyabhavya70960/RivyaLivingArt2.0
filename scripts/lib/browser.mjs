import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Finding a Chromium the audit scripts can drive.
 *
 * Three environments, three answers, and they disagree:
 *
 *  - the dev sandbox pre-installs one at a fixed path and sets
 *    `PLAYWRIGHT_BROWSERS_PATH`, but at an older revision than the pinned
 *    `playwright-core` expects — so its own `executablePath()` points at a
 *    directory that does not exist;
 *  - CI installs the matching revision into the default cache, where
 *    `executablePath()` is exactly right;
 *  - a developer's machine may have neither, and deserves playwright's own
 *    error message rather than one of ours.
 *
 * So: an explicit override wins, then any path that actually exists, and
 * failing both we hand the decision back to playwright.
 */

/** The sandbox's pre-installed build. Checked for existence, never assumed. */
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export function resolveChromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync(SANDBOX_CHROMIUM)) return SANDBOX_CHROMIUM;
  try {
    const registered = chromium.executablePath();
    if (registered && existsSync(registered)) return registered;
  } catch {
    // playwright-core has no registry entry — fall through.
  }
  return undefined;
}

/**
 * Launch Chromium for a script that runs both in a container and on CI.
 *
 * `--no-sandbox` because both run as root in a container, where Chromium's
 * own sandbox cannot start.
 */
export async function launchChromium(extra = {}) {
  const executablePath = resolveChromiumPath();
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...extra,
  });
}
