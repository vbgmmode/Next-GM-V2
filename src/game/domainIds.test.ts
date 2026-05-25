import { describe, expect, it } from "vitest";
import { createStableDomainId, createUniqueDomainId, normalizeOptionalId } from "./domainIds";

describe("domain ID helpers", () => {
  it("normalizes stable IDs from domain parts", () => {
    expect(createStableDomainId("Title Assigned", [1, "Week 4", "World Championship"])).toBe("title-assigned-1-week-4-world-championship");
  });

  it("returns unique IDs without changing the base when it is unused", () => {
    expect(createUniqueDomainId("segment", [1, 2, "Match"], ["segment-1-2-promo"])).toBe("segment-1-2-match");
  });

  it("adds a numeric suffix when the base ID already exists", () => {
    expect(createUniqueDomainId("segment", [1, 2, "Match"], ["segment-1-2-match", "segment-1-2-match-2"])).toBe("segment-1-2-match-3");
  });

  it("normalizes optional IDs without inventing missing IDs", () => {
    expect(normalizeOptionalId(" existing-id ")).toBe("existing-id");
    expect(normalizeOptionalId("   ")).toBeUndefined();
  });
});
