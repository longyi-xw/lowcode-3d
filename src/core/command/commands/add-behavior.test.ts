import { describe, expect, it } from "vitest";

import type { BehaviorBinding } from "@/core/scene/types";

import { ADD_BEHAVIOR, AddBehaviorCommand } from "./add-behavior";
import { makeFakeEditor } from "./_test-utils";

describe("AddBehaviorCommand", () => {
  const binding: BehaviorBinding = {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
  };

  it("apply calls addBehavior", () => {
    const editor = makeFakeEditor();
    const cmd = new AddBehaviorCommand({ node_id: "n1", binding });
    cmd.apply(editor);
    expect(editor.calls).toEqual([{ op: "addBehavior", nodeId: "n1", binding }]);
  });

  it("revert calls removeBehavior", () => {
    const editor = makeFakeEditor();
    const cmd = new AddBehaviorCommand({ node_id: "n1", binding });
    cmd.revert(editor);
    expect(editor.calls).toEqual([
      { op: "removeBehavior", nodeId: "n1", bindingId: "b1" },
    ]);
  });

  it("type === ADD_BEHAVIOR", () => {
    expect(new AddBehaviorCommand({ node_id: "n1", binding }).type).toBe(ADD_BEHAVIOR);
  });

  it("does not merge with any other command", () => {
    const a = new AddBehaviorCommand({ node_id: "n1", binding });
    const b = new AddBehaviorCommand({ node_id: "n1", binding });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
