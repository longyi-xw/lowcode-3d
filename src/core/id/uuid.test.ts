import { describe, expect, it } from "vitest";
import { generateUUID, isUUID } from "./uuid";

describe("generateUUID", () => {
  it("produces a v4 UUID matching the spec format", () => {
    const id = generateUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("returns distinct ids across 256 calls", () => {
    const ids = new Set(Array.from({ length: 256 }, () => generateUUID()));
    expect(ids.size).toBe(256);
  });
});

describe("isUUID", () => {
  it("accepts a freshly generated uuid", () => {
    expect(isUUID(generateUUID())).toBe(true);
  });

  it("rejects non-uuid inputs", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
    expect(isUUID("")).toBe(false);
    expect(isUUID(null)).toBe(false);
    expect(isUUID(123)).toBe(false);
    // v1 uuid (time-based) — must be rejected since we only want v4
    expect(isUUID("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
  });
});
