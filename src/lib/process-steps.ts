/**
 * The ten steps of the studio's process, as data.
 *
 * The owner confirmed the sequence (2026-09-03): Concept · Material
 * selection · Wood preparation · Resin composition · Casting · Curing ·
 * Surface refinement · Hand finishing · Quality inspection · Delivery — the
 * last is delivery only; the studio offers no installation service. The
 * words live in `Process.timeline.step<n>*` (nine locales) and the pictures
 * in the `process.step<n>` image slots; this constant is what the process
 * page, the image registry and the demo fixtures agree on, so the count is
 * written once.
 *
 * Plain module, no server imports.
 */
export const PROCESS_STEPS = [
  { key: "step1", image: "process.step1" },
  { key: "step2", image: "process.step2" },
  { key: "step3", image: "process.step3" },
  { key: "step4", image: "process.step4" },
  { key: "step5", image: "process.step5" },
  { key: "step6", image: "process.step6" },
  { key: "step7", image: "process.step7" },
  { key: "step8", image: "process.step8" },
  { key: "step9", image: "process.step9" },
  { key: "step10", image: "process.step10" },
] as const;

export type ProcessStepKey = (typeof PROCESS_STEPS)[number]["key"];

export const PROCESS_STEP_COUNT = PROCESS_STEPS.length;
