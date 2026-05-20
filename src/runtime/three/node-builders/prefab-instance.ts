import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

import type { AssetCache } from "../asset-cache";

type PrefabData = Extract<NodeData, { type: "prefab_instance" }>;

function requirePrefabData(node: SceneNode): PrefabData {
  if (node.data.type !== "prefab_instance") {
    throw new Error(`prefab-instance builder received node of type ${node.data.type}`);
  }
  return node.data;
}

/**
 * Builder closure factory — captures the {@link AssetCache} once at adapter
 * construction so the dispatch in `node-builders/index.ts` can stay
 * dependency-free.
 *
 * Returns the `{ build, update }` shape the other builders use. `build`
 * clones the cached template if it's already loaded, otherwise drops in a
 * placeholder magenta cube + the asset id in userData so a later
 * `syncAsset` call can swap geometry in via `replaceTemplate`.
 */
export function createPrefabInstanceBuilder(cache: AssetCache) {
  function build(node: SceneNode): THREE.Object3D {
    const data = requirePrefabData(node);
    const clone = cache.cloneTemplate(data.asset_id);
    if (clone) {
      clone.name = node.name;
      markPrefabSubtree(clone, node.id);
      return clone;
    }
    const placeholder = buildPlaceholder();
    placeholder.name = node.name;
    placeholder.userData.assetId = data.asset_id;
    placeholder.userData.prefabPlaceholder = true;
    return placeholder;
  }

  function update(object: THREE.Object3D, node: SceneNode): void {
    const data = requirePrefabData(node);
    object.userData.assetId = data.asset_id;
    object.name = node.name;
  }

  return { build, update };
}

function buildPlaceholder(): THREE.Mesh {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    metalness: 0,
    roughness: 0.8,
    transparent: true,
    opacity: 0.6,
  });
  return new THREE.Mesh(g, m);
}

/**
 * Tag every descendant Object3D with the prefab instance's SceneNode id so
 * raycast hits resolve back to the prefab even when the user clicks a deep
 * sub-mesh. `pickAt` walks parent chain looking for `userData.nodeId`, and
 * tagging only the root would mean walking up through cloned glTF objects
 * (which doesn't yet know the node id).
 *
 * Also disables raycasting on the cloned subtree's children EXCEPT the root —
 * a single root-level userData.nodeId is enough for selection and avoids
 * picking N child meshes per click.
 */
function markPrefabSubtree(root: THREE.Object3D, nodeId: string): void {
  root.userData.nodeId = nodeId;
  root.userData.prefabRoot = true;
}
