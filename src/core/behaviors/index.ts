/**
 * Engine-neutral behaviors namespace.
 *
 * Intentionally empty in Phase 3: all data + implementations currently live
 * under `src/runtime/three/behaviors/`. When a second adapter (e.g. Babylon)
 * lands, the shared `BehaviorDefinition` metadata moves here and each adapter
 * keeps its engine-specific Behavior implementations under its own runtime
 * directory.
 *
 * Do not add Three-specific imports here.
 */
export {};
