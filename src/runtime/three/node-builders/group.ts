import * as THREE from "three";
import type { SceneNode } from "@/core/scene/types";

export function build(node: SceneNode): THREE.Object3D {
  const group = new THREE.Group();
  group.name = node.name;
  return group;
}

// Groups carry no data-specific fields; transform is applied at the adapter layer.
export function update(_object: THREE.Object3D, _node: SceneNode): void {}
