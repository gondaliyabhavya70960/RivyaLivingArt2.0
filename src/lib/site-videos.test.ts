import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BUNDLED_VIDEOS, BUNDLED_VIDEO_FILES } from "./site-videos";

const publicPath = (url: string) => join(process.cwd(), "public", url);

describe("the bundled video defaults", () => {
  it("ships every file each loop implies — mp4, webm twin and poster", () => {
    // The gap this closes: nothing asserted a WebM twin was on disk, and the
    // failure is silent in the worst way — the browser skips a source it
    // cannot fetch and quietly downloads the heavier MP4 instead. Same class
    // of miss as the eleven slot fallbacks that pointed at absent files.
    for (const file of BUNDLED_VIDEO_FILES) {
      expect(existsSync(publicPath(file)), `public${file}`).toBe(true);
    }
  });

  it("keeps every loop under REDESIGN.md §15.4's 2.5 MB ceiling", async () => {
    // The delivered files were 4.1 and 4.3 MB. This is the check that would
    // have caught that, and the one that catches a future re-encode drifting
    // back over it.
    const { statSync } = await import("node:fs");
    const CEILING = 2.5 * 1024 * 1024;
    for (const file of BUNDLED_VIDEO_FILES.filter((f) => /\.(mp4|webm)$/.test(f))) {
      expect(statSync(publicPath(file)).size, `public${file}`).toBeLessThan(
        CEILING,
      );
    }
  });

  it("writes moov before mdat, so preload=metadata costs one range request", async () => {
    // §15.4 requires `preload="metadata"`. Without faststart the moov atom
    // sits after the media data, and a browser asking only for the duration
    // has to reach the END of a 2 MB file to find it. The delivered files were
    // [ftyp, uuid, free, mdat …]; these must be [ftyp, moov, …].
    const { readFileSync } = await import("node:fs");
    for (const url of Object.values(BUNDLED_VIDEOS)) {
      const head = readFileSync(publicPath(url)).subarray(0, 4096);
      const ftypSize = head.readUInt32BE(0);
      expect(head.subarray(4, 8).toString("latin1"), url).toBe("ftyp");
      expect(head.subarray(ftypSize + 4, ftypSize + 8).toString("latin1"), url).toBe(
        "moov",
      );
    }
  });
});
