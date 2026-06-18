import { engineCapabilities } from "@/runtime/render-host";
import { useUIStore } from "@/services/ui/store";

/**
 * Module-level drag-from-library controller. A library card calls
 * beginAssetDrag on pointerdown; we record a candidate and watch the pointer.
 * Only once it moves past DRAG_THRESHOLD_PX do we flip the UI store into a live
 * asset drag — so a plain click / double-click never flashes a ghost. After
 * activation this controller drops its own listeners; the drag is then owned by
 * AssetDragGhost (visual) + ThreeViewport (drop), which clear it via
 * endAssetDrag. Releasing before the threshold tears down quietly.
 */
const DRAG_THRESHOLD_PX = 5;

let candidate: { id: string; x: number; y: number } | null = null;
let onMove: ((e: PointerEvent) => void) | null = null;
let onUp: (() => void) | null = null;

export function beginAssetDrag(id: string, clientX: number, clientY: number): void {
  // B1: the Babylon viewport has no drop handler (raycastGroundPoint lands in
  // B4) — without a window-pointerup consumer the drag flag would leak.
  if (!engineCapabilities(useUIStore.getState().viewportEngine).assetDrop) return;
  teardown(); // drop any stale candidate before starting a new one
  candidate = { id, x: clientX, y: clientY };
  onMove = (e) => {
    if (!candidate) return;
    const moved = Math.hypot(e.clientX - candidate.x, e.clientY - candidate.y);
    if (moved > DRAG_THRESHOLD_PX) {
      useUIStore.getState().startAssetDrag(candidate.id);
      teardown();
    }
  };
  onUp = () => teardown();
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function teardown(): void {
  if (onMove) window.removeEventListener("pointermove", onMove);
  if (onUp) window.removeEventListener("pointerup", onUp);
  candidate = null;
  onMove = null;
  onUp = null;
}
