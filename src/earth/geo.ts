import * as THREE from "three";

/** Lat/lon in degrees → unit vector, matching three.js SphereGeometry's equirectangular UVs (lon 0 at +x). */
export const ll = (lat: number, lon: number, r = 1) => {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const la = (lat * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(phi) * Math.cos(la) * r);
};

/** Sun direction for a subsolar point. */
export const sunDir = (lat: number, lon: number) => ll(lat, lon).normalize();

/** Major Indian cities (approximate lat, lon). They flare as the evening reaches them. */
export const CITIES: [string, number, number][] = [
  ["Imphal", 24.82, 93.94],
  ["Shillong", 25.58, 91.89],
  ["Guwahati", 26.14, 91.74],
  ["Siliguri", 26.73, 88.4],
  ["Kolkata", 22.57, 88.36],
  ["Bhubaneswar", 20.3, 85.82],
  ["Patna", 25.59, 85.14],
  ["Ranchi", 23.34, 85.31],
  ["Visakhapatnam", 17.69, 83.22],
  ["Varanasi", 25.32, 82.97],
  ["Raipur", 21.25, 81.63],
  ["Lucknow", 26.85, 80.95],
  ["Vijayawada", 16.51, 80.65],
  ["Kanpur", 26.45, 80.33],
  ["Chennai", 13.08, 80.27],
  ["Nagpur", 21.15, 79.09],
  ["Hyderabad", 17.39, 78.49],
  ["Madurai", 9.93, 78.12],
  ["Dehradun", 30.32, 78.03],
  ["Agra", 27.18, 78.01],
  ["Bengaluru", 12.97, 77.59],
  ["Bhopal", 23.26, 77.41],
  ["Delhi", 28.61, 77.21],
  ["Coimbatore", 11.02, 76.96],
  ["Thiruvananthapuram", 8.52, 76.94],
  ["Chandigarh", 30.73, 76.78],
  ["Kochi", 9.93, 76.27],
  ["Indore", 22.72, 75.86],
  ["Jaipur", 26.91, 75.79],
  ["Amritsar", 31.63, 74.87],
  ["Mangaluru", 12.91, 74.86],
  ["Srinagar", 34.08, 74.8],
  ["Pune", 18.52, 73.86],
  ["Goa", 15.49, 73.83],
  ["Udaipur", 24.58, 73.71],
  ["Jodhpur", 26.24, 73.02],
  ["Mumbai", 19.08, 72.88],
  ["Surat", 21.17, 72.83],
  ["Ahmedabad", 23.02, 72.57],
  ["Rajkot", 22.3, 70.8],
];

/** Point on the great circle from a to b at s (0..1), lifted by h above the surface. */
export const arcPoint = (a: THREE.Vector3, b: THREE.Vector3, s: number, h: number, out = new THREE.Vector3()) => {
  const omega = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  const so = Math.sin(omega);
  const k1 = Math.sin((1 - s) * omega) / so;
  const k2 = Math.sin(s * omega) / so;
  out.set(a.x * k1 + b.x * k2, a.y * k1 + b.y * k2, a.z * k1 + b.z * k2);
  return out.multiplyScalar(1 + h);
};
