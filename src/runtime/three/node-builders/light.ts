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
  return light;
}

export function update(object: THREE.Object3D, node: SceneNode): void {
  if (!(object instanceof THREE.Light)) return;
  const data = requireLightData(node);
  object.color.set(data.color);
  object.intensity = data.intensity;
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
