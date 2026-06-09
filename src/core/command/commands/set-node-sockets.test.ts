import { describe, expect, it } from "vitest";

import type { Socket } from "@/core/scene/types";

import { SetNodeSocketsCommand } from "./set-node-sockets";
import type { SceneEditorStore } from "../types";

function stubStore() {
  const calls: { id: string; sockets: Socket[] }[] = [];
  const store = {
    setNodeSockets: (id: string, sockets: Socket[]) => calls.push({ id, sockets }),
  } as unknown as SceneEditorStore;
  return { store, calls };
}

const A: Socket[] = [{ id: "s1", name: "top", position: [0, 1, 0], tag: "stud" }];
const B: Socket[] = [];

describe("SetNodeSocketsCommand", () => {
  it("apply sets sockets, revert restores prev", () => {
    const { store, calls } = stubStore();
    const cmd = new SetNodeSocketsCommand({
      node_id: "n1",
      sockets: A,
      prev_sockets: B,
    });
    cmd.apply(store);
    cmd.revert(store);
    expect(calls).toEqual([
      { id: "n1", sockets: A },
      { id: "n1", sockets: B },
    ]);
  });

  it("merges consecutive edits on the same node into one undo entry", () => {
    const first = new SetNodeSocketsCommand({
      node_id: "n1",
      sockets: A,
      prev_sockets: B,
      timestamp: 1000,
    });
    const second = new SetNodeSocketsCommand({
      node_id: "n1",
      sockets: B,
      prev_sockets: A,
      timestamp: 1200,
    });
    expect(first.canMergeWith(second)).toBe(true);
    const merged = first.mergeWith(second);
    expect(merged.id).toBe(first.id);
    expect((merged.payload as { sockets: Socket[] }).sockets).toEqual(B);
    expect((merged.payload as { prev_sockets: Socket[] }).prev_sockets).toEqual(B);
  });

  it("does not merge across different nodes", () => {
    const a = new SetNodeSocketsCommand({
      node_id: "n1",
      sockets: A,
      prev_sockets: B,
      timestamp: 1000,
    });
    const b = new SetNodeSocketsCommand({
      node_id: "n2",
      sockets: A,
      prev_sockets: B,
      timestamp: 1100,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
