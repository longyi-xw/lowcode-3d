import { describe, expect, it } from "vitest";

import {
  SET_BEHAVIOR_ENABLED,
  SetBehaviorEnabledCommand,
} from "./set-behavior-enabled";
import { makeFakeEditor } from "./_test-utils";

describe("SetBehaviorEnabledCommand", () => {
  it("apply sets enabled to the new value", () => {
    const editor = makeFakeEditor();
    new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "setBehaviorEnabled", nodeId: "n1", bindingId: "b1", enabled: false },
    ]);
  });

  it("revert restores prev_enabled", () => {
    const editor = makeFakeEditor();
    new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    }).revert(editor);
    expect(editor.calls).toEqual([
      { op: "setBehaviorEnabled", nodeId: "n1", bindingId: "b1", enabled: true },
    ]);
  });

  it("type === SET_BEHAVIOR_ENABLED", () => {
    expect(
      new SetBehaviorEnabledCommand({
        node_id: "n1",
        binding_id: "b1",
        enabled: false,
        prev_enabled: true,
      }).type,
    ).toBe(SET_BEHAVIOR_ENABLED);
  });

  it("never merges", () => {
    const a = new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: false,
      prev_enabled: true,
    });
    const b = new SetBehaviorEnabledCommand({
      node_id: "n1",
      binding_id: "b1",
      enabled: true,
      prev_enabled: false,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });
});
