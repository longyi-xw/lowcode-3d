/** 一个吸附候选点：屏幕坐标（算像素距离）+ 世界坐标（算对齐 offset）。 */
export interface SnapPoint {
  screen: readonly [number, number];
  world: readonly [number, number, number];
}

/** 节点吸附的屏幕像素阈值。 */
export const SNAP_PIXELS = 12;

/** 在 dragged × targets 里，屏幕距离 < pixelThreshold 的候选对中，选 **3D 世界
 *  距离最近** 的一对，返回把该 dragged 点对齐到该 target 点所需的世界位移
 *  （target.world − dragged.world）；无命中返回 null。纯函数，无 three 依赖。
 *
 *  屏幕像素只做"够不够近才考虑吸"的门槛；最终按世界距离选，避免平行/侧视角下
 *  远近两个目标屏幕投影重叠时吸到 3D 空间里较远的那个。 */
export function snapToNodes(
  dragged: readonly SnapPoint[],
  targets: readonly SnapPoint[],
  pixelThreshold: number = SNAP_PIXELS,
): [number, number, number] | null {
  let best: [number, number, number] | null = null;
  let bestWorldDist = Infinity;
  for (const d of dragged) {
    for (const t of targets) {
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
