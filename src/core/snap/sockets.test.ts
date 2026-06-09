import { describe, expect, it } from "vitest";

import { snapToSockets, type SocketPoint } from "./sockets";

const P = (
  screen: [number, number],
  world: [number, number, number],
  tag: string,
): SocketPoint => ({ screen, world, tag });

describe("snapToSockets", () => {
  it("aligns a dragged socket to a same-tag target within the pixel threshold", () => {
    const offset = snapToSockets(
      [P([100, 100], [0, 0, 0], "stud")],
      [P([105, 100], [2, 0, 0], "stud")],
      12,
    );
    expect(offset).toEqual([2, 0, 0]);
  });

  it("ignores targets with a different tag", () => {
    expect(
      snapToSockets(
        [P([100, 100], [0, 0, 0], "stud")],
        [P([101, 100], [2, 0, 0], "pipe")],
        12,
      ),
    ).toBeNull();
  });

  it("ignores empty-tag sockets", () => {
    expect(
      snapToSockets([P([100, 100], [0, 0, 0], "")], [P([101, 100], [2, 0, 0], "")], 12),
    ).toBeNull();
  });

  it("returns null when no pair is within the pixel threshold", () => {
    expect(
      snapToSockets(
        [P([100, 100], [0, 0, 0], "stud")],
        [P([200, 200], [2, 0, 0], "stud")],
        12,
      ),
    ).toBeNull();
  });

  it("among same-tag in-threshold pairs, picks the world-nearest", () => {
    const offset = snapToSockets(
      [P([100, 100], [0, 0, 0], "stud")],
      [P([104, 100], [5, 0, 0], "stud"), P([108, 100], [1, 0, 0], "stud")],
      12,
    );
    expect(offset).toEqual([1, 0, 0]);
  });

  it("returns null for empty targets", () => {
    expect(snapToSockets([P([100, 100], [0, 0, 0], "stud")], [], 12)).toBeNull();
  });
});
