/**
 * Canonical occasion tags a product can be filed under. Shared by the
 * product form (toggle chips) and the upsert action (zod subset check).
 */
export const OCCASIONS = [
  "Wedding",
  "Anniversary",
  "Diwali",
  "Birthday",
  "Corporate",
  "Housewarming",
  "Baby",
] as const;

export type Occasion = (typeof OCCASIONS)[number];
