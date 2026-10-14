import * as THREE from "three";
import { ll } from "./geo";

/** A camera key: time, eye (lat, lon, radius) and target (lat, lon, radius). */
export type CamKey = { t: number; eye: [number, number, number]; at: [number, number, number] };

const toV = (k: [number, number, number]) => ll(k[0], k[1]).normalize();

/** Catmull-Rom through keys; direction and radius are splined separately so the path never cuts the globe. */
const spline = (keys: CamKey[], t: number, pick: (k: CamKey) => [number, number, number]) => {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(keys.length - 1, i + 2)];
  const u = Math.max(0, Math.min(1, (t - k1.t) / (k2.t - k1.t)));
  const cr = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  const [a, b, c, d] = [toV(pick(k0)), toV(pick(k1)), toV(pick(k2)), toV(pick(k3))];
  const dir = new THREE.Vector3(cr(a.x, b.x, c.x, d.x), cr(a.y, b.y, c.y, d.y), cr(a.z, b.z, c.z, d.z)).normalize();
  return dir.multiplyScalar(cr(pick(k0)[2], pick(k1)[2], pick(k2)[2], pick(k3)[2]));
};

export const camPose = (keys: CamKey[], t: number) => ({ eye: spline(keys, t, (k) => k.eye), at: spline(keys, t, (k) => k.at) });

/** lat/lon of a world vector. */
export const latLon = (v: THREE.Vector3): [number, number] => {
  const lat = (Math.asin(v.y / v.length()) * 180) / Math.PI;
  const lon = (Math.atan2(v.z, -v.x) * 180) / Math.PI - 180;
  return [lat, ((lon + 540) % 360) - 180];
};
