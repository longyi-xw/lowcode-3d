import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type HelperData = Extract<NodeData, { type: "helper" }>;

function requireHelperData(node: SceneNode): HelperData {
  if (node.data.type !== "helper") {
    throw new Error(`helper builder received node of type ${node.data.type}`);
  }
  return node.data;
}

/**
 * Helper nodes are editor-only visual aids — they should not export. The
 * exporter filters them out; here we just render whichever helper kind the
 * SceneNode requests, falling back to an empty Object3D for unknown kinds so
 * the hierarchy stays intact.
 */
export function build(node: SceneNode): THREE.Object3D {
  const data = requireHelperData(node);
  const obj = create(data.helper_kind);
  obj.name = node.name;
  return obj;
}

export function update(_object: THREE.Object3D, _node: SceneNode): void {
  // Helpers are static in MVP; recreating on kind change happens via remove+add.
}

function create(kind: string): THREE.Object3D {
  switch (kind) {
    case "grid":
      return new THREE.GridHelper(10, 10);
    case "axes":
      return new THREE.AxesHelper(1);
    default:
      return new THREE.Object3D();
  }
}
