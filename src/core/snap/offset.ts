import { snapTranslation } from "./grid";
import { SNAP_PIXELS, snapToNodes, type SnapPoint } from "./nodes";
import { snapToSockets, type SocketPoint } from "./sockets";

type Vec3 = [number, number, number];

/**
 * Pure snap priority chain: socket-align → node-align (only when the dragged
 * node has no tagged socket) → grid fallback. Returns the world-space offset to
 * apply to the dragged object's position. Engine-neutral — both ThreeRenderHost
 * and BabylonRenderHost feed it engine-specific SnapPoint[]/SocketPoint[]. The
 * caller gates on translate-mode + modifier before calling.
 */
export function computeSnapOffset(args: {
  currentPos: Vec3;
  draggedFeatures: SnapPoint[];
  draggedSockets: SocketPoint[];
  hasSockets: boolean;
  targetFeatures: SnapPoint[];
  targetSockets: SocketPoint[];
}): Vec3 | null {
  const { currentPos, draggedFeatures, draggedSockets, hasSockets } = args;
  const socketOffset = snapToSockets(draggedSockets, args.targetSockets, SNAP_PIXELS);
  if (socketOffset) return socketOffset;
  if (!hasSockets) {
    const offset = snapToNodes(draggedFeatures, args.targetFeatures, SNAP_PIXELS);
    if (offset) return offset;
  }
  const [gx, gy, gz] = snapTranslation(currentPos);
  return [gx - currentPos[0], gy - currentPos[1], gz - currentPos[2]];
}
