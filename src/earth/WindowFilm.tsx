/**
 * Film 3 — "Own a window".
 * A full share is a whole tower; fractional investing lets you own one window. One window → the tower it belongs to →
 * back to that window, which turns warm → a pull-back over a city of 5,250 towers where one warm window lights in each.
 * Procedural city: every window is drawn in the shader from the tower's world-space faces, so there are no textures.
 */
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FPS, tw } from "../theme";
import { rng } from "./Earth";
import { Caps, EndCard, FOOTNOTE, Grain, Sound, Vignette } from "./ui";

const T = { warm: 14.6, wave: 18.0, count: 23.6, logo: 27.6 };
const GX = 75;
const GZ = 70; // 5,250 towers
const SP = 15;
const CW = 1.3; // window column width
const FH = 1.6; // floor height
const HERO_W = 20;
const HERO_H = 150;
// the hero window: column 0 (x 0..1.3), floor 40, on the hero's front face (z = +10)
const HW = new THREE.Vector3(CW / 2, 40 * FH + FH / 2, HERO_W / 2);

const vert = /* glsl */ `
attribute vec4 info; // seed, ownedOn (s), isHero, height
varying vec3 vW; varying vec3 vN; varying vec4 vInfo;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(instanceMatrix) * normal); vInfo = info;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform float time, heroWarm, heroGlow;
uniform vec3 heroCell; // column index, floor index, face
uniform vec3 fogCol;
varying vec3 vW; varying vec3 vN; varying vec4 vInfo;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float band(float x, float a, float b, float fw){ return clamp((x - a) / fw + 0.5, 0.0, 1.0) * clamp((b - x) / fw + 0.5, 0.0, 1.0); }
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float dist = length(cameraPosition - vW);
  float seed = vInfo.x;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  // dark glass facade reflecting a sky that glows toward the horizon
  vec3 sky = mix(vec3(0.10, 0.12, 0.20), vec3(0.02, 0.03, 0.06), clamp(vW.y / 160.0, 0.0, 1.0));
  vec3 col = vec3(0.008, 0.012, 0.022) + sky * (0.25 + 0.75 * fres);
  float fogK = 1.0 - exp(-dist * 0.0009);
  if (n.y > 0.5) { gl_FragColor = vec4(mix(col * 0.6, fogCol, fogK), 1.0); return; }
  float face = abs(n.x) > 0.5 ? (n.x > 0.0 ? 0.0 : 1.0) : (n.z > 0.0 ? 2.0 : 3.0);
  float u = abs(n.x) > 0.5 ? vW.z : vW.x;
  float vv = vW.y;
  float cu = u / ${CW.toFixed(2)}, cv = vv / ${FH.toFixed(2)};
  vec2 cell = vec2(floor(cu), floor(cv));
  vec2 f = vec2(fract(cu), fract(cv));
  vec2 fw = vec2(fwidth(cu), fwidth(cv)) + 1e-4;
  float win = band(f.x, 0.07, 0.93, fw.x) * band(f.y, 0.12, 0.9, fw.y);
  float r = h21(cell + vec2(seed * 91.7, face * 13.1));
  float r2 = h21(cell.yx + vec2(seed * 17.3 + 3.1, face));
  float lit = step(0.8, r);
  vec3 tone = mix(vec3(0.62, 0.7, 0.85), vec3(1.0, 0.8, 0.55), step(0.55, r2));
  float lamp = 0.55 + 0.45 * (1.0 - length(f - vec2(0.5, 0.35)) * 1.4);
  vec3 room = tone * (0.18 + 0.55 * r2) * lamp * lit;
  vec3 glass = vec3(0.015, 0.022, 0.04) + sky * 0.5 * fres;
  vec3 w = glass + room;
  // the hero window: cool, then warm when you own it
  float isHero = vInfo.z * step(abs(cell.x - heroCell.x), 0.5) * step(abs(cell.y - heroCell.y), 0.5) * step(abs(face - heroCell.z), 0.5);
  vec3 cool = vec3(0.62, 0.72, 0.92) * (0.75 + 0.35 * lamp);
  vec3 warm = vec3(1.0, 0.55, 0.17) * (0.8 + 0.25 * lamp);
  vec3 hero = min(mix(cool, warm, heroWarm) * (1.0 + heroGlow), vec3(1.0));
  w = mix(w, hero, isHero);
  vec3 sharp = mix(col, w, win);
  // far away: average of the facade instead of shimmering sub-pixel windows
  float px = max(fw.x, fw.y);
  vec3 avg = col * 0.25 + glass * 0.35 + vec3(0.75, 0.68, 0.55) * 0.2 * 0.3 * 0.5;
  vec3 c = mix(sharp, avg, smoothstep(0.18, 0.5, px));
  c = mix(c, fogCol, fogK);
  gl_FragColor = vec4(c, 1.0);
}`;

type Tower = { x: number; z: number; w: number; d: number; h: number; seed: number; on: number; hero: boolean; win: THREE.Vector3 };
const useCity = () =>
  useMemo(() => {
    const r = rng(23);
    const towers: Tower[] = [];
    for (let gz = 0; gz < GZ; gz++)
      for (let gx = 0; gx < GX; gx++) {
        const x0 = (gx - (GX - 1) / 2) * SP;
        const z0 = -gz * SP - SP * 0.2;
        if (Math.abs(x0) < SP && Math.abs(z0) < SP) continue; // the hero's plot
        const w = 6 + r() * 6;
        const d = 6 + r() * 6;
        const centre = Math.exp(-Math.hypot(x0, z0 + 200) / 380);
        const h = 12 + Math.pow(r(), 2.2) * 110 * (0.4 + centre);
        const x = x0 + (r() - 0.5) * (SP - w) * 0.8;
        const z = z0 + (r() - 0.5) * (SP - d) * 0.8;
        const dd = Math.hypot(x, z);
        // the warm window: a front-facing window on this tower, chosen so it is visible from the city's south
        const col = Math.floor((x - w / 2 + 1 + r() * (w - 2)) / CW);
        const fl = Math.floor((4 + r() * (h - 8)) / FH);
        towers.push({ x, z, w, d, h, seed: r(), on: T.wave + dd * 0.0068 + r() * 0.3, hero: false, win: new THREE.Vector3((col + 0.5) * CW, (fl + 0.5) * FH, z + d / 2 + 0.05) });
      }
    // the hero tower at the origin, in front of everything
    towers.push({ x: 0, z: 0, w: HERO_W, d: HERO_W, h: HERO_H, seed: 0.5, on: 999, hero: true, win: HW.clone() });
    return towers;
  }, []);

const pointsVert = /* glsl */ `
attribute float alpha;
uniform float scale;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(4.0 * scale / -mv.z, 7.0, 18.0);
  vA = alpha;
}`;
const pointsFrag = /* glsl */ `
varying float vA;
void main(){
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = dot(p, p);
  if (r > 1.0) discard;
  gl_FragColor = vec4(vec3(1.0, 0.6, 0.22) * (exp(-r * 10.0) * 1.4 + 0.35 * exp(-r * 2.5)) * vA, 1.0);
}`;

/* camera: Catmull-Rom through world-space keys */
type K = { t: number; p: [number, number, number]; l: [number, number, number]; ease?: boolean };
const KEYS: K[] = [
  { t: -1, p: [HW.x + 0.15, HW.y + 0.05, HW.z + 1.7], l: [HW.x, HW.y, HW.z] },
  { t: 0, p: [HW.x + 0.2, HW.y + 0.05, HW.z + 1.9], l: [HW.x, HW.y, HW.z] },
  { t: 3.5, p: [HW.x + 1.6, HW.y - 1.0, HW.z + 14], l: [HW.x, HW.y + 1.5, HW.z] },
  { t: 7.5, p: [8, 6, 95], l: [0, 70, 0] },
  { t: 11.2, p: [-6, 2.5, 34], l: [0, 120, 0] },
  { t: 13.6, p: [HW.x + 1.2, HW.y + 0.6, HW.z + 5.5], l: [HW.x, HW.y, HW.z], ease: true },
  { t: 17.6, p: [HW.x + 2.4, HW.y + 1.2, HW.z + 9], l: [HW.x, HW.y, HW.z], ease: true },
  { t: 21.0, p: [50, 150, 200], l: [0, 40, -160] },
  { t: 24.5, p: [80, 175, 330], l: [0, 30, -420] },
  { t: 28.5, p: [92, 190, 375], l: [0, 30, -470] },
];
const camAt = (t: number, key: "p" | "l") => {
  let i = 0;
  while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const k0 = KEYS[Math.max(0, i - 1)], k1 = KEYS[i], k2 = KEYS[i + 1], k3 = KEYS[Math.min(KEYS.length - 1, i + 2)];
  const dt = k2.t - k1.t;
  const u = Math.max(0, Math.min(1, (t - k1.t) / dt));
  // non-uniform Catmull-Rom (Hermite, tangents in units per second) so uneven key spacing never overshoots
  const tan = (a: K, b: K, j: number) => (b[key][j] - a[key][j]) / Math.max(0.001, b.t - a.t);
  const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
  return new THREE.Vector3(
    ...([0, 1, 2].map((j) => {
      const m1 = k1.ease ? 0 : k0 === k1 ? tan(k1, k2, j) : tan(k0, k2, j);
      const m2 = k2.ease ? 0 : k3 === k2 ? tan(k1, k2, j) : tan(k1, k3, j);
      return h00 * k1[key][j] + h10 * dt * m1 + h01 * k2[key][j] + h11 * dt * m2;
    }) as [number, number, number]),
  );
};

const FOG = new THREE.Color(0.06, 0.07, 0.11);
const Scene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, invalidate, size, gl } = useThree();
  const towers = useCity();
  const { mesh, mat } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const info = new THREE.InstancedBufferAttribute(new Float32Array(towers.length * 4), 4);
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { time: { value: 0 }, heroWarm: { value: 0 }, heroGlow: { value: 0 }, heroCell: { value: new THREE.Vector3(0, 40, 2) }, fogCol: { value: FOG } },
    });
    const im = new THREE.InstancedMesh(g, m, towers.length);
    const m4 = new THREE.Matrix4();
    towers.forEach((tw, i) => {
      m4.makeScale(tw.w, tw.h, tw.d).setPosition(tw.x, 0, tw.z);
      im.setMatrixAt(i, m4);
      info.setXYZW(i, tw.seed, tw.hero ? 999 : 999, tw.hero ? 1 : 0, tw.h);
    });
    g.setAttribute("info", info);
    im.frustumCulled = false;
    return { mesh: im, mat: m };
  }, [towers]);
  const pts = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(towers.length * 3);
    towers.forEach((tw, i) => p.set([tw.win.x, tw.win.y, tw.win.z], i * 3));
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(towers.length), 1));
    const m = new THREE.ShaderMaterial({ vertexShader: pointsVert, fragmentShader: pointsFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { scale: { value: 1 } } });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    return o;
  }, [towers]);


  const halo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([HW.x, HW.y, HW.z + 0.3]), 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: `uniform float scale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(6.0 * scale / -mv.z, 4.0, 900.0); }`,
      fragmentShader: `uniform float a; void main(){ vec2 p = gl_PointCoord*2.0-1.0; float r = dot(p,p); if (r>1.0) discard; gl_FragColor = vec4(vec3(1.0,0.5,0.15) * exp(-r*4.0) * a, 1.0); }`,
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 1 }, a: { value: 0 } },
    });
    const o = new THREE.Points(g, m);
    o.frustumCulled = false;
    return o;
  }, []);

  useLayoutEffect(() => {
    const hm = halo.material as THREE.ShaderMaterial;
    hm.uniforms.a.value = 0.45 * tw(t, T.warm, T.warm + 1.2) + 0.5 * Math.exp(-Math.pow((t - T.warm - 0.4) / 0.5, 2));
    hm.uniforms.scale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((35 * Math.PI) / 360));
    mat.uniforms.time.value = t;
    mat.uniforms.heroWarm.value = tw(t, T.warm, T.warm + 1.2);
    mat.uniforms.heroGlow.value = 0.6 * Math.exp(-Math.pow((t - T.warm - 0.4) / 0.5, 2));
    const a = pts.geometry.attributes.alpha.array as Float32Array;
    towers.forEach((tw, i) => {
      const k = t - tw.on;
      a[i] = tw.hero ? 0 : k < 0 ? 0 : Math.min(1, k * 3) * 0.9 + Math.exp(-k * 3) * 0.8;
    });
    pts.geometry.attributes.alpha.needsUpdate = true;
    (pts.material as THREE.ShaderMaterial).uniforms.scale.value = (size.height * gl.getPixelRatio()) / (2 * Math.tan((35 * Math.PI) / 360));
    const cp = camAt(t, "p");
    // never pass inside the hero tower
    if (Math.abs(cp.x) < HERO_W / 2 + 1 && cp.y < HERO_H + 1 && cp.z < HERO_W / 2 + 1.2) cp.z = HERO_W / 2 + 1.2;
    camera.position.copy(cp);
    camera.up.set(0, 1, 0);
    camera.lookAt(camAt(t, "l"));
    invalidate();
  });

  return (
    <>
      <primitive object={mesh} />
      <primitive object={pts} />
      <primitive object={halo} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -400]}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color={new THREE.Color(0.012, 0.018, 0.03)} />
      </mesh>
    </>
  );
};

export const WindowFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const fadeIn = tw(t, 0, 1.0, 0, 1, (x) => x);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #01030a 0%, #06101f 45%, #13213a 62%, #2a2f45 70%, #12192a 100%)" }}>
      <ThreeCanvas
        width={1920}
        height={1080}
        dpr={1}
        camera={{ fov: 35, near: 0.05, far: 3000, position: [0, 60, 20] }}
        gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene t={t} />
      </ThreeCanvas>
      <Vignette />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeIn }} />

      <Caps t={t} at={8.6} out={13.2} y={150}>
        YOU DON&apos;T NEED THE WHOLE BUILDING.
      </Caps>
      <Caps t={t} at={T.warm + 0.3} out={19.6} y={150}>
        OWN A WINDOW. FROM $1.*
      </Caps>
      <Caps t={t} at={T.count} out={T.logo - 0.3} y={150}>
        5,000+ US STOCKS AND ETFS.
      </Caps>
      <Caps t={t} at={T.warm + 0.9} out={T.logo - 0.3} y={985} size={15} dim>
        {FOOTNOTE}
      </Caps>

      <EndCard t={t} at={T.logo} />
      <Grain frame={frame} id="grainC" />
      <Sound
        cues={[
          [0.2, "shimmer", 0.3],
          [3.4, "whoosh", 0.3],
          [7.4, "thud", 0.35],
          [11.0, "riser", 0.35],
          [12.6, "whoosh", 0.45],
          [T.warm, "unlock", 0.5],
          [T.warm + 0.1, "chime", 0.45],
          [17.6, "whoosh", 0.4],
          [T.wave + 0.2, "shimmer", 0.45],
          [T.wave + 0.5, "rattle", 0.25],
          [T.count, "swish", 0.25],
          [T.logo - 0.45, "whoosh", 0.25],
          [T.logo, "sting", 0.7],
        ]}
      />
    </AbsoluteFill>
  );
};
