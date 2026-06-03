import * as THREE from "three";
import type { NodeData, SceneNode } from "@/core/scene/types";

type LightData = Extract<NodeData, { type: "light" }>;

function requireLightData(node: SceneNode): LightData {
  if (node.data.type !== "light") {
    throw new Error(`light builder received node of type ${node.data.type}`);
  }
  return node.data;
}

export function build(node: SceneNode): THREE.Object3D {
  const data = requireLightData(node);
  const light = create(data);
  light.name = node.name;
  // Editor-only marker so the light is visible in the viewport (a bare
  // THREE.Light renders nothing). It's a child of the light, so it tracks the
  // light's transform and — via findNodeId walking up to the light's tagged
  // nodeId — a click on it selects the light. Export ignores it (codegen emits
  // from the SceneNode, never from Three children).
  light.add(createMarker(data.color));
  return light;
}

export function update(object: THREE.Object3D, node: SceneNode): void {
  if (!(object instanceof THREE.Light)) return;
  const data = requireLightData(node);
  object.color.set(data.color);
  object.intensity = data.intensity;
  const marker = object.children.find(
    (c): c is THREE.Mesh => c.userData?.lightMarker === true,
  );
  if (marker && marker.material instanceof THREE.MeshBasicMaterial) {
    marker.material.color.set(data.color);
  }
  if (object instanceof THREE.PointLight || object instanceof THREE.SpotLight) {
    if (data.distance !== undefined) object.distance = data.distance;
    if (data.decay !== undefined) object.decay = data.decay;
  }
  if (object instanceof THREE.SpotLight) {
    if (data.angle !== undefined) object.angle = data.angle;
    if (data.penumbra !== undefined) object.penumbra = data.penumbra;
  }
  if (data.cast_shadow !== undefined) {
    object.castShadow = data.cast_shadow;
  }
}

/** Small unlit dot drawn in the light's color, marking the light's position in
 *  the editor viewport. Per-marker geometry (cheap) so disposeSubtree on one
 *  light never frees another's shared buffer. */
function createMarker(color: string): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }),
  );
  marker.name = "__light_marker";
  marker.userData.lightMarker = true;
  return marker;
}

function create(data: LightData): THREE.Light {
  const color = new THREE.Color(data.color);
  switch (data.light_kind) {
    case "directional": {
      const light = new THREE.DirectionalLight(color, data.intensity);
      light.castShadow = data.cast_shadow ?? false;
      return light;
    }
    case "point": {
      const light = new THREE.PointLight(
        color,
        data.intensity,
        data.distance ?? 0,
        data.decay ?? 2,
      );
      light.castShadow = data.cast_shadow ?? false;
      return light;
    }
    case "spot": {
      const light = new THREE.SpotLight(
        color,
        data.intensity,
        data.distance ?? 0,
        data.angle ?? Math.PI / 4,
        data.penumbra ?? 0,
        data.decay ?? 2,
      );
      light.castShadow = data.cast_shadow ?? false;
      return light;
    }
    case "ambient":
      return new THREE.AmbientLight(color, data.intensity);
  }
}
