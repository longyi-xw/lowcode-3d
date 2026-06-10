import { describe, expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core";

import type { SceneNode } from "@/core/scene/types";

import { BabylonAdapter } from "./adapter";

const base = {
  transform: {
    position: [0, 0, 0] as [number, number, number],
    rotation: [0, 0, 0, 1] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  },
  children_ids: [] as string[],
  visible: true,
  locked: false,
  behaviors: [],
  user_data: {},
};

function meshNode(
  id: string,
  kind: "box" | "sphere" = "box",
  parent_id: string | null = null,
): SceneNode {
  return {
    ...base,
    id,
    name: id,
    type: "mesh",
    parent_id,
    data: { type: "mesh", geometry: { kind } },
  };
}

describe("BabylonAdapter", () => {
  it("has a babylon.js target", () => {
    expect(new BabylonAdapter().target.kind).toBe("babylon.js");
  });

  it("syncNode add → describeNode returns mesh info with transform", () => {
    const a = new BabylonAdapter();
    a.syncNode(
      {
        ...meshNode("m1", "sphere"),
        transform: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 2, 2] },
        visible: false,
      },
      "add",
    );
    const info = a.describeNode("m1");
    expect(info?.kind).toBe("mesh");
    expect(info?.geometryKind).toBe("sphere");
    expect(info?.position).toEqual([1, 2, 3]);
    expect(info?.scale).toEqual([2, 2, 2]);
    expect(info?.visible).toBe(false);
    a.dispose();
  });

  it("remove → describeNode null", () => {
    const a = new BabylonAdapter();
    a.syncNode(meshNode("m1"), "add");
    a.syncNode(meshNode("m1"), "remove");
    expect(a.describeNode("m1")).toBeNull();
    a.dispose();
  });

  it("parents a child under its parent's nodeId", () => {
    const a = new BabylonAdapter();
    a.syncNode(
      {
        ...base,
        id: "g",
        name: "g",
        type: "group",
        parent_id: null,
        data: { type: "group" },
      },
      "add",
    );
    a.syncNode(meshNode("c", "box", "g"), "add");
    expect(a.describeNode("c")?.parentId).toBe("g");
    a.dispose();
  });

  it("maps light + camera subtypes", () => {
    const a = new BabylonAdapter();
    a.syncNode(
      {
        ...base,
        id: "L",
        name: "L",
        type: "light",
        parent_id: null,
        data: { type: "light", light_kind: "point", color: "#fff", intensity: 1 },
      },
      "add",
    );
    a.syncNode(
      {
        ...base,
        id: "C",
        name: "C",
        type: "camera",
        parent_id: null,
        data: { type: "camera", camera_kind: "perspective", near: 0.1, far: 100 },
      },
      "add",
    );
    expect(a.describeNode("L")).toMatchObject({ kind: "light", lightKind: "point" });
    expect(a.describeNode("C")).toMatchObject({
      kind: "camera",
      cameraKind: "perspective",
    });
    a.dispose();
  });

  it("throws NotImplemented for pickAt / syncAsset / exportProject", async () => {
    const a = new BabylonAdapter();
    expect(() => a.pickAt(0, 0)).toThrow(/not implemented/i);
    await expect(a.syncAsset({} as never)).rejects.toThrow(/not implemented/i);
    await expect(a.exportProject({} as never, {})).rejects.toThrow(/not implemented/i);
    a.dispose();
  });
});

describe("BabylonAdapter behaviors", () => {
  function meshAt(id: string, y: number): SceneNode {
    return {
      id,
      name: id,
      type: "mesh",
      parent_id: null,
      transform: { position: [0, y, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
      children_ids: [],
      visible: true,
      locked: false,
      data: { type: "mesh", geometry: { kind: "box" } },
      behaviors: [],
      user_data: {},
    };
  }

  it("getSupportedBehaviors returns auto-rotate + bob", () => {
    const types = new BabylonAdapter().getSupportedBehaviors().map((d) => d.type);
    expect(types).toContain("auto-rotate");
    expect(types).toContain("bob");
  });

  it("install + tick bob moves the node by the sine formula", () => {
    const a = new BabylonAdapter();
    a.syncNode(meshAt("m", 0), "add");
    a.installBehaviors("m", [
      {
        id: "b1",
        behavior_type: "bob",
        enabled: true,
        parameters: { axis: "y", amplitude: 2, frequency: 1 },
      },
    ]);
    a.tickBehaviors(0.25);
    expect(a.describeNode("m")!.position[1]).toBeCloseTo(2, 6);
    a.dispose();
  });

  it("uninstall freezes the behavior", () => {
    const a = new BabylonAdapter();
    a.syncNode(meshAt("m", 0), "add");
    a.installBehaviors("m", [
      {
        id: "b1",
        behavior_type: "bob",
        enabled: true,
        parameters: { axis: "y", amplitude: 2, frequency: 1 },
      },
    ]);
    a.tickBehaviors(0.25);
    a.uninstallBehaviors("m");
    const frozen = a.describeNode("m")!.position[1];
    a.tickBehaviors(0.25);
    expect(a.describeNode("m")!.position[1]).toBe(frozen);
    a.dispose();
  });

  it("skips disabled bindings and isolates unknown types (no throw)", () => {
    const a = new BabylonAdapter();
    a.syncNode(meshAt("m", 0), "add");
    expect(() =>
      a.installBehaviors("m", [
        { id: "x", behavior_type: "nope", enabled: true, parameters: {} },
        {
          id: "d",
          behavior_type: "bob",
          enabled: false,
          parameters: { axis: "y", amplitude: 2, frequency: 1 },
        },
      ]),
    ).not.toThrow();
    a.tickBehaviors(0.25);
    expect(a.describeNode("m")!.position[1]).toBe(0);
    a.dispose();
  });
});

describe("engine injection (v1.0 B1)", () => {
  it("uses the injected engine and disposes it with the adapter", () => {
    const engine = new NullEngine();
    const adapter = new BabylonAdapter({ engine });
    expect(adapter.scene.getEngine()).toBe(engine);
    adapter.dispose();
    expect(engine.isDisposed).toBe(true);
  });

  it("defaults to a NullEngine when nothing is injected", () => {
    const adapter = new BabylonAdapter();
    expect(adapter.scene.getEngine()).toBeInstanceOf(NullEngine);
    adapter.dispose();
  });

  it("scene uses the right-handed system (matches three.js / glTF transforms)", () => {
    const adapter = new BabylonAdapter();
    expect(adapter.scene.useRightHandedSystem).toBe(true);
    adapter.dispose();
  });
});
