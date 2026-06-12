import { NullEngine } from "@babylonjs/core";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BabylonRenderHost } from "@/runtime/babylon/render-host";
import { createDemoProject } from "@/services/scene/demo-project";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { BabylonViewport } from "./BabylonViewport";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("BabylonViewport", () => {
  let host: BabylonRenderHost | null = null;
  const createHost = () => {
    host = new BabylonRenderHost({
      createEngine: () =>
        new NullEngine({
          renderWidth: 800,
          renderHeight: 600,
          textureSize: 512,
          deterministicLockstep: false,
          lockstepMaxSteps: 4,
        }),
    });
    return host;
  };

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    host = null;
    useSceneStore.getState().setProject(createDemoProject());
    useUIStore.setState({ selectedNodeId: null });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useSceneStore.getState().setProject(null);
  });

  function firstMeshId(): string {
    const project = useSceneStore.getState().project;
    const mesh = Object.values(project!.scene.nodes).find((n) => n.type === "mesh");
    if (!mesh) throw new Error("demo project has no mesh");
    return mesh.id;
  }

  function centerCube(): string {
    const meshId = firstMeshId();
    useSceneStore.getState().setNodeTransform(meshId, {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
    return meshId;
  }

  function canvasOf(container: HTMLElement): HTMLCanvasElement {
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("no canvas");
    return canvas;
  }

  it("mounts, seeds the scene into the adapter, and unmounts cleanly", () => {
    const { unmount } = render(<BabylonViewport createHost={createHost} />);
    expect(host).not.toBeNull();
    // Demo cube landed in the Babylon scene (helper nodes may warn-skip).
    expect(host!.adapter.describeNode(firstMeshId())).not.toBeNull();
    unmount();
    // dispose() ran — adapter accessor throws after teardown.
    expect(() => host!.adapter).toThrow();
  });

  it("store mutations sync incrementally into the adapter", () => {
    render(<BabylonViewport createHost={createHost} />);
    const meshId = firstMeshId();
    useSceneStore.getState().setNodeTransform(meshId, {
      position: [5, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });
    expect(host!.adapter.describeNode(meshId)?.position).toEqual([5, 0, 0]);
  });

  it("a node the adapter cannot build is skipped without killing the viewport", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<BabylonViewport createHost={createHost} />);
    // Demo project contains a grid helper — unsupported kinds must warn-skip,
    // and the mesh must still be present.
    expect(host!.adapter.describeNode(firstMeshId())).not.toBeNull();
    warn.mockRestore();
  });

  it("clicking the mesh selects it; clicking empty space clears (B2)", () => {
    const { container } = render(<BabylonViewport createHost={createHost} />);
    const meshId = centerCube();
    const canvas = canvasOf(container);
    // jsdom rects are 0-based, so clientX/Y == viewport pixel coords.
    fireEvent.pointerDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });
    expect(useUIStore.getState().selectedNodeId).toBe(meshId);
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it("a drag-release click (>5px) does not change the selection (PR #8 guard)", () => {
    const { container } = render(<BabylonViewport createHost={createHost} />);
    centerCube();
    const canvas = canvasOf(container);
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });
    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it("hierarchy-driven selection highlights the node's mesh", () => {
    render(<BabylonViewport createHost={createHost} />);
    const meshId = centerCube();
    useUIStore.getState().setSelectedNodeId(meshId);
    const mesh = host!.adapter.getRuntimeObject(meshId);
    expect(host!.selectionLayer?.hasMesh(mesh as never)).toBe(true);
    useUIStore.getState().setSelectedNodeId(null);
    expect(host!.selectionLayer?.hasMesh(mesh as never)).toBe(false);
  });

  it("deleting the selected node leaves the highlight layer cleared", () => {
    render(<BabylonViewport createHost={createHost} />);
    const meshId = centerCube();
    useUIStore.getState().setSelectedNodeId(meshId);
    const mesh = host!.adapter.getRuntimeObject(meshId);
    expect(host!.selectionLayer?.hasMesh(mesh as never)).toBe(true);
    const project = useSceneStore.getState().project!;
    const rest = { ...project.scene.nodes };
    delete rest[meshId];
    useSceneStore.getState().setProject({
      ...project,
      scene: {
        nodes: rest,
        root_node_ids: project.scene.root_node_ids.filter((id) => id !== meshId),
      },
    });
    expect(host!.adapter.describeNode(meshId)).toBeNull();
    expect(host!.selectionLayer?.hasMesh(mesh as never)).toBe(false);
  });
});
