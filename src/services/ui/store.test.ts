import { beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./store";

function resetStore() {
  useUIStore.setState({
    settingsOpen: false,
    hierarchyCollapsed: false,
    propertiesCollapsed: false,
    selectedNodeId: null,
    expandedNodes: {},
    gizmoMode: "translate",
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

describe("useUIStore gizmo mode", () => {
  beforeEach(resetStore);

  it("defaults to translate", () => {
    expect(useUIStore.getState().gizmoMode).toBe("translate");
  });

  it("cycles through translate / rotate / scale", () => {
    const { setGizmoMode } = useUIStore.getState();
    setGizmoMode("rotate");
    expect(useUIStore.getState().gizmoMode).toBe("rotate");
    setGizmoMode("scale");
    expect(useUIStore.getState().gizmoMode).toBe("scale");
    setGizmoMode("translate");
    expect(useUIStore.getState().gizmoMode).toBe("translate");
  });
});

describe("useUIStore — Phase 3 Stage B", () => {
  beforeEach(() => {
    useUIStore.setState({
      rightPanelTab: "properties",
      playState: "edit",
    });
  });

  it("rightPanelTab defaults to 'properties'", () => {
    expect(useUIStore.getState().rightPanelTab).toBe("properties");
  });

  it("setRightPanelTab switches to behaviors", () => {
    useUIStore.getState().setRightPanelTab("behaviors");
    expect(useUIStore.getState().rightPanelTab).toBe("behaviors");
  });

  it("playState defaults to 'edit'", () => {
    expect(useUIStore.getState().playState).toBe("edit");
  });

  it("setPlayState toggles between edit and play", () => {
    useUIStore.getState().setPlayState("play");
    expect(useUIStore.getState().playState).toBe("play");
    useUIStore.getState().setPlayState("edit");
    expect(useUIStore.getState().playState).toBe("edit");
  });
});

describe("useUIStore — Phase 3 · 3.1", () => {
  beforeEach(() => {
    useUIStore.setState({
      helpOpen: false,
      pendingFocusNodeId: undefined,
    });
  });

  it("helpOpen defaults to false", () => {
    expect(useUIStore.getState().helpOpen).toBe(false);
  });

  it("setHelpOpen flips the flag", () => {
    useUIStore.getState().setHelpOpen(true);
    expect(useUIStore.getState().helpOpen).toBe(true);
  });

  it("pendingFocusNodeId defaults to undefined (no request)", () => {
    expect(useUIStore.getState().pendingFocusNodeId).toBeUndefined();
  });

  it("requestFocus stores the requested id (or null for scene center)", () => {
    useUIStore.getState().requestFocus("n1");
    expect(useUIStore.getState().pendingFocusNodeId).toBe("n1");
    useUIStore.getState().requestFocus(null);
    expect(useUIStore.getState().pendingFocusNodeId).toBeNull();
  });

  it("consumeFocusRequest clears back to undefined", () => {
    useUIStore.getState().requestFocus("n1");
    useUIStore.getState().consumeFocusRequest();
    expect(useUIStore.getState().pendingFocusNodeId).toBeUndefined();
  });
});

describe("useUIStore — newProjectOpen (3.2)", () => {
  beforeEach(() => useUIStore.setState({ newProjectOpen: false }));

  it("defaults to false", () => {
    expect(useUIStore.getState().newProjectOpen).toBe(false);
  });

  it("setNewProjectOpen flips it", () => {
    useUIStore.getState().setNewProjectOpen(true);
    expect(useUIStore.getState().newProjectOpen).toBe(true);
  });
});

describe("useUIStore — libraryOpen (v0.2)", () => {
  beforeEach(() => useUIStore.setState({ libraryOpen: false }));

  it("defaults to false (library starts collapsed)", () => {
    expect(useUIStore.getState().libraryOpen).toBe(false);
  });

  it("setLibraryOpen flips it", () => {
    useUIStore.getState().setLibraryOpen(true);
    expect(useUIStore.getState().libraryOpen).toBe(true);
  });
});
