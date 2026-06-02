import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import type { BehaviorBinding, SceneNode } from "@/core/scene/types";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { createThreeBehaviorRegistry } from "@/runtime/three/behaviors";

import { BehaviorsPanel, SUPPORTED_BEHAVIORS } from "./BehaviorsPanel";

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function makeMeshNode(id: string, behaviors: BehaviorBinding[] = []): SceneNode {
  return {
    id,
    name: id,
    type: "mesh",
    transform: IDENTITY,
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data: { type: "mesh", asset_id: "asset-x" },
    behaviors,
    user_data: {},
  };
}

function seedProjectWithNode(nodeId: string, behaviors: BehaviorBinding[] = []) {
  const project = createDefaultProject({
    id: "p1",
    name: "test",
    target: { kind: "three.js", version: "0.184.0", module_format: "esm" },
    now: new Date("2026-01-01T00:00:00Z"),
  });
  project.scene.root_node_ids = [nodeId];
  project.scene.nodes[nodeId] = makeMeshNode(nodeId, behaviors);
  useSceneStore.setState({ project });
  useUIStore.setState({ selectedNodeId: nodeId, playState: "edit" });
}

function binding(overrides: Partial<BehaviorBinding> = {}): BehaviorBinding {
  return {
    id: "b1",
    behavior_type: "auto-rotate",
    enabled: true,
    parameters: { axis: "y", speed: 30 },
    ...overrides,
  };
}

describe("BehaviorsPanel", () => {
  beforeEach(() => {
    useSceneStore.setState({ project: null });
    useUIStore.setState({ selectedNodeId: null, playState: "edit" });
    useCommandHistoryStore.getState().clear();
  });

  it("shows empty-state when selected node has no behaviors", () => {
    seedProjectWithNode("n1");
    render(<BehaviorsPanel />);
    expect(screen.getByText(/no behaviors/i)).toBeInTheDocument();
  });

  it("renders one row per binding", () => {
    seedProjectWithNode("n1", [binding(), binding({ id: "b2" })]);
    render(<BehaviorsPanel />);
    expect(screen.getAllByText(/auto rotate/i).length).toBeGreaterThanOrEqual(2);
  });

  it("Add Behavior dispatches AddBehaviorCommand", () => {
    seedProjectWithNode("n1");
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByRole("button", { name: /add behavior/i }));
    fireEvent.click(screen.getByRole("button", { name: /auto rotate/i }));
    const node = useSceneStore.getState().getNode("n1");
    expect(node!.behaviors.length).toBe(1);
    expect(node!.behaviors[0]!.behavior_type).toBe("auto-rotate");
    expect(useCommandHistoryStore.getState().undoStack.length).toBe(1);
  });

  it("Remove button dispatches RemoveBehaviorCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByLabelText(/remove/i));
    expect(useSceneStore.getState().getNode("n1")!.behaviors).toEqual([]);
  });

  it("Enabled checkbox dispatches SetBehaviorEnabledCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.click(screen.getByRole("checkbox", { name: /enabled/i }));
    expect(useSceneStore.getState().getNode("n1")!.behaviors[0]!.enabled).toBe(false);
  });

  it("Editing speed dispatches SetBehaviorParametersCommand", () => {
    seedProjectWithNode("n1", [binding()]);
    render(<BehaviorsPanel />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "60" },
    });
    const params = useSceneStore.getState().getNode("n1")!.behaviors[0]!.parameters as {
      speed: number;
    };
    expect(params.speed).toBe(60);
  });

  it("disables all controls when playState === 'play'", () => {
    seedProjectWithNode("n1", [binding()]);
    useUIStore.setState({ playState: "play" });
    render(<BehaviorsPanel />);
    expect(screen.getByRole("button", { name: /add behavior/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /enabled/i })).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(screen.getByLabelText(/remove/i)).toBeDisabled();
  });

  it("renders placeholder for unknown behavior_type with only a delete affordance", () => {
    seedProjectWithNode("n1", [binding({ id: "x", behavior_type: "future-thing" })]);
    render(<BehaviorsPanel />);
    expect(screen.getByText(/unknown behavior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remove/i)).toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("offers every registered behavior in the add picker (no drift)", () => {
    const registered = createThreeBehaviorRegistry()
      .list()
      .map((b) => b.definition.type)
      .sort();
    const offered = SUPPORTED_BEHAVIORS.map((s) => s.type).sort();
    expect(offered).toEqual(registered);
  });
});
