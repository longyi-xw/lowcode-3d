import { beforeEach, describe, expect, it } from "vitest";

import type { Command, SceneEditorStore } from "@/core/command/types";
import type { SceneNode, Transform } from "@/core/scene/types";
import { SetNodeTransformCommand } from "@/core/command/commands/set-node-transform";
import { useCommandHistoryStore } from "./store";

const IDENTITY: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

function makeNode(id: string, transform: Transform = IDENTITY): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
  };
}

function makeEditor(initial: SceneNode): SceneEditorStore {
  const map = new Map<string, SceneNode>([[initial.id, initial]]);
  return {
    getNode: (id) => map.get(id),
    setNodeTransform: (id, transform) => {
      const n = map.get(id);
      if (n) map.set(id, { ...n, transform });
    },
    addBehavior: () => {
      throw new Error("addBehavior not implemented in this fake");
    },
    removeBehavior: () => {
      throw new Error("removeBehavior not implemented in this fake");
    },
    setBehaviorEnabled: () => {
      throw new Error("setBehaviorEnabled not implemented in this fake");
    },
    setBehaviorParameters: () => {
      throw new Error("setBehaviorParameters not implemented in this fake");
    },
  };
}

function resetStore() {
  useCommandHistoryStore.setState({ undoStack: [], redoStack: [] });
}

describe("useCommandHistoryStore.execute", () => {
  beforeEach(resetStore);

  it("applies the command and pushes it onto the undo stack", () => {
    const editor = makeEditor(makeNode("n1"));
    const target: Transform = { ...IDENTITY, position: [1, 2, 3] };
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: target,
      prev_transform: IDENTITY,
    });

    useCommandHistoryStore.getState().execute(cmd, editor);

    expect(editor.getNode("n1")?.transform).toEqual(target);
    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(1);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("merges with the top entry when canMergeWith returns true", () => {
    const editor = makeEditor(makeNode("n1"));
    const t0 = IDENTITY;
    const t1: Transform = { ...IDENTITY, position: [1, 0, 0] };
    const t2: Transform = { ...IDENTITY, position: [2, 0, 0] };
    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: t0,
      timestamp: 0,
    });
    const c2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t2,
      prev_transform: t1,
      timestamp: 100, // within MERGE_WINDOW_MS
    });

    useCommandHistoryStore.getState().execute(c1, editor);
    useCommandHistoryStore.getState().execute(c2, editor);

    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(1);
    expect(editor.getNode("n1")?.transform).toEqual(t2);
  });

  it("clears the redo stack on a fresh execute", () => {
    const editor = makeEditor(makeNode("n1"));
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: { ...IDENTITY, position: [1, 0, 0] },
      prev_transform: IDENTITY,
    });

    useCommandHistoryStore.getState().execute(cmd, editor);
    useCommandHistoryStore.getState().undo(editor);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(1);

    const cmd2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: { ...IDENTITY, position: [9, 0, 0] },
      prev_transform: IDENTITY,
    });
    useCommandHistoryStore.getState().execute(cmd2, editor);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(0);
  });
});

describe("useCommandHistoryStore undo / redo", () => {
  beforeEach(resetStore);

  it("undo reverts state and moves the command to the redo stack", () => {
    const editor = makeEditor(makeNode("n1"));
    const target: Transform = { ...IDENTITY, position: [5, 0, 0] };
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: target,
      prev_transform: IDENTITY,
    });

    useCommandHistoryStore.getState().execute(cmd, editor);
    useCommandHistoryStore.getState().undo(editor);

    expect(editor.getNode("n1")?.transform).toEqual(IDENTITY);
    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(0);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(1);
  });

  it("redo re-applies the last undone command", () => {
    const editor = makeEditor(makeNode("n1"));
    const target: Transform = { ...IDENTITY, position: [5, 0, 0] };
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: target,
      prev_transform: IDENTITY,
    });

    useCommandHistoryStore.getState().execute(cmd, editor);
    useCommandHistoryStore.getState().undo(editor);
    useCommandHistoryStore.getState().redo(editor);

    expect(editor.getNode("n1")?.transform).toEqual(target);
    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(1);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("undo on empty stack is a no-op", () => {
    const editor = makeEditor(makeNode("n1"));
    useCommandHistoryStore.getState().undo(editor);
    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(0);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("redo on empty stack is a no-op", () => {
    const editor = makeEditor(makeNode("n1"));
    useCommandHistoryStore.getState().redo(editor);
    expect(useCommandHistoryStore.getState().redoStack).toHaveLength(0);
  });

  it("multiple undo/redo cycles stay consistent", () => {
    const editor = makeEditor(makeNode("n1"));
    const t1: Transform = { ...IDENTITY, position: [1, 0, 0] };
    const t2: Transform = { ...IDENTITY, position: [2, 0, 0] };

    const c1 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t1,
      prev_transform: IDENTITY,
      timestamp: 0,
    });
    // Outside merge window so c1 + c2 stay distinct.
    const c2 = new SetNodeTransformCommand({
      node_id: "n1",
      transform: t2,
      prev_transform: t1,
      timestamp: 10_000,
    });
    useCommandHistoryStore.getState().execute(c1, editor);
    useCommandHistoryStore.getState().execute(c2, editor);
    expect(editor.getNode("n1")?.transform).toEqual(t2);

    useCommandHistoryStore.getState().undo(editor);
    expect(editor.getNode("n1")?.transform).toEqual(t1);
    useCommandHistoryStore.getState().undo(editor);
    expect(editor.getNode("n1")?.transform).toEqual(IDENTITY);

    useCommandHistoryStore.getState().redo(editor);
    expect(editor.getNode("n1")?.transform).toEqual(t1);
    useCommandHistoryStore.getState().redo(editor);
    expect(editor.getNode("n1")?.transform).toEqual(t2);
  });
});

describe("useCommandHistoryStore stack cap", () => {
  beforeEach(resetStore);

  it("caps the undo stack at 200 entries", () => {
    const editor = makeEditor(makeNode("n1"));
    // Use distinct node ids so merging doesn't collapse them.
    for (let i = 0; i < 250; i++) {
      const cmd: Command = {
        id: `c${i}`,
        type: `t-${i}`,
        timestamp: i,
        payload: {},
        apply: () => {},
        revert: () => {},
        canMergeWith: () => false,
        mergeWith() {
          return this;
        },
      };
      useCommandHistoryStore.getState().execute(cmd, editor);
    }
    expect(useCommandHistoryStore.getState().undoStack).toHaveLength(200);
  });
});

describe("useCommandHistoryStore.clear", () => {
  beforeEach(resetStore);

  it("drops both stacks", () => {
    const editor = makeEditor(makeNode("n1"));
    const cmd = new SetNodeTransformCommand({
      node_id: "n1",
      transform: { ...IDENTITY, position: [1, 0, 0] },
      prev_transform: IDENTITY,
    });
    useCommandHistoryStore.getState().execute(cmd, editor);
    useCommandHistoryStore.getState().undo(editor);

    useCommandHistoryStore.getState().clear();

    expect(useCommandHistoryStore.getState().undoStack).toEqual([]);
    expect(useCommandHistoryStore.getState().redoStack).toEqual([]);
  });
});
