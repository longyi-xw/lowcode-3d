import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}));

import { useAppViewStore } from "@/services/app-view/store";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { createProjectFromTemplate, newProject } from "./actions";
import { useProjectStore } from "./store";

describe("newProject", () => {
  it("opens the template picker (non-destructive)", () => {
    useUIStore.setState({ newProjectOpen: false });
    useSceneStore.setState({ project: null });
    newProject();
    expect(useUIStore.getState().newProjectOpen).toBe(true);
    expect(useSceneStore.getState().project).toBeNull(); // nothing loaded yet
  });
});

describe("createProjectFromTemplate", () => {
  beforeEach(() => {
    useProjectStore.getState().markClean(); // not dirty → confirmDiscard auto-true
    useSceneStore.setState({ project: null });
    useUIStore.setState({ newProjectOpen: true });
  });

  it("loads the single-cube template and closes the dialog", async () => {
    await createProjectFromTemplate("single-cube");
    const project = useSceneStore.getState().project;
    expect(project).not.toBeNull();
    expect(Object.keys(project!.scene.nodes).sort()).toEqual([
      "cube-1",
      "key-light",
      "main-camera",
    ]);
    expect(useUIStore.getState().newProjectOpen).toBe(false);
    expect(useAppViewStore.getState().view).toBe("editor");
  });

  it("loads the empty template with no nodes", async () => {
    await createProjectFromTemplate("empty");
    expect(useSceneStore.getState().project!.scene.nodes).toEqual({});
    expect(useUIStore.getState().newProjectOpen).toBe(false);
  });

  it("ignores an unknown template id", async () => {
    await createProjectFromTemplate("nope" as never);
    expect(useSceneStore.getState().project).toBeNull();
  });
});
