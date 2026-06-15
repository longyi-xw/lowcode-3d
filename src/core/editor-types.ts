/**
 * Editor interaction types shared across layers (core ← runtime ← services ←
 * ui). Lives in `core` so both `runtime/render-host` and `services/ui/store`
 * can import it without a layering violation. Not serialized scene data — keep
 * it out of `scene/types.ts`.
 */
export type GizmoMode = "translate" | "rotate" | "scale";
