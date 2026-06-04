import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import type { SceneNode } from "@/core/scene/types";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { useSceneStore } from "@/services/scene/store";

import { MaterialSection } from "./MaterialSection";

function meshNode(): SceneNode {
  return {
    id: "m",
    name: "M",
    type: "mesh",
    transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", geometry: { kind: "box" } },
    behaviors: [],
    user_data: {},
  };
}

function seed(node: SceneNode) {
  const project = createDefaultProject({
    id: "p",
    name: "t",
    target: { kind: "three.js", version: "0.184.0", module_format: "esm" },
    now: new Date("2026-01-01T00:00:00Z"),
  });
  project.scene.root_node_ids = [node.id];
  project.scene.nodes[node.id] = node;
  useSceneStore.setState({ project });
}

describe("MaterialSection", () => {
  beforeEach(() => {
    useSceneStore.setState({ project: null });
    useCommandHistoryStore.getState().clear();
  });

  it("renders the material controls for a mesh node", () => {
    const node = meshNode();
    seed(node);
    render(<MaterialSection node={node} />);
    expect(screen.getByText("Base Color")).toBeInTheDocument();
    expect(screen.getByLabelText("Metalness")).toBeInTheDocument();
  });

  it("dispatches SetMaterialOverrideCommand when a slider changes", () => {
    const node = meshNode();
    seed(node);
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    render(<MaterialSection node={node} />);
    fireEvent.change(screen.getByLabelText("Metalness"), {
      target: { value: "0.9" },
    });
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.material.set" }),
      expect.anything(),
    );
  });
});
