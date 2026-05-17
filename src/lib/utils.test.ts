import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names with spaces", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("dedupes conflicting tailwind utilities, keeping the last one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("foo", false, null, undefined, "", "bar")).toBe("foo bar");
  });

  it("flattens nested arrays of class values", () => {
    expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
  });
});
