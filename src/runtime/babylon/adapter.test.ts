import { describe, expect, it } from "vitest";
import { Camera, Mesh, NullEngine, PBRMaterial } from "@babylonjs/core";

import type { SceneNode } from "@/core/scene/types";
import type { MaterialOverride } from "@/core/scene/material";

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
  materialOverrides?: MaterialOverride[],
): SceneNode {
  return {
    ...base,
    id,
    name: id,
    type: "mesh",
    parent_id,
    data: { type: "mesh", geometry: { kind }, material_overrides: materialOverrides },
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

  it("throws NotImplemented for syncAsset / exportProject", async () => {
    const a = new BabylonAdapter();
    await expect(a.syncAsset({} as never)).rejects.toThrow(/not implemented/i);
    await expect(a.exportProject({} as never, {})).rejects.toThrow(/not implemented/i);
    a.dispose();
  });

  it("applies material overrides to the mesh on create", () => {
    const a = new BabylonAdapter();
    a.syncNode(
      meshNode("m", "box", null, [{ slot: 0, color: "#3366cc", metalness: 0.4 }]),
      "add",
    );
    const mesh = a.getRuntimeObject("m") as Mesh;
    expect(mesh.material).toBeInstanceOf(PBRMaterial);
    expect((mesh.material as PBRMaterial).albedoColor.toHexString().toLowerCase()).toBe(
      "#3366cc",
    );
    expect((mesh.material as PBRMaterial).metallic).toBeCloseTo(0.4);
    a.dispose();
  });

  it("re-applies material on update and resets when override cleared", () => {
    const a = new BabylonAdapter();
    a.syncNode(meshNode("m", "box", null, [{ slot: 0, color: "#ff0000" }]), "add");
    a.syncNode(meshNode("m", "box", null, [{ slot: 0, color: "#00ff00" }]), "update");
    const mesh = a.getRuntimeObject("m") as Mesh;
    expect((mesh.material as PBRMaterial).albedoColor.toHexString().toLowerCase()).toBe(
      "#00ff00",
    );
    a.syncNode(meshNode("m", "box", null, undefined), "update"); // clear → default
    expect((mesh.material as PBRMaterial).albedoColor.toHexString().toLowerCase()).toBe(
      "#cccccc",
    );
    a.dispose();
  });

  it("describeNode reports the mesh material", () => {
    const a = new BabylonAdapter();
    a.syncNode(
      meshNode("m", "box", null, [{ slot: 0, color: "#3366cc", roughness: 0.2 }]),
      "add",
    );
    const mat = a.describeNode("m")?.material;
    expect(mat?.color).toBe("#3366cc");
    expect(mat?.roughness).toBeCloseTo(0.2);
    expect(mat?.opacity).toBeCloseTo(1);
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

describe("raycastGroundPoint (v1.0 B4c)", () => {
  it("raycastGroundPoint(center) hits the y=0 ground near origin", () => {
    const a = new BabylonAdapter();
    const w = a.scene.getEngine().getRenderWidth();
    const h = a.scene.getEngine().getRenderHeight();
    const hit = a.raycastGroundPoint(w / 2, h / 2);
    expect(hit).not.toBeNull();
    expect(hit![1]).toBeCloseTo(0, 4); // on the ground plane
  });

  it("raycastGroundPoint returns null when the ray points up (sky)", () => {
    const a = new BabylonAdapter();
    // The default NullEngine is 512×256. The camera at [4,3,4] looking at
    // origin still casts downward rays across the entire 512×256 viewport.
    // Pixels above the canvas top (negative sy) shoot skyward once sy < -15.
    // Probe confirmed: at (256, -20) dir.y ≈ +0.007 → t=null (no ground hit).
    // Negative screen coords are valid for createPickingRay; not clamped.
    const hit = a.raycastGroundPoint(256, -20);
    expect(hit).toBeNull();
  });
});

describe("pickAt (v1.0 B2)", () => {
  const sized = () =>
    new BabylonAdapter({
      engine: new NullEngine({
        renderWidth: 800,
        renderHeight: 600,
        textureSize: 512,
        deterministicLockstep: false,
        lockstepMaxSteps: 4,
      }),
    });
  const boxNode = (id: string, parent: string | null = null) =>
    ({
      id,
      name: id,
      type: "mesh",
      data: { type: "mesh", geometry: { kind: "box" } },
      transform: {
        position: [0, 0, 0] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [1, 1, 1] as [number, number, number],
      },
      parent_id: parent,
      children_ids: [] as string[],
      visible: true,
      locked: false,
      behaviors: [],
      user_data: {},
    }) as SceneNode;

  it("constructor installs a default editor camera as activeCamera", () => {
    const a = new BabylonAdapter();
    expect(a.scene.activeCamera).toBeInstanceOf(Camera);
    expect(a.scene.activeCamera?.name).toBe("default-editor-camera");
    a.dispose();
  });

  it("hits the mesh under the viewport center", () => {
    const a = sized();
    a.syncNode(boxNode("box"), "add");
    expect(a.pickAt(400, 300)).toBe("box");
    a.dispose();
  });

  it("returns null on empty space and after remove", () => {
    const a = sized();
    a.syncNode(boxNode("box"), "add");
    expect(a.pickAt(10, 10)).toBeNull();
    a.syncNode(boxNode("box"), "remove");
    expect(a.pickAt(400, 300)).toBeNull();
    a.dispose();
  });

  it("a child mesh under a group resolves to the child's own node id", () => {
    const a = sized();
    a.syncNode(
      {
        ...boxNode("g"),
        type: "group",
        data: { type: "group" },
        children_ids: ["child"],
      } as SceneNode,
      "add",
    );
    a.syncNode(boxNode("child", "g"), "add");
    expect(a.pickAt(400, 300)).toBe("child");
    a.dispose();
  });

  it("helper placeholder nodes are unpickable", () => {
    const a = sized();
    a.syncNode(
      {
        ...boxNode("h"),
        type: "helper",
        data: { type: "helper", helper_kind: "grid" },
      } as SceneNode,
      "add",
    );
    expect(a.pickAt(400, 300)).toBeNull();
    a.dispose();
  });
});
