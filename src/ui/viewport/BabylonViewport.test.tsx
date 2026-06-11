import { NullEngine } from "@babylonjs/core";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BabylonRenderHost } from "@/runtime/babylon/render-host";
import { createDemoProject } from "@/services/scene/demo-project";
import { useSceneStore } from "@/services/scene/store";

import { BabylonViewport } from "./BabylonViewport";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("BabylonViewport", () => {
  let host: BabylonRenderHost | null = null;
  const createHost = () => {
    host = new BabylonRenderHost({ createEngine: () => new NullEngine() });
    return host;
  };

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    host = null;
    useSceneStore.getState().setProject(createDemoProject());
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
});
