import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SceneNode, SceneProject } from "@/core/scene/types";
import { SPEC_VERSION } from "@/core/scene/schemas";
import { useAssetPreviewStore } from "@/services/assets/preview-store";
import { HierarchyTree } from "./HierarchyTree";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function makeGroup(
  id: string,
  childIds: string[] = [],
  parentId: string | null = null,
): SceneNode {
  return {
    id,
    name: id,
    type: "group",
    transform: IDENTITY,
    parent_id: parentId,
    children_ids: childIds,
    visible: true,
    locked: false,
    data: { type: "group" },
    behaviors: [],
    user_data: {},
  };
}

function makeMesh(id: string, parentId: string | null = null): SceneNode {
  return {
    id,
    name: id,
    type: "mesh",
    transform: IDENTITY,
    parent_id: parentId,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", asset_id: "asset-x" },
    behaviors: [],
    user_data: {},
  };
}

function makePrefabInstance(
  id: string,
  assetId: string,
  parentId: string | null = null,
): SceneNode {
  return {
    id,
    name: id,
    type: "prefab_instance",
    transform: IDENTITY,
    parent_id: parentId,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "prefab_instance", asset_id: assetId },
    behaviors: [],
    user_data: {},
  };
}

function makeProject(nodes: SceneNode[], rootIds: string[]): SceneProject {
  return {
    spec_version: SPEC_VERSION,
    metadata: {
      id: "p1",
      name: "test",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      target_runtime: {
        kind: "three.js",
        version: "0.184.0",
        module_format: "esm",
      },
    },
    scene: {
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      root_node_ids: rootIds,
    },
    assets: [],
    settings: {
      units: "meters",
      up_axis: "y",
      background: { kind: "color", color: "#000000" },
    },
  };
}

describe("HierarchyTree", () => {
  it("renders root nodes", () => {
    const project = makeProject(
      [makeGroup("a"), makeGroup("b"), makeMesh("c")],
      ["a", "b", "c"],
    );
    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{}}
        onSelect={() => {}}
        onToggleExpand={() => {}}
      />,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText("c")).toBeInTheDocument();
  });

  it("hides children when collapsed; shows them when expanded", () => {
    const project = makeProject(
      [makeGroup("parent", ["child"]), makeMesh("child", "parent")],
      ["parent"],
    );

    const collapsed = render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{ parent: false }}
        onSelect={() => {}}
        onToggleExpand={() => {}}
      />,
    );
    expect(screen.queryByText("child")).not.toBeInTheDocument();
    collapsed.unmount();

    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{ parent: true }}
        onSelect={() => {}}
        onToggleExpand={() => {}}
      />,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked node id", async () => {
    const onSelect = vi.fn();
    const project = makeProject([makeMesh("cube")], ["cube"]);
    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{}}
        onSelect={onSelect}
        onToggleExpand={() => {}}
      />,
    );
    await userEvent.click(screen.getByText("cube"));
    expect(onSelect).toHaveBeenCalledWith("cube");
  });

  it("calls onSelect with null when clicking the already-selected node", async () => {
    const onSelect = vi.fn();
    const project = makeProject([makeMesh("cube")], ["cube"]);
    render(
      <HierarchyTree
        project={project}
        selectedNodeId="cube"
        expandedNodes={{}}
        onSelect={onSelect}
        onToggleExpand={() => {}}
      />,
    );
    await userEvent.click(screen.getByText("cube"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("calls onToggleExpand when the caret is clicked, not onSelect", async () => {
    const onSelect = vi.fn();
    const onToggleExpand = vi.fn();
    const project = makeProject(
      [makeGroup("parent", ["child"]), makeMesh("child", "parent")],
      ["parent"],
    );
    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{}}
        onSelect={onSelect}
        onToggleExpand={onToggleExpand}
      />,
    );
    const caret = screen.getByRole("button", { name: "expand" });
    await userEvent.click(caret);
    expect(onToggleExpand).toHaveBeenCalledWith("parent");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not render a caret for leaf nodes", () => {
    const project = makeProject([makeMesh("leaf")], ["leaf"]);
    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{}}
        onSelect={() => {}}
        onToggleExpand={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /expand|collapse/ })).toBeNull();
  });

  describe("prefab_instance rows", () => {
    afterEach(() => {
      // Unmount mounted React trees BEFORE touching the preview store; if we
      // clear first, the store update lands on still-mounted subscribers and
      // React logs an unwrapped-act warning.
      cleanup();
      useAssetPreviewStore.getState().clear();
    });

    it("renders a 'prefab' badge next to prefab_instance nodes", () => {
      const project = makeProject(
        [makePrefabInstance("model-1", "asset-h1")],
        ["model-1"],
      );
      render(
        <HierarchyTree
          project={project}
          selectedNodeId={null}
          expandedNodes={{}}
          onSelect={() => {}}
          onToggleExpand={() => {}}
        />,
      );
      expect(screen.getByText("prefab")).toBeInTheDocument();
    });

    it("is always expandable even when the scene-graph children are empty", () => {
      const project = makeProject(
        [makePrefabInstance("model-1", "asset-h1")],
        ["model-1"],
      );
      render(
        <HierarchyTree
          project={project}
          selectedNodeId={null}
          expandedNodes={{ "model-1": false }}
          onSelect={() => {}}
          onToggleExpand={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument();
    });

    it("shows a loading placeholder when expanded but no preview tree is in the store", () => {
      const project = makeProject(
        [makePrefabInstance("model-1", "asset-h1")],
        ["model-1"],
      );
      render(
        <HierarchyTree
          project={project}
          selectedNodeId={null}
          expandedNodes={{ "model-1": true }}
          onSelect={() => {}}
          onToggleExpand={() => {}}
        />,
      );
      expect(screen.getByText(/loading model preview/i)).toBeInTheDocument();
    });

    it("renders the preview tree children when a preview is in the store", () => {
      useAssetPreviewStore.getState().setTree("asset-h1", {
        name: "Scene",
        kind: "group",
        children: [
          { name: "Body", kind: "mesh", children: [] },
          {
            name: "Wheels",
            kind: "group",
            children: [{ name: "Wheel.001", kind: "mesh", children: [] }],
          },
        ],
      });
      const project = makeProject(
        [makePrefabInstance("model-1", "asset-h1")],
        ["model-1"],
      );
      render(
        <HierarchyTree
          project={project}
          selectedNodeId={null}
          expandedNodes={{ "model-1": true }}
          onSelect={() => {}}
          onToggleExpand={() => {}}
        />,
      );
      expect(screen.getByText("Body")).toBeInTheDocument();
      expect(screen.getByText("Wheels")).toBeInTheDocument();
      expect(screen.getByText("Wheel.001")).toBeInTheDocument();
    });

    it("does not surface preview tree nodes as selection targets", async () => {
      useAssetPreviewStore.getState().setTree("asset-h1", {
        name: "Scene",
        kind: "group",
        children: [{ name: "Body", kind: "mesh", children: [] }],
      });
      const onSelect = vi.fn();
      const project = makeProject(
        [makePrefabInstance("model-1", "asset-h1")],
        ["model-1"],
      );
      render(
        <HierarchyTree
          project={project}
          selectedNodeId={null}
          expandedNodes={{ "model-1": true }}
          onSelect={onSelect}
          onToggleExpand={() => {}}
        />,
      );
      await userEvent.click(screen.getByText("Body"));
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  it("renders three levels of depth correctly", () => {
    const project = makeProject(
      [makeGroup("a", ["b"]), makeGroup("b", ["c"], "a"), makeMesh("c", "b")],
      ["a"],
    );
    render(
      <HierarchyTree
        project={project}
        selectedNodeId={null}
        expandedNodes={{ a: true, b: true }}
        onSelect={() => {}}
        onToggleExpand={() => {}}
      />,
    );
    const tree = screen.getByRole("tree");
    expect(within(tree).getByText("a")).toBeInTheDocument();
    expect(within(tree).getByText("b")).toBeInTheDocument();
    expect(within(tree).getByText("c")).toBeInTheDocument();
  });
});
