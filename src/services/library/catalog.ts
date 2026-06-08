import {
  Box,
  Circle,
  Cylinder,
  FlashlightIcon,
  Lightbulb,
  Sparkles,
  Square,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { generateUUID } from "@/core/id/uuid";
import type { AssetReference, NodeData, SceneNode } from "@/core/scene/types";

/**
 * One entry in the asset library — source-agnostic. `makeNode` mints a fresh
 * SceneNode (new uuid each call) ready to drop into the scene via
 * AddNodeCommand. Builtins carry an i18n `nameKey`; uploads carry a literal
 * `name` (the original filename).
 */
export interface LibraryItem {
  id: string;
  category: "geometry" | "light" | "upload";
  /** i18n key under editor:library.item.* (builtins). */
  nameKey?: string;
  /** Literal display name (uploads use the original filename). */
  name?: string;
  icon: LucideIcon;
  makeNode: () => SceneNode;
}

const IDENTITY = {
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function baseNode(
  name: string,
  data: NodeData,
  position: [number, number, number] = [0, 0, 0],
): SceneNode {
  return {
    id: generateUUID(),
    name,
    type: data.type,
    transform: { ...IDENTITY, position },
    parent_id: null,
    children_ids: [],
    visible: true,
    locked: false,
    data,
    behaviors: [],
    user_data: {},
  };
}

function geo(
  kind: "box" | "sphere" | "plane" | "cylinder",
  name: string,
  icon: LucideIcon,
  id: string,
): LibraryItem {
  return {
    id,
    category: "geometry",
    nameKey: `library.item.${kind}`,
    icon,
    // Lift by half the primitive's height so it rests on the ground grid (y=0)
    // rather than being half-buried under it.
    makeNode: () => baseNode(name, { type: "mesh", geometry: { kind } }, [0, 0.5, 0]),
  };
}

type LightData = Extract<NodeData, { type: "light" }>;

function light(
  light_kind: LightData["light_kind"],
  name: string,
  icon: LucideIcon,
  id: string,
  position: [number, number, number],
  extra: Partial<LightData> = {},
): LibraryItem {
  return {
    id,
    category: "light",
    nameKey: `library.item.${light_kind}`,
    icon,
    makeNode: () =>
      baseNode(
        name,
        {
          type: "light",
          light_kind,
          color: "#ffffff",
          intensity: 1,
          ...extra,
        },
        position,
      ),
  };
}

export const BUILTIN_LIBRARY_ITEMS: LibraryItem[] = [
  geo("box", "Box", Box, "geo-box"),
  geo("sphere", "Sphere", Circle, "geo-sphere"),
  geo("plane", "Plane", Square, "geo-plane"),
  geo("cylinder", "Cylinder", Cylinder, "geo-cylinder"),
  light("directional", "Directional Light", Sun, "light-directional", [3, 5, 3], {
    intensity: 1.2,
    cast_shadow: true,
  }),
  light("point", "Point Light", Lightbulb, "light-point", [0, 3, 0]),
  light("spot", "Spot Light", FlashlightIcon, "light-spot", [0, 4, 0], {
    angle: Math.PI / 6,
    penumbra: 0.2,
  }),
  light("ambient", "Ambient Light", Sparkles, "light-ambient", [0, 3, 0], {
    color: "#404040",
    intensity: 0.6,
  }),
];

/**
 * Derives library items from a project's user-uploaded assets. Dropping one
 * adds a prefab_instance referencing the asset (its glTF sub-tree is loaded
 * once by ThreeAdapter.syncAsset and cloned per instance).
 */
export function uploadLibraryItems(assets: AssetReference[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const asset of assets) {
    if (asset.source.kind !== "user_upload") continue;
    const filename = asset.source.original_filename;
    items.push({
      id: `upload-${asset.id}`,
      category: "upload",
      name: filename,
      icon: Box,
      makeNode: () =>
        baseNode(filename.replace(/\.[^.]+$/, ""), {
          type: "prefab_instance",
          asset_id: asset.id,
        }),
    });
  }
  return items;
}

/**
 * Look up a library item by id across builtins + upload-derived items. Used by
 * drag-drop to recover the item (and its makeNode) at drop time, after only the
 * id was carried through the drag.
 */
export function findLibraryItem(
  id: string,
  uploads: AssetReference[],
): LibraryItem | undefined {
  return [...BUILTIN_LIBRARY_ITEMS, ...uploadLibraryItems(uploads)].find(
    (item) => item.id === id,
  );
}
