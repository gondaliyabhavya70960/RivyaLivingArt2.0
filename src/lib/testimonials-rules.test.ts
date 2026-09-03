import { describe, expect, it } from "vitest";

import {
  describeTestimonialProblem,
  type PermissionStatusValue,
  type TestimonialStatusValue,
} from "./testimonials-rules";

const STATUSES: TestimonialStatusValue[] = [
  "DRAFT",
  "PENDING_REVIEW",
  "VERIFIED",
  "PUBLISHED",
  "ARCHIVED",
];

const PERMISSIONS: PermissionStatusValue[] = [
  "UNKNOWN",
  "REQUESTED",
  "GRANTED",
  "DECLINED",
];

const base = { name: "Priya Sharma", quote: "The frame is perfect." };

describe("describeTestimonialProblem", () => {
  it("refuses an empty name before anything else", () => {
    expect(
      describeTestimonialProblem({
        ...base,
        name: "  ",
        status: "PUBLISHED",
        permissionStatus: "GRANTED",
      }),
    ).toBe("Name is required.");
  });

  it("refuses an empty quote", () => {
    expect(
      describeTestimonialProblem({
        ...base,
        quote: "",
        status: "DRAFT",
        permissionStatus: "UNKNOWN",
      }),
    ).toBe("Quote is required.");
  });

  it("names the quote before permission when both are wrong", () => {
    expect(
      describeTestimonialProblem({
        name: "Priya",
        quote: "   ",
        status: "PUBLISHED",
        permissionStatus: "UNKNOWN",
      }),
    ).toBe("Quote is required.");
  });

  // The full status × permission matrix: PUBLISHED refuses everything but
  // GRANTED; every other status is untouched by the permission column.
  for (const status of STATUSES) {
    for (const permissionStatus of PERMISSIONS) {
      const label = `${status} × ${permissionStatus}`;
      it(`${label}`, () => {
        const result = describeTestimonialProblem({
          ...base,
          status,
          permissionStatus,
        });
        if (status === "PUBLISHED" && permissionStatus !== "GRANTED") {
          expect(result).toMatch(/permission/i);
        } else {
          expect(result).toBeNull();
        }
      });
    }
  }
});
