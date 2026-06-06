type Vec3 = readonly [number, number, number];

/** 默认网格吸附步长（单位）。GridHelper 是 10×10 单位；0.5 落在格点 + 格中点。 */
export const SNAP_STEP = 0.5;

/** 把世界坐标按 step 吸附到网格（每轴独立 round）。纯函数，无 three 依赖。
 *  step <= 0 时原样返回（防御）。吸附引擎的第一个 snapper（grid）；sub-stage
 *  B/C 往本目录加 snapToNodes / snapToSockets。 */
export function snapTranslation(
  position: Vec3,
  step: number = SNAP_STEP,
): [number, number, number] {
  if (!(step > 0)) return [position[0], position[1], position[2]];
  return [
    Math.round(position[0] / step) * step,
    Math.round(position[1] / step) * step,
    Math.round(position[2] / step) * step,
  ];
}
