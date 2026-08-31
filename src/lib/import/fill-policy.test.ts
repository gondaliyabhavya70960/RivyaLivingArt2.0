import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILL_POLICY,
  decideFillRun,
  decideFillWrite,
  type FillPolicy,
} from "@/lib/import/fill-policy";

const OFF: FillPolicy = { enabled: false, onDeploy: true, maxCreates: null };
const NO_DEPLOY: FillPolicy = { enabled: true, onDeploy: false, maxCreates: null };

describe("decideFillRun", () => {
  it("fills on deploy by default — a fresh environment self-populates", () => {
    // This is the behaviour the importer has always had, and the reason it
    // lives in bootstrap. The defaults must not quietly change it.
    expect(decideFillRun("DEPLOY", DEFAULT_FILL_POLICY)).toEqual({ run: true });
  });

  it("stops every trigger when the master switch is off", () => {
    expect(decideFillRun("DEPLOY", OFF).run).toBe(false);
    expect(decideFillRun("MANUAL", OFF).run).toBe(false);
  });

  it("stops only the deploy trigger when deploy-fill is off", () => {
    expect(decideFillRun("DEPLOY", NO_DEPLOY).run).toBe(false);
    expect(decideFillRun("MANUAL", NO_DEPLOY)).toEqual({ run: true });
  });

  it("always allows a preview, even switched off", () => {
    // A preview writes nothing. Refusing to show what WOULD happen is how a
    // switch becomes something nobody dares touch.
    expect(decideFillRun("PREVIEW", OFF)).toEqual({ run: true });
    expect(decideFillRun("PREVIEW", NO_DEPLOY)).toEqual({ run: true });
  });

  it("explains itself when it refuses", () => {
    const d = decideFillRun("DEPLOY", OFF);
    expect(d.run).toBe(false);
    if (!d.run) expect(d.reason).toMatch(/switched off/i);
  });
});

describe("decideFillWrite", () => {
  it("writes anything when no cap is set — today's behaviour", () => {
    expect(decideFillWrite(9999, DEFAULT_FILL_POLICY)).toEqual({ run: true });
  });

  it("writes when the planned creates are under the cap", () => {
    expect(
      decideFillWrite(24, { ...DEFAULT_FILL_POLICY, maxCreates: 25 }),
    ).toEqual({ run: true });
  });

  it("writes when planned creates exactly equal the cap", () => {
    // "Over the limit" means over, not at. An off-by-one here refuses a run
    // the owner explicitly sized.
    expect(
      decideFillWrite(25, { ...DEFAULT_FILL_POLICY, maxCreates: 25 }),
    ).toEqual({ run: true });
  });

  it("refuses the whole run when the cap is exceeded", () => {
    const d = decideFillWrite(400, { ...DEFAULT_FILL_POLICY, maxCreates: 25 });
    expect(d.run).toBe(false);
    if (!d.run) {
      expect(d.reason).toContain("400");
      expect(d.reason).toContain("25");
      // It must say nothing was written — a partial import is the thing an
      // operator most needs ruled out.
      expect(d.reason).toMatch(/nothing was written/i);
    }
  });

  it("a cap of zero blocks any create at all", () => {
    expect(decideFillWrite(1, { ...DEFAULT_FILL_POLICY, maxCreates: 0 }).run).toBe(
      false,
    );
    expect(decideFillWrite(0, { ...DEFAULT_FILL_POLICY, maxCreates: 0 })).toEqual({
      run: true,
    });
  });
});
