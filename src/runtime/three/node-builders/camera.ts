import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type CameraData = Extract<NodeData, { type: "camera" }>;

function requireCameraData(node: SceneNode): CameraData {
  if (node.data.type !== "camera") {
    throw new Error(`camera builder received node of type ${node.data.type}`);
  }
  return node.data;
}

export function build(node: SceneNode): THREE.Object3D {
  const data = requireCameraData(node);
  const camera = create(data);
  camera.name = node.name;
  return camera;
}

export function update(object: THREE.Object3D, node: SceneNode): void {
  const data = requireCameraData(node);
  if (object instanceof THREE.PerspectiveCamera && data.camera_kind === "perspective") {
    if (data.fov !== undefined) object.fov = data.fov;
    if (data.aspect !== undefined) object.aspect = data.aspect;
    object.near = data.near;
    object.far = data.far;
    object.updateProjectionMatrix();
  } else if (
    object instanceof THREE.OrthographicCamera &&
    data.camera_kind === "orthographic"
  ) {
    if (data.left !== undefined) object.left = data.left;
    if (data.right !== undefined) object.right = data.right;
    if (data.top !== undefined) object.top = data.top;
    if (data.bottom !== undefined) object.bottom = data.bottom;
    object.near = data.near;
    object.far = data.far;
    object.updateProjectionMatrix();
  }
}

function create(data: CameraData): THREE.Camera {
  if (data.camera_kind === "perspective") {
    return new THREE.PerspectiveCamera(
      data.fov ?? 50,
      data.aspect ?? 1,
      data.near,
      data.far,
    );
  }
  return new THREE.OrthographicCamera(
    data.left ?? -1,
    data.right ?? 1,
    data.top ?? 1,
    data.bottom ?? -1,
    data.near,
    data.far,
  );
}
