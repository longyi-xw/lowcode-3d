import { describe, expect, it } from "vitest";

import { makeFakeEditor } from "./_test-utils";
import {
  SET_MATERIAL_OVERRIDE,
  SetMaterialOverrideCommand,
} from "./set-material-override";

const red = { slot: 0, color: "#ff0000" };
const green = { slot: 0, color: "#00ff00" };

describe("SetMaterialOverrideCommand", () => {
  it("apply() sets the override", () => {
    const editor = makeFakeEditor();
    new SetMaterialOverrideCommand({
      node_id: "m",
      override: red,
      prev_override: undefined,
    }).apply(editor);
    expect(editor.calls).toEqual([
      { op: "setMeshMaterial", nodeId: "m", override: red },
    ]);
  });

  it("revert() restores prev_override (undefined clears)", () => {
    const editor = makeFakeEditor();
    new SetMaterialOverrideCommand({
      node_id: "m",
      override: red,
      prev_override: undefined,
    }).revert(editor);
    expect(editor.calls).toEqual([
      { op: "setMeshMaterial", nodeId: "m", override: undefined },
    ]);
  });

  it("merges consecutive edits on the same node within the window", () => {
    const a = new SetMaterialOverrideCommand({
      node_id: "m",
      override: red,
      prev_override: undefined,
      timestamp: 1000,
    });
    const b = new SetMaterialOverrideCommand({
      node_id: "m",
      override: green,
      prev_override: red,
      timestamp: 1200,
    });
    expect(a.canMergeWith(b)).toBe(true);
    const merged = a.mergeWith(b);
    expect(merged.payload.override).toEqual(green); // latest
    expect(merged.payload.prev_override).toBeUndefined(); // earliest
    expect(merged.id).toBe(a.id);
  });

  it("does not merge across nodes or outside the window", () => {
    const a = new SetMaterialOverrideCommand({
      node_id: "m",
      override: red,
      prev_override: undefined,
      timestamp: 1000,
    });
    expect(
      a.canMergeWith(
        new SetMaterialOverrideCommand({
          node_id: "other",
          override: green,
          prev_override: undefined,
          timestamp: 1100,
        }),
      ),
    ).toBe(false);
    expect(
      a.canMergeWith(
        new SetMaterialOverrideCommand({
          node_id: "m",
          override: green,
          prev_override: red,
          timestamp: 9000,
        }),
      ),
    ).toBe(false);
  });

  it("uses a stable type", () => {
    expect(
      new SetMaterialOverrideCommand({
        node_id: "m",
        override: red,
        prev_override: undefined,
      }).type,
    ).toBe(SET_MATERIAL_OVERRIDE);
  });
});
