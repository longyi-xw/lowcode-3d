import { beforeEach, describe, expect, it } from "vitest";

import { useUIStore } from "@/services/ui/store";

import { beginAssetDrag } from "./asset-drag";

function move(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
}
function up() {
  window.dispatchEvent(new MouseEvent("pointerup", {}));
}

describe("beginAssetDrag", () => {
  beforeEach(() =>
    useUIStore.setState({ assetDragItemId: null, viewportEngine: "three.js" }),
  );

  it("does not activate the drag below the 5px threshold", () => {
    beginAssetDrag("geo-box", 100, 100);
    move(103, 101); // ~3.2px
    expect(useUIStore.getState().assetDragItemId).toBeNull();
    up(); // cleanup
  });

  it("activates the drag once the pointer passes 5px", () => {
    beginAssetDrag("geo-box", 100, 100);
    move(110, 100); // 10px
    expect(useUIStore.getState().assetDragItemId).toBe("geo-box");
  });

  it("a release before the threshold tears down without activating", () => {
    beginAssetDrag("geo-box", 100, 100);
    up(); // plain click/double-click — no drag
    move(200, 200); // listeners removed → no late activation
    expect(useUIStore.getState().assetDragItemId).toBeNull();
  });

  it("does not start a drag while the Babylon viewport is active (B1 — drop lands in B4)", () => {
    useUIStore.setState({ viewportEngine: "babylon.js" });
    beginAssetDrag("geo-box", 100, 100);
    move(110, 100); // would activate in the three viewport
    expect(useUIStore.getState().assetDragItemId).toBeNull();
    up();
  });
});
