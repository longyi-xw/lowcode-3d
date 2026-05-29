import { describe, expect, it } from "vitest";

import {
  PARAMS_MERGE_WINDOW_MS,
  SET_BEHAVIOR_PARAMETERS,
  SetBehaviorParametersCommand,
} from "./set-behavior-parameters";
import { makeFakeEditor } from "./_test-utils";

describe("SetBehaviorParametersCommand", () => {
  const base = {
    node_id: "n1",
    binding_id: "b1",
    parameters: { axis: "y", speed: 30 },
    prev_parameters: { axis: "y", speed: 0 },
  };

  it("apply sets new parameters; revert restores prev_parameters", () => {
    const editor = makeFakeEditor();
    const cmd = new SetBehaviorParametersCommand(base);
    cmd.apply(editor);
    cmd.revert(editor);
    expect(editor.calls).toEqual([
      {
        op: "setBehaviorParameters",
        nodeId: "n1",
        bindingId: "b1",
        parameters: { axis: "y", speed: 30 },
      },
      {
        op: "setBehaviorParameters",
        nodeId: "n1",
        bindingId: "b1",
        parameters: { axis: "y", speed: 0 },
      },
    ]);
  });

  it("merges with another SET_BEHAVIOR_PARAMETERS on same binding within window", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      parameters: { axis: "y", speed: 60 },
      prev_parameters: { axis: "y", speed: 30 },
      timestamp: t + 100,
    });
    expect(a.canMergeWith(b)).toBe(true);
    const merged = a.mergeWith(b);
    expect(merged.payload.prev_parameters).toEqual({ axis: "y", speed: 0 });
    expect(merged.payload.parameters).toEqual({ axis: "y", speed: 60 });
    expect(merged.id).toBe(a.id);
  });

  it("does NOT merge across different binding ids", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      binding_id: "b2",
      timestamp: t + 100,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });

  it("does NOT merge beyond the time window", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const b = new SetBehaviorParametersCommand({
      ...base,
      timestamp: t + PARAMS_MERGE_WINDOW_MS + 1,
    });
    expect(a.canMergeWith(b)).toBe(false);
  });

  it("does NOT merge with other command types", () => {
    const t = Date.now();
    const a = new SetBehaviorParametersCommand({ ...base, timestamp: t });
    const other = { type: "node.transform.set", timestamp: t + 10 } as never;
    expect(a.canMergeWith(other)).toBe(false);
  });

  it("type === SET_BEHAVIOR_PARAMETERS", () => {
    expect(new SetBehaviorParametersCommand(base).type).toBe(SET_BEHAVIOR_PARAMETERS);
  });
});
