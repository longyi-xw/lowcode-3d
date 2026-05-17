import { describe, expect, it } from "vitest";
import { contentHash, isContentHash } from "./content-hash";

// Reference vector: SHA-256("hello") — widely documented; if this fails
// we have a platform / encoding bug, not a hashing one.
const SHA256_HELLO =
  "sha256-2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

describe("contentHash", () => {
  it("matches the published SHA-256 of 'hello'", async () => {
    expect(await contentHash("hello")).toBe(SHA256_HELLO);
  });

  it("is deterministic for the same input", async () => {
    const a = await contentHash("lorem ipsum dolor sit amet");
    const b = await contentHash("lorem ipsum dolor sit amet");
    expect(a).toBe(b);
  });

  it("differs for differing inputs", async () => {
    expect(await contentHash("a")).not.toBe(await contentHash("b"));
  });

  it("accepts a Uint8Array containing the bytes for 'hello'", async () => {
    const bytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(await contentHash(bytes)).toBe(SHA256_HELLO);
  });

  it("accepts an ArrayBuffer", async () => {
    const buf = new TextEncoder().encode("hello").buffer as ArrayBuffer;
    expect(await contentHash(buf)).toBe(SHA256_HELLO);
  });

  it("always returns 71 characters total (prefix + 64 hex)", async () => {
    const h = await contentHash("anything");
    expect(h.length).toBe("sha256-".length + 64);
  });
});

describe("isContentHash", () => {
  it("accepts a real hash", async () => {
    const h = await contentHash("test");
    expect(isContentHash(h)).toBe(true);
  });

  it("rejects mismatched algorithm prefix", () => {
    expect(
      isContentHash(
        "md5-2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      ),
    ).toBe(false);
  });

  it("rejects wrong-length hex", () => {
    expect(isContentHash("sha256-deadbeef")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isContentHash(null)).toBe(false);
    expect(isContentHash(undefined)).toBe(false);
    expect(isContentHash(123)).toBe(false);
    expect(isContentHash({})).toBe(false);
  });
});
