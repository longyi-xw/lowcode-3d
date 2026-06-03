import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneNode } from "@/core/scene/types";
import { isEffectivelyLocked } from "@/core/scene/policy";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { useEditorShortcuts } from "./use-editor-shortcuts";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function meshNode(id = "m1"): SceneNode {
  return {
    id,
    name: "Mesh",
    type: "mesh",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", asset_id: "asset-1" },
    behaviors: [],
    user_data: {},
  };
}

function helperNode(id = "h1"): SceneNode {
  return {
    id,
    name: "Grid",
    type: "helper",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "helper", helper_kind: "grid" },
    behaviors: [],
    user_data: {},
  };
}

function seed(node: SceneNode = meshNode()) {
  useSceneStore.setState({
    project: {
      spec_version: "0.1.0",
      metadata: {
        id: "p1",
        name: "t",
        created_at: "",
        updated_at: "",
        target_runtime: { kind: "three.js", version: "0.184.0", module_format: "esm" },
      },
      scene: { root_node_ids: [node.id], nodes: { [node.id]: node } },
      assets: [],
      settings: {
        units: "meters",
        up_axis: "y",
        background: { kind: "color", color: "#000" },
      },
    },
  });
  useUIStore.setState({
    selectedNodeId: node.id,
    playState: "edit",
    helpOpen: false,
    pendingFocusNodeId: undefined,
  });
}

function fire(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
}

describe("useEditorShortcuts", () => {
  beforeEach(() => {
    useCommandHistoryStore.getState().clear();
    seed();
  });

  it("Delete fires DeleteNodeCommand on selected node", () => {
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    fire("Delete");
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.delete" }),
      expect.anything(),
    );
  });

  it("Backspace also fires DeleteNodeCommand", () => {
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    fire("Backspace");
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.delete" }),
      expect.anything(),
    );
  });

  it("Cmd+D fires DuplicateNodeCommand", () => {
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    fire("d", { metaKey: true });
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.duplicate" }),
      expect.anything(),
    );
  });

  it("F sets pendingFocusNodeId to the current selection", () => {
    renderHook(() => useEditorShortcuts());
    fire("f");
    expect(useUIStore.getState().pendingFocusNodeId).toBe("m1");
  });

  it("F with no selection sets pendingFocusNodeId to null", () => {
    seed();
    useUIStore.setState({ selectedNodeId: null });
    renderHook(() => useEditorShortcuts());
    fire("f");
    expect(useUIStore.getState().pendingFocusNodeId).toBeNull();
  });

  it("Space toggles playState", () => {
    renderHook(() => useEditorShortcuts());
    expect(useUIStore.getState().playState).toBe("edit");
    fire(" ");
    expect(useUIStore.getState().playState).toBe("play");
    fire(" ");
    expect(useUIStore.getState().playState).toBe("edit");
  });

  it("Escape clears selection", () => {
    renderHook(() => useEditorShortcuts());
    fire("Escape");
    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it("? opens help dialog", () => {
    renderHook(() => useEditorShortcuts());
    fire("?");
    expect(useUIStore.getState().helpOpen).toBe(true);
  });

  it("Cmd+/ opens help dialog", () => {
    renderHook(() => useEditorShortcuts());
    fire("/", { metaKey: true });
    expect(useUIStore.getState().helpOpen).toBe(true);
  });

  it("Cmd+J toggles the asset library", () => {
    useUIStore.setState({ libraryOpen: false });
    renderHook(() => useEditorShortcuts());
    fire("j", { metaKey: true });
    expect(useUIStore.getState().libraryOpen).toBe(true);
    fire("j", { metaKey: true });
    expect(useUIStore.getState().libraryOpen).toBe(false);
  });

  it("skips Delete when focus is in an INPUT", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(exec).not.toHaveBeenCalled();
    input.remove();
  });

  it("skips Delete on locked / helper nodes", () => {
    seed(helperNode());
    expect(isEffectivelyLocked(helperNode())).toBe(true); // sanity
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    fire("Delete");
    expect(exec).not.toHaveBeenCalled();
  });

  it("skips Delete in play mode (also enforced by command-history)", () => {
    useUIStore.setState({ playState: "play" });
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    renderHook(() => useEditorShortcuts());
    fire("Delete");
    expect(exec).not.toHaveBeenCalled();
  });

  it("skips Space when focus is on a BUTTON (lets native click fire instead)", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();
    renderHook(() => useEditorShortcuts());
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    // playState should NOT have toggled
    expect(useUIStore.getState().playState).toBe("edit");
    btn.remove();
  });
});
