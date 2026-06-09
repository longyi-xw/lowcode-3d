import { SNAP_PIXELS, type SnapPoint } from "./nodes";

/** socket 吸附候选点：SnapPoint（屏幕算像素门槛 + 世界算 offset）+ tag（兼容匹配）。 */
export interface SocketPoint extends SnapPoint {
  tag: string;
}

/** 在 dragged × targets 里，**tag 相同且非空**、屏幕距离 < pixelThreshold 的对中，
 *  按 **3D 世界距离** 选最近一对，返回把该 dragged socket 对齐到 target socket 的
 *  世界位移（target.world − dragged.world）；无命中 null。纯函数，无 three 依赖。 */
export function snapToSockets(
  dragged: readonly SocketPoint[],
  targets: readonly SocketPoint[],
  pixelThreshold: number = SNAP_PIXELS,
): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  let bestWorldDist = Infinity;
  for (const d of dragged) {
    if (!d.tag) continue;
    for (const t of targets) {
      if (t.tag !== d.tag) continue;
      const screenDist = Math.hypot(
        d.screen[0] - t.screen[0],
        d.screen[1] - t.screen[1],
      );
      if (screenDist >= pixelThreshold) continue;
      const worldDist = Math.hypot(
        d.world[0] - t.world[0],
        d.world[1] - t.world[1],
        d.world[2] - t.world[2],
      );
      if (worldDist < bestWorldDist) {
        bestWorldDist = worldDist;
        best = [
          t.world[0] - d.world[0],
          t.world[1] - d.world[1],
          t.world[2] - d.world[2],
        ];
      }
    }
  }
  return best;
}
