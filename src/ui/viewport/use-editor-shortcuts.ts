import { useEffect } from "react";

import { DeleteNodeCommand } from "@/core/command/commands/delete-node";
import { DuplicateNodeCommand } from "@/core/command/commands/duplicate-node";
import { generateUUID } from "@/core/id/uuid";
import { isEffectivelyLocked } from "@/core/scene/policy";
import { engineCapabilities } from "@/runtime/render-host";
import {
  cloneSubtreeWithNewIds,
  generateCopyName,
  snapshotSubtree,
} from "@/core/scene/snapshot";
import { useCommandHistoryStore } from "@/services/command-history/store";
import { getSceneEditorStore, useSceneStore } from "@/services/scene/store";
import { useUIStore } from "@/services/ui/store";

function isInTextInput(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
}

function isOnButton(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && t.tagName === "BUTTON";
}

/**
 * Global keyboard shortcuts for the editor surface — Delete / Backspace
 * (DeleteNodeCommand), Cmd/Ctrl+D (DuplicateNodeCommand), F (focus
 * camera), Space (Play/Pause toggle), Esc (clear selection), ? and
 * Cmd/Ctrl+/ (open ShortcutsHelpDialog).
 *
 * Guards:
 *   - INPUT / TEXTAREA / contenteditable always skip
 *   - Delete / Cmd+D additionally skip helper / isEffectivelyLocked
 *     nodes and play mode
 *   - Space additionally skips BUTTON focus (let native click fire)
 *   - Esc never preventDefault — let Radix Dialog still see it
 */
export function useEditorShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isInTextInput(e)) return;
      const isMod = e.metaKey || e.ctrlKey;
      const key = e.key;

      // ── Delete / Backspace ─────────────────────────────────────
      if ((key === "Delete" || key === "Backspace") && !isMod) {
        const ui = useUIStore.getState();
        if (ui.playState === "play") return;
        const id = ui.selectedNodeId;
        if (!id) return;
        const node = useSceneStore.getState().getNode(id);
        if (!node || isEffectivelyLocked(node)) return;
        const scene = useSceneStore.getState().project?.scene;
        if (!scene) return;
        const snapshot = snapshotSubtree(scene, id);
        useCommandHistoryStore
          .getState()
          .execute(
            new DeleteNodeCommand({ node_id: id, prev_subtree: snapshot }),
            getSceneEditorStore(),
          );
        useUIStore.getState().setSelectedNodeId(null);
        e.preventDefault();
        return;
      }

      // ── Cmd+D / Ctrl+D ─────────────────────────────────────────
      if (isMod && key.toLowerCase() === "d") {
        const ui = useUIStore.getState();
        if (ui.playState === "play") return;
        const id = ui.selectedNodeId;
        if (!id) return;
        const node = useSceneStore.getState().getNode(id);
        if (!node || isEffectivelyLocked(node)) return;
        const scene = useSceneStore.getState().project?.scene;
        if (!scene) return;
        const sourceSnap = snapshotSubtree(scene, id);
        // compute sibling names so generateCopyName picks a unique one
        const siblingIds =
          node.parent_id === null
            ? scene.root_node_ids
            : (scene.nodes[node.parent_id]?.children_ids ?? []);
        const siblingNames = siblingIds
          .map((sid) => scene.nodes[sid]?.name)
          .filter((n): n is string => typeof n === "string");
        const copyName = generateCopyName(node.name, siblingNames);
        const newSubtree = cloneSubtreeWithNewIds(
          sourceSnap,
          node.parent_id,
          copyName,
          generateUUID,
        );
        useCommandHistoryStore.getState().execute(
          new DuplicateNodeCommand({
            source_node_id: id,
            new_subtree: newSubtree,
          }),
          getSceneEditorStore(),
        );
        useUIStore.getState().setSelectedNodeId(newSubtree.root.id);
        e.preventDefault();
        return;
      }

      // ── F (focus camera) ───────────────────────────────────────
      if (key.toLowerCase() === "f" && !isMod) {
        const ui = useUIStore.getState();
        // Focus is viewport-owned and only the Three viewport implements it
        // (B1); a request queued in Babylon mode would fire stale on the next
        // ThreeViewport remount.
        if (!engineCapabilities(ui.viewportEngine).focus) return;
        ui.requestFocus(ui.selectedNodeId);
        e.preventDefault();
        return;
      }

      // ── Space (Play/Pause toggle) ──────────────────────────────
      if (key === " " && !isMod) {
        if (isOnButton(e)) return;
        const ui = useUIStore.getState();
        if (!engineCapabilities(ui.viewportEngine).play) return; // B4: play is Three-only
        ui.setPlayState(ui.playState === "play" ? "edit" : "play");
        e.preventDefault();
        return;
      }

      // ── Esc (clear selection) ─────────────────────────────────
      if (key === "Escape" && !isMod) {
        useUIStore.getState().setSelectedNodeId(null);
        // intentionally no preventDefault — let Radix Dialog also see it
        return;
      }

      // ── ? (help dialog) ────────────────────────────────────────
      if (key === "?" && !isMod) {
        useUIStore.getState().setHelpOpen(true);
        e.preventDefault();
        return;
      }

      // ── Cmd+/ (help dialog) ────────────────────────────────────
      if (isMod && key === "/") {
        useUIStore.getState().setHelpOpen(true);
        e.preventDefault();
        return;
      }

      // ── Cmd/Ctrl+J (toggle asset library drawer) ───────────────
      if (isMod && key.toLowerCase() === "j") {
        const ui = useUIStore.getState();
        ui.setLibraryOpen(!ui.libraryOpen);
        e.preventDefault();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
