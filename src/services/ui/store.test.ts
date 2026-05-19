import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./store";

function resetStore() {
  useUIStore.setState({
    settingsOpen: false,
    hierarchyCollapsed: false,
    propertiesCollapsed: false,
    selectedNodeId: null,
    expandedNodes: {},
  });
}

describe("useUIStore selection", () => {
  beforeEach(resetStore);

  it("starts with no selection", () => {
    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });

  it("setSelectedNodeId roundtrips", () => {
    useUIStore.getState().setSelectedNodeId("cube-1");
    expect(useUIStore.getState().selectedNodeId).toBe("cube-1");
    useUIStore.getState().setSelectedNodeId(null);
    expect(useUIStore.getState().selectedNodeId).toBeNull();
  });
});

describe("useUIStore hierarchy expansion", () => {
  beforeEach(resetStore);

  it("treats missing entries as collapsed", () => {
    expect(useUIStore.getState().expandedNodes["any"]).toBeUndefined();
  });

  it("toggleNodeExpanded flips between collapsed and expanded", () => {
    const { toggleNodeExpanded } = useUIStore.getState();
    toggleNodeExpanded("models-group");
    expect(useUIStore.getState().expandedNodes["models-group"]).toBe(true);
    toggleNodeExpanded("models-group");
    expect(useUIStore.getState().expandedNodes["models-group"]).toBe(false);
  });

  it("setNodeExpanded writes the value directly", () => {
    const { setNodeExpanded } = useUIStore.getState();
    setNodeExpanded("models-group", true);
    expect(useUIStore.getState().expandedNodes["models-group"]).toBe(true);
    setNodeExpanded("models-group", false);
    expect(useUIStore.getState().expandedNodes["models-group"]).toBe(false);
  });

  it("expanded state is per-node independent", () => {
    const { setNodeExpanded } = useUIStore.getState();
    setNodeExpanded("a", true);
    setNodeExpanded("b", false);
    setNodeExpanded("c", true);
    expect(useUIStore.getState().expandedNodes).toEqual({
      a: true,
      b: false,
      c: true,
    });
  });
});
