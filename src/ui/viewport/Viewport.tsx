import { useUIStore } from "@/services/ui/store";

import { BabylonViewport } from "./BabylonViewport";
import { ThreeViewport } from "./ThreeViewport";

/**
 * Engine-switching viewport wrapper (v1.0 B1). Each child owns its full
 * mount/teardown lifecycle; switching engines swaps the component type, so
 * React unmounts one and mounts the other — the viewports never know about
 * each other. Camera pose is intentionally not preserved across a switch.
 */
export function Viewport() {
  const engine = useUIStore((s) => s.viewportEngine);
  if (engine === "babylon.js") return <BabylonViewport />;
  return <ThreeViewport />;
}
