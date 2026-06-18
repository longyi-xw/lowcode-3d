import { afterEach, describe, expect, it } from "vitest";

function expectHexClose(actual: string | undefined, expected: string): void {
  expect(actual).toBeDefined();
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = ch(actual!);
  const e = ch(expected);
  for (let i = 0; i < 3; i++) expect(Math.abs(a[i]! - e[i]!)).toBeLessThanOrEqual(2);
}

import type { SceneNode } from "@/core/scene/types";
import type { IRuntimeAdapter } from "@/runtime/adapter";

export interface ConformanceOptions {
  /** Engine-specific factory returning an adapter ready to pick against an
   *  800×600 viewport (Three: setViewportSize; Babylon: sized NullEngine).
   *  Both engines share the default editor camera framing [4,3,4]→origin,
   *  fov 50°, so the same screen points resolve the same nodes. */
  makePickAdapter?: () => IRuntimeAdapter;
}

const ID = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};
/** Non-identity rotation (90° about Y) used to verify the transform round-trip
 *  on group/mesh — both engines store the quaternion verbatim (no normalize),
 *  so describeNode must read back these exact components. */
const ROT_Y90: [number, number, number, number] = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
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
 * Transform (pos/rot/scale) is asserted on group/mesh only. Known cross-engine
 * gaps NOT asserted here (spec §1.5 + A1 known divergences): Babylon lights are
 * not TransformNodes (no scaling/rotationQuaternion; HemisphericLight also has
 * no position), and Babylon's UniversalCamera carries rotation as Euler (no
 * rotationQuaternion) — so light/camera assert only kind/subtype/visible/
 * parentId. Camera/light orientation parity is deferred to when it becomes
 * in-scope (A2/B).
 */
export function describeAdapterConformance(
  makeAdapter: () => IRuntimeAdapter,
  label: string,
  options?: ConformanceOptions,
): void {
  describe(`IRuntimeAdapter conformance — ${label}`, () => {
    // Track every adapter a test creates so we can dispose them (Babylon holds
    // a NullEngine + Scene per instance; leaking them across the suite would
    // accumulate engines). make() is used in place of makeAdapter() directly.
    let live: IRuntimeAdapter[] = [];
    const make = (): IRuntimeAdapter => {
      const adapter = makeAdapter();
      live.push(adapter);
      return adapter;
    };
    afterEach(() => {
      for (const adapter of live) adapter.dispose();
      live = [];
    });

    it("describeNode is null before add and after remove", () => {
      const a = make();
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
      const a = make();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
          transform: { position: [1, 2, 3], rotation: ROT_Y90, scale: [2, 3, 4] },
          visible: false,
        }),
        "add",
      );
      const info = a.describeNode("m")!;
      expect(info.kind).toBe("mesh");
      expect(info.position).toEqual([1, 2, 3]);
      expect(info.rotation).toEqual(ROT_Y90);
      expect(info.scale).toEqual([2, 3, 4]);
      expect(info.visible).toBe(false);
    });

    it("applies a group transform (pos/scale)", () => {
      const a = make();
      a.syncNode(
        node({
          id: "g",
          name: "g",
          type: "group",
          data: { type: "group" },
          transform: { position: [5, 0, -5], rotation: ROT_Y90, scale: [1, 2, 1] },
        }),
        "add",
      );
      const info = a.describeNode("g")!;
      expect(info.kind).toBe("group");
      expect(info.position).toEqual([5, 0, -5]);
      expect(info.rotation).toEqual(ROT_Y90);
      expect(info.scale).toEqual([1, 2, 1]);
    });

    it("reports parentId for a child under a group", () => {
      const a = make();
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

    it("describeNode reports equivalent material across engines", () => {
      const a = make();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: {
            type: "mesh",
            geometry: { kind: "box" },
            material_overrides: [
              {
                slot: 0,
                color: "#3366cc",
                metalness: 0.4,
                roughness: 0.2,
                emissive: "#110022",
                emissive_intensity: 2,
                opacity: 0.5,
              },
            ],
          },
        }),
        "add",
      );
      const mat = a.describeNode("m")?.material;
      expect(mat).toBeDefined();
      expectHexClose(mat?.color, "#3366cc");
      expect(mat?.metalness).toBeCloseTo(0.4);
      expect(mat?.roughness).toBeCloseTo(0.2);
      expectHexClose(mat?.emissive, "#110022");
      expect(mat?.emissive_intensity).toBeCloseTo(2);
      expect(mat?.opacity).toBeCloseTo(0.5);
    });

    it("maps mesh geometry kinds", () => {
      const a = make();
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
      const a = make();
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
      const a = make();
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
      const a = make();
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

    it("syncNode('update') on a missing node throws (contract parity)", () => {
      const a = make();
      expect(() =>
        a.syncNode(
          node({ id: "ghost", name: "ghost", type: "group", data: { type: "group" } }),
          "update",
        ),
      ).toThrow();
    });

    it("getSupportedBehaviors includes auto-rotate + bob", () => {
      const types = make()
        .getSupportedBehaviors()
        .map((d) => d.type);
      expect(types).toContain("auto-rotate");
      expect(types).toContain("bob");
    });

    it("bob behavior moves the node by base + amp*sin(2π f t) (exact across engines)", () => {
      const a = make();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
      a.installBehaviors("m", [
        {
          id: "b1",
          behavior_type: "bob",
          enabled: true,
          parameters: { axis: "y", amplitude: 2, frequency: 1 },
        },
      ]);
      a.tickBehaviors(0.25); // sin(π/2)=1 → y=2
      expect(a.describeNode("m")!.position[1]).toBeCloseTo(2, 6);
      a.tickBehaviors(0.25); // sin(π)=0 → y=0
      expect(a.describeNode("m")!.position[1]).toBeCloseTo(0, 6);
    });

    it("auto-rotate behavior runs, accumulates, and freezes on uninstall", () => {
      const a = make();
      a.syncNode(
        node({
          id: "r",
          name: "r",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
      a.installBehaviors("r", [
        {
          id: "b1",
          behavior_type: "auto-rotate",
          enabled: true,
          parameters: { axis: "y", speed: 90 },
        },
      ]);
      a.tickBehaviors(1);
      const after1 = a.describeNode("r")!.rotation;
      expect(after1).not.toEqual([0, 0, 0, 1]); // it rotated
      a.tickBehaviors(1);
      expect(a.describeNode("r")!.rotation).not.toEqual(after1); // it kept rotating
      a.uninstallBehaviors("r");
      const frozen = a.describeNode("r")!.rotation;
      a.tickBehaviors(1);
      expect(a.describeNode("r")!.rotation).toEqual(frozen); // frozen after uninstall
    });

    it("skips disabled bindings and isolates unknown behavior types (no throw)", () => {
      const a = make();
      a.syncNode(
        node({
          id: "m",
          name: "m",
          type: "mesh",
          data: { type: "mesh", geometry: { kind: "box" } },
        }),
        "add",
      );
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
      expect(a.describeNode("m")!.position[1]).toBe(0); // disabled bob didn't move it
    });

    const makePickAdapter = options?.makePickAdapter;
    if (makePickAdapter) {
      describe("pick parity (v1.0 B2) — 800×600 viewport, default editor camera", () => {
        const makePick = (): IRuntimeAdapter => {
          const adapter = makePickAdapter();
          live.push(adapter);
          return adapter;
        };
        const box = () =>
          node({
            id: "box",
            name: "box",
            type: "mesh",
            data: { type: "mesh", geometry: { kind: "box" } },
          });

        it("pickAt(center) resolves the mesh at the origin", () => {
          const a = makePick();
          a.syncNode(box(), "add");
          expect(a.pickAt(400, 300)).toBe("box");
        });

        it("pickAt(corner sky) returns null", () => {
          const a = makePick();
          a.syncNode(box(), "add");
          expect(a.pickAt(10, 10)).toBeNull();
        });

        it("pickAt returns null after the node is removed", () => {
          const a = makePick();
          a.syncNode(box(), "add");
          a.syncNode(box(), "remove");
          expect(a.pickAt(400, 300)).toBeNull();
        });
      });
    }
  });
}
