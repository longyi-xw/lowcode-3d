import * as THREE from "three";
import { z } from "zod";

import type { BehaviorDefinition, CodegenContext } from "@/runtime/adapter";

import type { Behavior, BehaviorContext, BehaviorHandle } from "./types";

const ParamsSchema = z.object({
  color: z.string(),
  intensity: z.number(),
});
type Params = z.infer<typeof ParamsSchema>;

/** Meshes under `root` whose material exposes an `emissive` THREE.Color. */
function emissiveMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as { emissive?: unknown } | undefined;
    if (mesh.isMesh && mat && mat.emissive instanceof THREE.Color) {
      out.push(mesh);
    }
  });
  return out;
}

export class HoverHighlightBehavior implements Behavior<Params, BehaviorHandle> {
  readonly definition: BehaviorDefinition = {
    type: "hover-highlight",
    name: "Hover Highlight",
    description:
      "Highlights the node's emissive colour while the pointer hovers over it.",
    parameters_schema: ParamsSchema,
  };

  install(
    object: THREE.Object3D,
    params: Params,
    ctx: BehaviorContext,
  ): BehaviorHandle {
    const el = ctx.domElement;
    if (!el) return {}; // non-viewport context (tests / export codegen) → no-op

    const meshes = emissiveMeshes(object);
    const originals = meshes.map((m) =>
      (m.material as THREE.MeshStandardMaterial).emissive.clone(),
    );
    const hi = new THREE.Color(params.color).multiplyScalar(params.intensity);

    const restore = (): void => {
      meshes.forEach((m, i) => {
        const orig = originals[i];
        if (orig) (m.material as THREE.MeshStandardMaterial).emissive.copy(orig);
      });
    };

    const onMove = (e: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ctx.raycaster.setFromCamera(ndc, ctx.camera);
      if (ctx.raycaster.intersectObject(object, true).length > 0) {
        meshes.forEach((m) =>
          (m.material as THREE.MeshStandardMaterial).emissive.copy(hi),
        );
      } else {
        restore();
      }
    };
    const onLeave = (): void => restore();

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);

    return {
      dispose() {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerleave", onLeave);
        restore();
      },
    };
  }

  emit(varName: string, params: Params, _ctx: CodegenContext): string {
    const color = JSON.stringify(params.color);
    return [
      `interactions.push((rt) => {`,
      `  const _meshes = [];`,
      `  ${varName}.traverse((o) => { if (o.isMesh && o.material && o.material.emissive) _meshes.push(o); });`,
      `  const _orig = _meshes.map((m) => m.material.emissive.clone());`,
      `  const _hi = new THREE.Color(${color}).multiplyScalar(${params.intensity});`,
      `  const _raycaster = new THREE.Raycaster();`,
      `  const _restore = () => _meshes.forEach((m, i) => m.material.emissive.copy(_orig[i]));`,
      `  rt.domElement.addEventListener("pointermove", (e) => {`,
      `    const r = rt.domElement.getBoundingClientRect();`,
      `    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);`,
      `    _raycaster.setFromCamera(ndc, rt.camera);`,
      `    if (_raycaster.intersectObject(${varName}, true).length > 0) _meshes.forEach((m) => m.material.emissive.copy(_hi));`,
      `    else _restore();`,
      `  });`,
      `  rt.domElement.addEventListener("pointerleave", _restore);`,
      `});`,
    ].join("\n");
  }
}
