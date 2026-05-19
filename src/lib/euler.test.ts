import { describe, expect, it } from "vitest";

import { eulerDegToQuat, quatToEulerDeg } from "./euler";

function expectClose(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i] ?? 0).toBeCloseTo(expected[i] ?? 0, 4);
  }
}

describe("eulerDegToQuat", () => {
  it("returns identity quaternion for zero rotation", () => {
    expectClose(eulerDegToQuat([0, 0, 0]), [0, 0, 0, 1]);
  });

  it("90deg around Y matches three.js XYZ-order quaternion", () => {
    const sqrt2 = Math.sqrt(2) / 2;
    expectClose(eulerDegToQuat([0, 90, 0]), [0, sqrt2, 0, sqrt2]);
  });

  it("90deg around X", () => {
    const sqrt2 = Math.sqrt(2) / 2;
    expectClose(eulerDegToQuat([90, 0, 0]), [sqrt2, 0, 0, sqrt2]);
  });

  it("90deg around Z", () => {
    const sqrt2 = Math.sqrt(2) / 2;
    expectClose(eulerDegToQuat([0, 0, 90]), [0, 0, sqrt2, sqrt2]);
  });

  it("180deg around Y", () => {
    expectClose(eulerDegToQuat([0, 180, 0]), [0, 1, 0, 0]);
  });
});

describe("quatToEulerDeg", () => {
  it("returns zeros for identity quaternion", () => {
    expectClose(quatToEulerDeg([0, 0, 0, 1]), [0, 0, 0]);
  });

  it("recovers 45deg Y from its quaternion", () => {
    const q = eulerDegToQuat([0, 45, 0]);
    expectClose(quatToEulerDeg(q), [0, 45, 0]);
  });

  it("round-trips a compound rotation within epsilon", () => {
    const input: [number, number, number] = [30, 60, 15];
    const q = eulerDegToQuat(input);
    const back = quatToEulerDeg(q);
    expect(back[0]).toBeCloseTo(input[0], 4);
    expect(back[1]).toBeCloseTo(input[1], 4);
    expect(back[2]).toBeCloseTo(input[2], 4);
  });

  it("round-trip stays stable across multiple iterations", () => {
    let current: [number, number, number] = [12.5, -47.25, 89.9];
    for (let i = 0; i < 5; i++) {
      const q = eulerDegToQuat(current);
      const next = quatToEulerDeg(q);
      current = [next[0], next[1], next[2]];
    }
    expect(current[0]).toBeCloseTo(12.5, 3);
    expect(current[1]).toBeCloseTo(-47.25, 3);
    expect(current[2]).toBeCloseTo(89.9, 3);
  });
});
