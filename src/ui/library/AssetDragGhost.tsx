import { useEffect, useState } from "react";

import { findLibraryItem } from "@/services/library/catalog";
import { useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

/**
 * Cursor-following ghost shown while a library item is dragged into the
 * viewport. Reads the active drag id from the UI store and tracks the live
 * pointer in LOCAL state (not the store — pointermove is high-frequency and we
 * don't want to re-render unrelated subscribers). Renders nothing until the
 * pointer has moved at least once after activation, or if the id can't be
 * resolved (e.g. an upload removed mid-drag).
 */
export function AssetDragGhost() {
  const id = useUIStore((s) => s.assetDragItemId);
  const uploads = useSceneStore((s) => s.project?.assets);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!id) return;
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", onMove);
    // Cleanup (not the effect body) clears the tracked position — runs on every
    // id transition (drag end *and* switching targets mid-drag), so a new drag
    // never flashes the ghost at a stale position from the previous one. Doing
    // the reset here also satisfies react-hooks/set-state-in-effect, which
    // flags synchronous setState in an effect body as a cascading-render risk.
    return () => {
      window.removeEventListener("pointermove", onMove);
      setPos(null);
    };
  }, [id]);

  if (!id || !pos) return null;
  const item = findLibraryItem(id, uploads ?? []);
  if (!item) return null;
  const Icon = item.icon;

  return (
    <div
      className="pointer-events-none fixed z-50 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border border-primary/60 bg-card/80 opacity-80 shadow-lg backdrop-blur-sm"
      style={{ left: pos.x, top: pos.y }}
      aria-hidden="true"
    >
      <Icon className="h-6 w-6 text-foreground/90" />
    </div>
  );
}
