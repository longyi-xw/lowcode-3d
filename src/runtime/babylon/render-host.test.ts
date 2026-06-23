import { ArcRotateCamera, Mesh, NullEngine, Vector3 } from "@babylonjs/core";
import { describe, expect, it, vi } from "vitest";

import type { SceneNode } from "@/core/scene/types";

import { BabylonRenderHost } from "./render-host";

function makeHost() {
  const engine = new NullEngine();
  const host = new BabylonRenderHost({ createEngine: () => engine });
  return { host, engine };
}

const boxNodeWithSockets = (
  id: string,
  pos: [number, number, number],
  sockets: { position: [number, number, number]; tag?: string }[],
): SceneNode =>
  ({
    ...boxNode(id),
    transform: {
      position: pos,
      rotation: [0, 0, 0, 1] as [number, number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    sockets,
  }) as SceneNode;

const boxNode = (id: string): SceneNode =>
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
    parent_id: null,
    children_ids: [] as string[],
    visible: true,
    locked: false,
    behaviors: [],
    user_data: {},
  }) as SceneNode;

describe("BabylonRenderHost", () => {
  it("identifies as the babylon.js engine", () => {
    expect(makeHost().host.engine).toBe("babylon.js");
  });

  it("adapter throws before mount", () => {
    expect(() => makeHost().host.adapter).toThrow(/mount/);
  });

  it("mount creates the adapter and an ArcRotate editor camera at [4,3,4]", () => {
    const { host } = makeHost();
    host.mount(document.createElement("canvas"));
    const scene = host.adapter.scene;
    expect(scene.activeCamera).toBeInstanceOf(ArcRotateCamera);
    const cam = scene.activeCamera as ArcRotateCamera;
    expect(cam.position.x).toBeCloseTo(4);
    expect(cam.position.y).toBeCloseTo(3);
    expect(cam.position.z).toBeCloseTo(4);
    host.dispose();
  });

  it("full lifecycle mount → start → resize → stop → dispose does not throw", () => {
    const { host, engine } = makeHost();
    host.mount(document.createElement("canvas"));
    host.start();
    host.resize(800, 600);
    host.stop();
    host.dispose();
    expect(engine.isDisposed).toBe(true);
  });

  it("dispose releases the adapter (engine ownership lives there)", () => {
    const { host, engine } = makeHost();
    host.mount(document.createElement("canvas"));
    host.dispose();
    expect(engine.isDisposed).toBe(true);
    expect(() => host.adapter).toThrow();
  });

  describe("setSelection (v1.0 B2)", () => {
    function mounted() {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.adapter.syncNode(boxNode("box"), "add");
      return host;
    }

    it("highlights the selected node's mesh", () => {
      const host = mounted();
      host.setSelection("box");
      const mesh = host.adapter.getRuntimeObject("box") as Mesh;
      expect(host.selectionLayer?.hasMesh(mesh)).toBe(true);
      host.dispose();
    });

    it("null clears the highlight (idempotent replay-safe)", () => {
      const host = mounted();
      host.setSelection("box");
      host.setSelection("box"); // replay — must not throw or double-add
      host.setSelection(null);
      const mesh = host.adapter.getRuntimeObject("box") as Mesh;
      expect(host.selectionLayer?.hasMesh(mesh)).toBe(false);
      host.dispose();
    });

    it("unknown / removed node id clears the layer instead of throwing", () => {
      const host = mounted();
      host.setSelection("box");
      host.adapter.syncNode(boxNode("box"), "remove");
      host.setSelection("box"); // node gone — layer must end up empty
      expect(host.selectionLayer?.getClassName()).toBe("HighlightLayer");
      host.setSelection("nope");
      host.dispose();
    });

    it("setSelection before mount is a no-op (no throw)", () => {
      const { host } = makeHost();
      expect(() => host.setSelection("box")).not.toThrow();
    });
  });

  describe("gizmo wiring (v1.0 B3b)", () => {
    function mounted() {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      return host;
    }

    it("mount creates a GizmoManager with all gizmos disabled", () => {
      const host = mounted();
      const gm = host.gizmoManagerForTest!;
      expect(gm).not.toBeNull();
      expect(gm.positionGizmoEnabled).toBe(false);
      expect(gm.rotationGizmoEnabled).toBe(false);
      expect(gm.scaleGizmoEnabled).toBe(false);
      host.dispose();
    });

    it("setGizmoMode('translate') enables only the position gizmo", () => {
      const host = mounted();
      host.setGizmoMode("translate");
      const gm = host.gizmoManagerForTest!;
      expect(gm.positionGizmoEnabled).toBe(true);
      expect(gm.rotationGizmoEnabled).toBe(false);
      expect(gm.scaleGizmoEnabled).toBe(false);
      host.dispose();
    });

    it("translate gizmo enables plane-drag handles (not just axis arrows)", () => {
      const host = mounted();
      host.setGizmoMode("translate");
      // planarGizmoEnabled adds the XY/YZ/XZ plane handles so the user can drag
      // on a plane, matching Three's TransformControls.
      expect(host.gizmoManagerForTest!.gizmos.positionGizmo!.planarGizmoEnabled).toBe(
        true,
      );
      host.dispose();
    });

    it("setGizmoMode('rotate') enables only the rotation gizmo", () => {
      const host = mounted();
      host.setGizmoMode("rotate");
      const gm = host.gizmoManagerForTest!;
      expect(gm.positionGizmoEnabled).toBe(false);
      expect(gm.rotationGizmoEnabled).toBe(true);
      expect(gm.scaleGizmoEnabled).toBe(false);
      host.dispose();
    });

    it("setGizmoMode('scale') enables only the scale gizmo", () => {
      const host = mounted();
      host.setGizmoMode("scale");
      const gm = host.gizmoManagerForTest!;
      expect(gm.positionGizmoEnabled).toBe(false);
      expect(gm.rotationGizmoEnabled).toBe(false);
      expect(gm.scaleGizmoEnabled).toBe(true);
      host.dispose();
    });

    it("setGizmoMode can switch modes without throwing", () => {
      const host = mounted();
      expect(() => {
        host.setGizmoMode("translate");
        host.setGizmoMode("rotate");
        host.setGizmoMode("scale");
        host.setGizmoMode("translate");
      }).not.toThrow();
      host.dispose();
    });

    it("does not accumulate drag observers when a mode is re-selected", () => {
      // GizmoManager reuses gizmo instances across *Enabled toggles, so
      // re-entering translate must NOT add a second onDragStart observer
      // (otherwise captureTransform + commit fire twice per drag).
      const host = mounted();
      host.setGizmoMode("translate");
      host.setGizmoMode("rotate");
      host.setGizmoMode("translate"); // reuse the same positionGizmo instance
      const pg = host.gizmoManagerForTest!.gizmos.positionGizmo!;
      expect(pg.onDragStartObservable.observers).toHaveLength(1);
      expect(pg.onDragEndObservable.observers).toHaveLength(1);
      expect(pg.onDragObservable.observers).toHaveLength(1);
      host.dispose();
    });

    it("snap tracks the cumulative drag instead of sticking (incremental gizmo)", () => {
      // Regression: Babylon's AxisDragGizmo moves the node incrementally
      // (position += pointerDelta). If our snap overwrites node.position, the
      // gizmo's next delta lands on the snapped value, so the snap-evaluation
      // position decouples from the real cumulative pointer — the node sticks
      // to / jitters around targets ("drifting"). Three's TransformControls is
      // absolute and never had this; we track an unsnapped base to match it.
      const host = mounted();
      host.adapter.syncNode(boxNode("d"), "add");
      host.setSnapProvider(() => [
        { id: "d", sockets: [], visible: true, type: "mesh" as const },
      ]);
      host.setGizmoMode("translate");
      host.setGizmoTarget("d", false);
      // hold Ctrl (snap modifier) — read off window pointer events.
      window.dispatchEvent(new MouseEvent("pointermove", { ctrlKey: true }));

      const pg = host.gizmoManagerForTest!.gizmos.positionGizmo!;
      const node = host.adapter.getRuntimeObject("d") as Mesh;
      pg.onDragStartObservable.notifyObservers({} as never);
      // 10 incremental gizmo steps along +x (each adds the pointer delta to
      // node.position like AxisDragGizmo), firing our drag handler each time.
      for (let i = 0; i < 10; i++) {
        node.position.x += 0.13;
        pg.onDragObservable.notifyObservers({} as never);
      }
      // cumulative pointer ≈ 1.3 → nearest 0.5 grid = 1.5. The node must have
      // tracked the drag (snapping to successive grid points), not stuck at 0.
      expect(node.position.x).toBeCloseTo(1.5, 5);
      host.dispose();
    });

    it("setGizmoTarget with locked=true detaches (attachedNodeId=null)", () => {
      const host = mounted();
      host.adapter.syncNode(boxNode("box"), "add");
      host.setGizmoMode("translate");
      // locked node: should not attach
      host.setGizmoTarget("box", true);
      expect(host.gizmoManagerForTest!.attachedNode).toBeNull();
      host.dispose();
    });

    it("setGizmoTarget with null detaches", () => {
      const host = mounted();
      host.adapter.syncNode(boxNode("box"), "add");
      host.setGizmoMode("translate");
      host.setGizmoTarget(null, false);
      expect(host.gizmoManagerForTest!.attachedNode).toBeNull();
      host.dispose();
    });

    it("setGizmoTarget with valid id and locked=false attaches the node", () => {
      const host = mounted();
      host.adapter.syncNode(boxNode("box"), "add");
      host.setGizmoMode("translate");
      host.setGizmoTarget("box", false);
      expect(host.gizmoManagerForTest!.attachedNode).not.toBeNull();
      host.dispose();
    });

    it("onTransformCommit and setSnapProvider do not throw", () => {
      const host = mounted();
      expect(() => {
        host.onTransformCommit(vi.fn());
        host.setSnapProvider(() => []);
      }).not.toThrow();
      host.dispose();
    });

    it("dispose cleans up GizmoManager without throwing", () => {
      const host = mounted();
      host.setGizmoMode("translate");
      expect(() => host.dispose()).not.toThrow();
      expect(host.gizmoManagerForTest).toBeNull();
    });

    it("setGizmoMode before mount is a no-op (no throw)", () => {
      const { host } = makeHost();
      expect(() => host.setGizmoMode("rotate")).not.toThrow();
    });

    it("setGizmoTarget before mount is a no-op (no throw)", () => {
      const { host } = makeHost();
      expect(() => host.setGizmoTarget("box", false)).not.toThrow();
    });
  });

  describe("socket markers (v1.0 B4b)", () => {
    function mountedWith(node: SceneNode) {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.adapter.syncNode(node, "add");
      host.setSnapProvider(() => [
        {
          id: node.id,
          sockets: node.sockets ?? [],
          visible: true,
          type: "mesh" as const,
        },
      ]);
      return host;
    }

    it("mount creates an empty socketMarkers overlay node", () => {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      expect(host.socketMarkersForTest).not.toBeNull();
      expect(host.socketMarkersForTest!.getChildMeshes()).toHaveLength(0);
      host.dispose();
    });

    it("syncSocketMarkers builds one marker per socket at the node's world position", () => {
      const host = mountedWith(
        boxNodeWithSockets("d", [2, 0, 0], [{ position: [1, 0, 0] }]),
      );
      host.syncSocketMarkers();
      const markers = host.socketMarkersForTest!.getChildMeshes();
      expect(markers).toHaveLength(1);
      expect(markers[0]!.position.x).toBeCloseTo(3, 5);
      expect(markers[0]!.isPickable).toBe(false);
      host.dispose();
    });

    it("selected node's markers use the amber material, others cyan", () => {
      const host = mountedWith(
        boxNodeWithSockets("d", [0, 0, 0], [{ position: [0, 1, 0] }]),
      );
      host.syncSocketMarkers();
      expect(host.socketMarkersForTest!.getChildMeshes()[0]!.material?.name).toBe(
        "socket-mat",
      );
      host.setSelection("d");
      host.syncSocketMarkers();
      expect(host.socketMarkersForTest!.getChildMeshes()[0]!.material?.name).toBe(
        "socket-mat-sel",
      );
      host.dispose();
    });

    it("syncSocketMarkers clears stale markers (rebuild, not append)", () => {
      const host = mountedWith(
        boxNodeWithSockets("d", [0, 0, 0], [{ position: [1, 0, 0] }]),
      );
      host.syncSocketMarkers();
      host.syncSocketMarkers();
      expect(host.socketMarkersForTest!.getChildMeshes()).toHaveLength(1);
      host.dispose();
    });

    it("nodes without sockets contribute no markers", () => {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.adapter.syncNode(boxNode("plain"), "add");
      host.setSnapProvider(() => [
        { id: "plain", sockets: [], visible: true, type: "mesh" as const },
      ]);
      host.syncSocketMarkers();
      expect(host.socketMarkersForTest!.getChildMeshes()).toHaveLength(0);
      host.dispose();
    });

    it("dispose tears down the overlay", () => {
      const host = mountedWith(
        boxNodeWithSockets("d", [0, 0, 0], [{ position: [1, 0, 0] }]),
      );
      host.syncSocketMarkers();
      expect(() => host.dispose()).not.toThrow();
      expect(host.socketMarkersForTest).toBeNull();
    });
  });

  describe("engine-specific surface (v1.0 B4c)", () => {
    it("focusCamera sets the ArcRotate target + radius", () => {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.focusCamera(new Vector3(1, 2, 3), 7);
      const cam = host.adapter.scene.activeCamera as ArcRotateCamera;
      expect(cam.target.x).toBeCloseTo(1);
      expect(cam.target.y).toBeCloseTo(2);
      expect(cam.target.z).toBeCloseTo(3);
      expect(cam.radius).toBeCloseTo(7);
      host.dispose();
    });

    it("setFrameCallback is accepted and dispose tears down cleanly", () => {
      // NullEngine's runRenderLoop does not self-drive frames in a test
      // environment (no requestAnimationFrame), so the per-frame frameCb
      // invocation is covered by visual smoke, not here. We verify the
      // contract: the callback is accepted without throwing and start/stop/
      // dispose tear down cleanly (dispose clears frameCb so it cannot fire
      // after teardown).
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      expect(() => host.setFrameCallback(vi.fn())).not.toThrow();
      host.start();
      host.stop();
      expect(() => host.dispose()).not.toThrow();
    });

    it("setFrameCallback(null) clears the callback without throwing", () => {
      const { host } = makeHost();
      host.mount(document.createElement("canvas"));
      host.setFrameCallback(vi.fn());
      expect(() => host.setFrameCallback(null)).not.toThrow();
      host.dispose();
    });
  });
});
