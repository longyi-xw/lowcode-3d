import { describe, expect, it } from "vitest";

import type { BehaviorBinding } from "@/core/scene/types";

import { REMOVE_BEHAVIOR, RemoveBehaviorCommand } from "./remove-behavior";
import { makeFakeEditor } from "./_test-utils";

const binding: BehaviorBinding = {
  id: "b1",
  behavior_type: "auto-rotate",
  enabled: true,
  parameters: { axis: "y", speed: 30 },
};

describe("RemoveBehaviorCommand", () => {
  it("apply calls removeBehavior", () => {
    const editor = makeFakeEditor();
    new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "removeBehavior", nodeId: "n1", bindingId: "b1" },
    ]);
  });

  it("revert re-adds the full binding (restores enabled + parameters)", () => {
    const editor = makeFakeEditor();
    new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).revert(editor);
    expect(editor.calls).toEqual([{ op: "addBehavior", nodeId: "n1", binding }]);
  });

  it("type === REMOVE_BEHAVIOR", () => {
    expect(
      new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding }).type,
    ).toBe(REMOVE_BEHAVIOR);
  });

  it("never merges", () => {
    const a = new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding });
    const b = new RemoveBehaviorCommand({ node_id: "n1", prev_binding: binding });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
