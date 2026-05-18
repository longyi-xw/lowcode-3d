import * as THREE from "three";

import type { SceneNode, Transform } from "@/core/scene/types";

import * as cameraBuilder from "./camera";
import * as groupBuilder from "./group";
import * as helperBuilder from "./helper";
import * as lightBuilder from "./light";
import * as meshBuilder from "./mesh";

interface NodeBuilder {
  build(node: SceneNode): THREE.Object3D;
  update(object: THREE.Object3D, node: SceneNode): void;
}

function selectBuilder(node: SceneNode): NodeBuilder {
  switch (node.data.type) {
    case "group":
      return groupBuilder;
    case "mesh":
      return meshBuilder;
    case "light":
      return lightBuilder;
    case "camera":
      return cameraBuilder;
    case "helper":
      return helperBuilder;
    case "custom":
      throw new Error(
        `ThreeAdapter: "custom" node type "${
          (node.data as { custom_type?: string }).custom_type ?? "?"
        }" has no registered builder`,
      );
  }
}

export function buildObject(node: SceneNode): THREE.Object3D {
  return selectBuilder(node).build(node);
}

export function updateObject(object: THREE.Object3D, node: SceneNode): void {
  selectBuilder(node).update(object, node);
}

export function applyTransform(object: THREE.Object3D, transform: Transform): void {
  object.position.set(...transform.position);
  object.quaternion.set(...transform.rotation);
  object.scale.set(...transform.scale);
}

export function applyMeta(object: THREE.Object3D, node: SceneNode): void {
  object.visible = node.visible;
  object.userData.nodeId = node.id;
  object.userData.locked = node.locked;
}

/**
 * Recursively dispose Three.js GPU resources held by an Object3D subtree.
 * Lights have their own `.dispose()`; meshes own geometry + material(s).
 * Safe to call on any kind because we feature-detect each property.
 */
export function disposeSubtree(object: THREE.Object3D): void {
  for (const child of object.children.slice()) {
    disposeSubtree(child);
  }
  const maybe = object as Partial<{
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    dispose: () => void;
  }>;
  maybe.geometry?.dispose?.();
  if (Array.isArray(maybe.material)) {
    maybe.material.forEach((m) => m.dispose?.());
  } else {
    maybe.material?.dispose?.();
  }
  if (typeof maybe.dispose === "function") {
    maybe.dispose();
  }
}
