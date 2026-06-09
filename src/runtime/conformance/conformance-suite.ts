import { describe, expect, it } from "vitest";

import type { SceneNode } from "@/core/scene/types";
import type { IRuntimeAdapter } from "@/runtime/adapter";

const ID = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};
const baseFields = {
  children_ids: [] as string[],
  visible: true,
  locked: false,
  behaviors: [],
  user_data: {},
};

function node(
  partial: Pick<SceneNode, "id" | "name" | "type" | "data"> & Partial<SceneNode>,
): SceneNode {
  return { transform: ID, parent_id: null, ...baseFields, ...partial } as SceneNode;
}

/**
 * Run the engine-neutral adapter conformance assertions against an adapter
 * factory. Call once per implementation; passing the same suite for two engines
 * proves the IRuntimeAdapter contract holds across them.
 *
 * Transform (pos/rot/scale) is asserted on group/mesh only — Babylon lights are
 * not TransformNodes (no scaling/rotationQuaternion), a documented cross-engine
 * gap (spec §1.5); light/camera assert kind/subtype/visible/parentId.
 */
export function describeAdapterConformance(
  makeAdapter: () => IRuntimeAdapter,
  label: string,
): void {
  describe(`IRuntimeAdapter conformance — ${label}`, () => {
    it("describeNode is null before add and after remove", () => {
      const a = makeAdapter();
      expect(a.describeNode("m")).toBeNull();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
      expect(a.describeNode("m")).not.toBeNull();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "remove",
      );
      expect(a.describeNode("m")).toBeNull();
    });

    it("applies a mesh transform + visible", () => {
      const a = makeAdapter();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
          transform: { position: [1, 2, 3], rotation: [0, 0, 0, 1], scale: [2, 3, 4] },
          visible: false,
        }),
        "add",
      );
      const info = a.describeNode("m")!;
      expect(info.kind).toBe("mesh");
      expect(info.position).toEqual([1, 2, 3]);
      expect(info.scale).toEqual([2, 3, 4]);
      expect(info.visible).toBe(false);
    });

    it("applies a group transform (pos/scale)", () => {
      const a = makeAdapter();
      a.syncNode(
        node({
          id: "g",
          name: "g",
          type: "group",
          data: { type: "group" },
          transform: { position: [5, 0, -5], rotation: [0, 0, 0, 1], scale: [1, 2, 1] },
        }),
        "add",
      );
      const info = a.describeNode("g")!;
      expect(info.kind).toBe("group");
      expect(info.position).toEqual([5, 0, -5]);
      expect(info.scale).toEqual([1, 2, 1]);
    });

    it("reports parentId for a child under a group", () => {
      const a = makeAdapter();
      a.syncNode(
        node({ id: "g", name: "g", type: "group", data: { type: "group" } }),
        "add",
      );
      a.syncNode(
        node({
          id: "c",
          name: "c",
          type: "mesh",
          parent_id: "g",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
      expect(a.describeNode("c")!.parentId).toBe("g");
      expect(a.describeNode("g")!.parentId).toBeNull();
    });

    it("maps mesh geometry kinds", () => {
      const a = makeAdapter();
      for (const kind of ["box", "sphere", "plane", "cylinder"] as const) {
        a.syncNode(
          node({
            id: kind,
            name: kind,
            type: "mesh",
            data: { type: "mesh", geometry: { kind } },
          }),
          "add",
        );
        expect(a.describeNode(kind)!.geometryKind).toBe(kind);
      }
    });

    it("maps light subtypes", () => {
      const a = makeAdapter();
      for (const lk of ["directional", "point", "spot", "ambient"] as const) {
        a.syncNode(
          node({
            id: lk,
            name: lk,
            type: "light",
            data: { type: "light", light_kind: lk, color: "#ffffff", intensity: 1 },
          }),
          "add",
        );
        const info = a.describeNode(lk)!;
        expect(info.kind).toBe("light");
        expect(info.lightKind).toBe(lk);
      }
    });

    it("maps camera kinds", () => {
      const a = makeAdapter();
      a.syncNode(
        node({
          id: "p",
          name: "p",
          type: "camera",
          data: { type: "camera", camera_kind: "perspective", near: 0.1, far: 100 },
        }),
        "add",
      );
      a.syncNode(
        node({
          id: "o",
          name: "o",
          type: "camera",
          data: { type: "camera", camera_kind: "orthographic", near: 0.1, far: 100 },
        }),
        "add",
      );
      expect(a.describeNode("p")).toMatchObject({
        kind: "camera",
        cameraKind: "perspective",
      });
      expect(a.describeNode("o")).toMatchObject({
        kind: "camera",
        cameraKind: "orthographic",
      });
    });

    it("reflects an updated transform", () => {
      const a = makeAdapter();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
          transform: { position: [7, 8, 9], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        }),
        "update",
      );
      expect(a.describeNode("m")!.position).toEqual([7, 8, 9]);
    });
  });
}
