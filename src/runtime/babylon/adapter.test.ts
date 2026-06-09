import { describe, expect, it } from "vitest";

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
