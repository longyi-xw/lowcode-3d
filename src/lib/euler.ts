import { Euler, Quaternion } from "three";

type Quat = [number, number, number, number];
type Vec3 = [number, number, number];

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

const _q = new Quaternion();
const _e = new Euler(0, 0, 0, "XYZ");

export function quatToEulerDeg(q: Quat): Vec3 {
  _q.set(q[0], q[1], q[2], q[3]);
  _e.setFromQuaternion(_q, "XYZ");
  return [_e.x * RAD_TO_DEG, _e.y * RAD_TO_DEG, _e.z * RAD_TO_DEG];
}

export function eulerDegToQuat(eulerDeg: Vec3): Quat {
  _e.set(
    eulerDeg[0] * DEG_TO_RAD,
    eulerDeg[1] * DEG_TO_RAD,
    eulerDeg[2] * DEG_TO_RAD,
    "XYZ",
  );
  _q.setFromEuler(_e);
  return [_q.x, _q.y, _q.z, _q.w];
}
