import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultProject } from "@/core/scene/defaults";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { beginAssetDrag } from "@/services/library/asset-drag";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

import { LibraryPanel } from "./LibraryPanel";

vi.mock("@/services/library/asset-drag", () => ({
  beginAssetDrag: vi.fn(),
}));

function seed(libraryOpen = true) {
  const project = createDefaultProject({
    id: "p1",
    name: "test",
    target: { kind: "three.js", version: "0.184.0", module_format: "esm" },
    now: new Date("2026-01-01T00:00:00Z"),
  });
  project.assets = [
    {
      id: "a1",
      content_hash: "h",
      kind: "geometry",
      relative_path: "assets/h.glb",
      tags: [],
      description: "chair",
      source: { kind: "user_upload", original_filename: "chair.glb" },
    },
  ];
  useSceneStore.setState({ project });
  useUIStore.setState({ libraryOpen, selectedNodeId: null, playState: "edit" });
}

describe("LibraryPanel", () => {
  beforeEach(() => {
    useSceneStore.setState({ project: null });
    useCommandHistoryStore.getState().clear();
    seed();
    vi.mocked(beginAssetDrag).mockClear();
  });

  it("lists geometry items in the geometry tab (default)", () => {
    render(<LibraryPanel />);
    expect(screen.getByText("Sphere")).toBeInTheDocument();
    expect(screen.getByText("Box")).toBeInTheDocument();
  });

  it("double-clicking an item dispatches AddNodeCommand + selects it", () => {
    const exec = vi.spyOn(useCommandHistoryStore.getState(), "execute");
    render(<LibraryPanel />);
    fireEvent.doubleClick(screen.getByText("Sphere"));
    expect(exec).toHaveBeenCalledWith(
      expect.objectContaining({ type: "node.add" }),
      expect.anything(),
    );
    expect(useUIStore.getState().selectedNodeId).not.toBeNull();
  });

  it("switching to the uploads tab shows uploaded assets by filename", () => {
    render(<LibraryPanel />);
    fireEvent.click(screen.getByText("Uploads"));
    expect(screen.getByText("chair.glb")).toBeInTheDocument();
  });

  it("collapses to a header bar (no items) when libraryOpen is false", () => {
    useUIStore.setState({ libraryOpen: false });
    render(<LibraryPanel />);
    expect(screen.getByText("Asset Library")).toBeInTheDocument();
    expect(screen.queryByText("Sphere")).not.toBeInTheDocument();
  });

  it("pointer-down on a card begins an asset drag with the item id", () => {
    render(<LibraryPanel />);
    fireEvent.pointerDown(screen.getByText("Sphere"), { clientX: 12, clientY: 34 });
    expect(beginAssetDrag).toHaveBeenCalledTimes(1);
    expect(vi.mocked(beginAssetDrag).mock.calls[0]?.[0]).toBe("geo-sphere");
  });
});
