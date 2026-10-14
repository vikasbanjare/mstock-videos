/**
 * Film 4 — "One tap away".
 * A tap in Lucknow, Guwahati, Jaipur, Chennai, Ludhiana: each releases one warm orb of light. Then taps all over
 * India; the orbs gather over the Arabian Sea and stream west as one river, low over the planet, to the US.
 * The river's head becomes one orb that touches one tile in a wall of 5,040 — and the wall lights up.
 */
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { geoContains } from "d3-geo";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FPS, inOut, tw } from "../theme";
import { CamKey, camPose, latLon } from "./cam";
import { countryFeature, GlowPoints, Globe, rng, Stars, Tex, useEarthTextures } from "./Earth";
import { arcPoint, CITIES, ll, sunDir } from "./geo";
import { Caps, EndCard, FOOTNOTE, Grain, Sound, Vignette } from "./ui";

const T = { mass: 11.8, river: 15.0, flash: 20.9, wall: 21.5, hit: 22.4, logo: 27.6 };
const SUN = sunDir(-8, -14);
const G = ll(19, 66).normalize();
const E = ll(40.7, -74).normalize();
const SPINE = 5.6;

const HEROES: [string, number, number, number][] = [
  ["Lucknow", 26.85, 80.95, 1.0],
  ["Guwahati", 26.14, 91.74, 3.4],
  ["Jaipur", 26.91, 75.79, 5.8],
  ["Chennai", 13.08, 80.27, 8.1],
  ["Ludhiana", 30.9, 75.85, 10.3],
];

/* ---------------------------------------------------------------- orbs */
type Orb = { a: THREE.Vector3; dep: number; arrA: number; durA: number; start: number; off: THREE.Vector3; orbit: number; ph: number; w: number; hero: boolean };
const useOrbs = () =>
  useMemo(() => {
    const r = rng(11);
    const india = countryFeature("356");
    const orbs: Orb[] = [];
    const make = (lat: number, lon: number, dep: number, hero: boolean) => {
      const a = ll(lat, lon).normalize();
      const ang = (a.angleTo(G) * 180) / Math.PI;
      const durA = (hero ? 2.6 : 1.3) + ang * 0.09;
      const t1 = new THREE.Vector3().crossVectors(G, new THREE.Vector3(0, 1, 0)).normalize();
      const t2 = new THREE.Vector3().crossVectors(G, t1).normalize();
      const off = t1.multiplyScalar((r() - 0.5) * 2).addScaledVector(t2, (r() - 0.5) * 2);
      const arrA = dep + 0.9 + durA;
      orbs.push({ a, dep, arrA, durA, start: Math.max(arrA, T.river + r() * 1.4), off, orbit: 0.006 + r() * 0.02, ph: r() * 6.28, w: r(), hero });
    };
    HEROES.forEach(([, lat, lon, at]) => make(lat, lon, at, true));
    let n = 0;
    while (n < 950) {
      let lat: number, lon: number;
      if (r() < 0.55) {
        const c = CITIES[Math.floor(r() * CITIES.length)];
        lat = c[1] + (r() - 0.5) * 1.4;
        lon = c[2] + (r() - 0.5) * 1.4;
      } else {
        lat = 8 + r() * 28;
        lon = 68 + r() * 29;
        if (!geoContains(india, [lon, lat])) continue;
      }
      // the wave of taps sweeps the country; finish so every orb can reach the gathering point in time
      const dep = T.mass + r() * 2.6;
      make(lat, lon, dep, false);
      n++;
    }
    return orbs;
  }, []);

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const tmp = new THREE.Vector3();
/** Where an orb is at time t (null = not born / gone). */
const orbAt = (q: Orb, t: number, out: THREE.Vector3): number => {
  if (t < q.dep) return 0;
  const u = (t - q.dep) / 0.9;
  if (u < 1) {
    out.copy(q.a).multiplyScalar(1.002 + 0.03 * (1 - Math.pow(1 - u, 3)));
    return Math.min(1, u * 4);
  }
  const ua = (t - q.dep - 0.9) / q.durA;
  if (ua < 1) {
    const e = ease(ua);
    arcPoint(q.a, G, e, 0, out).normalize().multiplyScalar(1.032 + 0.03 * Math.sin(Math.PI * e));
    return 1;
  }
  if (t < q.start) {
    // hover in the gathering cloud
    const k = (t - q.arrA) * 1.4 + q.ph;
    out.copy(G).multiplyScalar(1.032).addScaledVector(q.off, q.orbit * (0.6 + 0.4 * Math.sin(k)));
    out.y += Math.sin(k * 0.7) * 0.004;
    return 1;
  }
  const s = (t - q.start) / (SPINE * (0.92 + 0.16 * q.w));
  if (s > 1.03) return 0;
  arcPoint(G, E, Math.min(1, s), 0, out).normalize().multiplyScalar(1.03 + 0.014 * Math.sin(Math.PI * Math.min(1, s)));
  tmp.copy(q.off).multiplyScalar(q.orbit * (0.5 + 0.8 * Math.sin(Math.PI * Math.min(1, s))));
  out.add(tmp);
  return s > 1 ? Math.max(0, 1 - (s - 1) * 33) : 1;
};

/* ---------------------------------------------------------------- camera */
const spineLL = (s: number, r: number): [number, number, number] => {
  const p = arcPoint(G, E, s, 0);
  const [lat, lon] = latLon(p);
  return [lat, lon, r];
};
const sMed = (t: number) => (t - T.river - 0.75) / SPINE;
const KEYS: CamKey[] = [
  // low and oblique, always looking west toward the evening glow, the city just below centre
  { t: -1, eye: [25.6, 92.6, 1.1], at: [26.9, 80.6, 1.004] },
  ...HEROES.flatMap(([, lat, lon, at]) => [
    { t: at - 0.45, eye: [lat - 1.2, lon + 10.5, 1.1] as [number, number, number], at: [lat, lon - 0.3, 1.004] as [number, number, number] },
    { t: at + 1.0, eye: [lat - 0.9, lon + 9.6, 1.112] as [number, number, number], at: [lat + 0.2, lon - 0.7, 1.012] as [number, number, number] },
  ]),
  { t: 12.4, eye: [17, 80, 1.95], at: [21, 77, 0.45] },
  { t: 14.0, eye: [14, 74, 2.0], at: [19, 68, 0.6] },
  { t: 15.4, eye: spineLL(sMed(15.4) - 0.07, 1.16), at: spineLL(sMed(15.4) + 0.03, 1.01) },
  ...[16.6, 17.8, 19.0, 20.2, 21.4].map((tt) => ({ t: tt, eye: spineLL(sMed(tt) - 0.045, 1.095), at: spineLL(sMed(tt) + 0.07, 1.0) })),
];

const TRAIL = 6;
const GlobeScene: React.FC<{ t: number; tex: Tex }> = ({ t, tex }) => {
  const { camera, invalidate } = useThree();
  const orbs = useOrbs();
  useLayoutEffect(() => {
    const { eye, at } = camPose(KEYS, t);
    camera.position.copy(eye);
    const far = Math.max(0, Math.min(1, (eye.length() - 1.25) / 0.5));
    camera.up.copy(eye).normalize().lerp(new THREE.Vector3(0, 1, 0), far).normalize();
    camera.lookAt(at);
    invalidate();
  }, [t, camera, invalidate]);

  const orbFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      const p = new THREE.Vector3();
      orbs.forEach((q, i) => {
        for (let k = 0; k < TRAIL; k++) {
          const j = i * TRAIL + k;
          const a = orbAt(q, t - k * 0.035, p);
          pos.set([p.x, p.y, p.z], j * 3);
          const head = k === 0 ? 1 : 0.5 * Math.pow(1 - k / TRAIL, 1.4);
          const crowd = t > q.arrA && t < q.start + 0.6 ? 0.45 : 1;
          alpha[j] = a * head * (q.hero ? 1.2 : (0.6 + 0.3 * q.w) * crowd);
          size[j] = a > 0 ? (q.hero ? (k === 0 ? 0.014 : 0.008) : k === 0 ? 0.0075 : 0.005) : 0;
          tint.set(q.w > 0.82 ? [1, 0.55, 0.16] : [1, 0.74, 0.4], j * 3);
        }
      });
    },
    [orbs, t],
  );

  const RING = 28;
  const ringFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      const e1 = new THREE.Vector3();
      const e2 = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      orbs.forEach((q, i) => {
        const k = (t - (q.dep - 0.25)) / (q.hero ? 1.1 : 0.8);
        e1.crossVectors(q.a, up).normalize();
        e2.crossVectors(q.a, e1).normalize();
        const R = (q.hero ? 0.012 : 0.0032) * (1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3));
        const A = k < 0 || k > 1 ? 0 : (1 - k) * (q.hero ? 0.9 : 0.5);
        for (let m = 0; m < RING; m++) {
          const j = i * RING + m;
          const th = (m / RING) * Math.PI * 2;
          const v = q.a.clone().multiplyScalar(1.002).addScaledVector(e1, Math.cos(th) * R).addScaledVector(e2, Math.sin(th) * R);
          pos.set([v.x, v.y, v.z], j * 3);
          size[j] = A > 0 ? (q.hero ? 0.0022 : 0.0016) : 0;
          alpha[j] = A;
          tint.set([1, 0.82, 0.55], j * 3);
        }
      });
    },
    [orbs, t],
  );

  const lights = tw(t, 0, 2, 0.9, 1.25) + 0.35 * tw(t, T.mass, T.mass + 3, 0, 1, (x) => x);
  return (
    <>
      <Stars t={t} gain={0.7} />
      <Globe tex={tex} sun={SUN} maskLights={lights} worldLights={0.45} lightsGain={2.4} clouds={0.5} cloudSpin={t * 0.003} dayGain={1.2} />
      <GlowPoints count={orbs.length * RING} fill={ringFill} t={t} maxPx={6} />
      <GlowPoints count={orbs.length * TRAIL} fill={orbFill} t={t} maxPx={24} nearFade={0.03} />
    </>
  );
};

/* ---------------------------------------------------------------- the wall */
const NX = 105;
const NY = 48; // 5,040 tiles
const HERO = { ix: 63, iy: 29 };
const tileX = (ix: number) => (ix - (NX - 1) / 2) * 1.12;
const tileY = (iy: number) => (iy - (NY - 1) / 2) * 1.12;
const HP = new THREE.Vector3(tileX(HERO.ix), tileY(HERO.iy), 0);

const tileVert = /* glsl */ `
attribute float lit;
varying vec3 vN; varying vec3 vW; varying float vLit; varying vec2 vUv;
void main(){
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vLit = lit; vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const tileFrag = /* glsl */ `
varying vec3 vN; varying vec3 vW; varying float vLit; varying vec2 vUv;
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
  vec3 base = vec3(0.012, 0.022, 0.04);
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), v), 0.0), 50.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = base + vec3(0.03, 0.05, 0.08) * diff + vec3(0.6, 0.7, 0.85) * spec * 0.18 + vec3(0.1, 0.16, 0.26) * fres * 0.25;
  float front = step(0.5, n.z);
  vec2 c = vUv - 0.5;
  float core = 1.0 - smoothstep(0.0, 0.75, length(c) * 1.4);
  vec3 orange = vec3(0.96, 0.51, 0.125);
  vec3 gold = vec3(1.0, 0.8, 0.5);
  vec3 em = mix(orange, gold, core * 0.7) * (0.55 + 0.6 * core);
  col += em * vLit * (front + (1.0 - front) * 0.35) * 1.1;
  gl_FragColor = vec4(col, 1.0);
}`;

const useWall = () =>
  useMemo(() => {
    const r = rng(5);
    const tiles = [];
    for (let iy = 0; iy < NY; iy++)
      for (let ix = 0; ix < NX; ix++) {
        const d = Math.hypot(ix - HERO.ix, (iy - HERO.iy) * 1.1);
        const hero = ix === HERO.ix && iy === HERO.iy;
        tiles.push({ ix, iy, on: hero ? T.hit : T.hit + 0.25 + d * 0.03 + r() * 0.35, lvl: hero ? 1.25 : r() < 0.3 ? 0.06 + 0.12 * r() : 0.4 + 0.6 * Math.pow(r(), 0.7), tw: r() * 6.28, hero });
      }
    return tiles;
  }, []);

const WallScene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, invalidate } = useThree();
  const tiles = useWall();
  const { geo, mat, lit } = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 0.22);
    const l = new THREE.InstancedBufferAttribute(new Float32Array(NX * NY), 1);
    g.setAttribute("lit", l);
    const m = new THREE.ShaderMaterial({ vertexShader: tileVert, fragmentShader: tileFrag });
    return { geo: g, mat: m, lit: l };
  }, []);
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geo, mat, NX * NY);
    const m4 = new THREE.Matrix4();
    tiles.forEach((tl, i) => {
      m4.makeTranslation(tileX(tl.ix), tileY(tl.iy), 0);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, [geo, mat, tiles]);

  const level = (tl: (typeof tiles)[number]) => {
    const k = t - tl.on;
    if (k < 0) return 0;
    const pop = Math.exp(-k * 2.5) * 0.8;
    return Math.min(1, k * 5) * tl.lvl * (0.92 + 0.08 * Math.sin(t * 2.2 + tl.tw)) + pop * tl.lvl;
  };

  useLayoutEffect(() => {
    const arr = lit.array as Float32Array;
    tiles.forEach((tl, i) => (arr[i] = level(tl)));
    lit.needsUpdate = true;
    // camera: rides in behind the orb, then one long pull back to the whole wall
    const back = tw(t, T.hit + 0.15, T.logo - 0.2, 0, 1, inOut);
    const close = new THREE.Vector3(HP.x + 1.0, HP.y + 0.35, 3.6 - tw(t, T.wall, T.hit, 0, 0.9, inOut));
    const far = new THREE.Vector3(-22, -3, 118);
    camera.position.copy(close).lerp(far, back);
    const look = HP.clone().lerp(new THREE.Vector3(0, 7, 0), back);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    invalidate();
  });

  const orbFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      // the orb flies in from the camera to the hero tile
      for (let k = 0; k < TRAIL; k++) {
        const tt = t - k * 0.03;
        const u = Math.max(0, Math.min(1, (tt - T.wall) / (T.hit - T.wall)));
        const e = u * u * (3 - 2 * u);
        const from = new THREE.Vector3(HP.x + 0.6, HP.y + 0.2, 2.2);
        const p = from.lerp(new THREE.Vector3(HP.x, HP.y, 0.2), e);
        pos.set([p.x, p.y, p.z], k * 3);
        const a = tt < T.hit ? 1 : Math.max(0, 1 - (tt - T.hit) * 6);
        alpha[k] = a * (k === 0 ? 1.3 : 0.5 * (1 - k / TRAIL));
        size[k] = k === 0 ? 0.28 : 0.16;
        tint.set([1, 0.78, 0.45], k * 3);
      }
    },
    [t],
  );
  const bloomFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      tiles.forEach((tl, i) => {
        pos.set([tileX(tl.ix), tileY(tl.iy), 0.25], i * 3);
        const l = level(tl);
        size[i] = tl.hero ? 3.2 : 2.0;
        alpha[i] = l * (tl.hero ? 0.5 : 0.14);
        tint.set([1, 0.55, 0.18], i * 3);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tiles, t],
  );
  return (
    <>
      <primitive object={mesh} />
      <GlowPoints count={NX * NY} fill={bloomFill} t={t} depthTest={false} />
      <GlowPoints count={TRAIL} fill={orbFill} t={t} depthTest={false} />
    </>
  );
};

/* ---------------------------------------------------------------- film */
export const TapFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tex = useEarthTextures(["356"]);
  const fadeIn = tw(t, 0, 1.0, 0, 1, (x) => x);
  // the river's head becomes one orb that fills the frame, then shrinks into the orb in the hall
  const grow = tw(t, T.flash, T.wall, 0, 1, (x) => x * x * x);
  const shrink = tw(t, T.wall, T.wall + 0.45, 0, 1, (x) => 1 - Math.pow(1 - x, 3));
  const flash = t < T.wall ? grow : 1 - shrink;
  const gl = { antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace };

  return (
    <AbsoluteFill style={{ background: "#02040a" }}>
      {t < T.wall ? (
        tex ? (
          <ThreeCanvas width={1920} height={1080} dpr={1} camera={{ fov: 35, near: 0.005, far: 200, position: [0, 0, 3] }} gl={gl} style={{ position: "absolute", inset: 0 }}>
            <GlobeScene t={t} tex={tex} />
          </ThreeCanvas>
        ) : null
      ) : (
        <ThreeCanvas width={1920} height={1080} dpr={1} camera={{ fov: 35, near: 0.05, far: 600, position: [0, 0, 10] }} gl={gl} style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, #0a1322 0%, #02040a 70%)" }}>
          <WallScene t={t} />
        </ThreeCanvas>
      )}

      {flash > 0.001 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255,236,200,${Math.min(1, flash * 1.4)}) 0%, rgba(245,130,32,${0.85 * flash}) ${8 + 40 * flash}%, rgba(245,130,32,0) ${20 + 80 * flash}%)`,
          }}
        />
      ) : null}

      <Vignette />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(2,4,10,0.75) 0%, rgba(2,4,10,0) 32%)", opacity: tw(t, 24.0, 24.6) }} />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeIn }} />

      <Caps t={t} at={T.mass + 1.2} out={16.8} y={150}>
        WHEREVER YOU ARE IN INDIA,
      </Caps>
      <Caps t={t} at={17.2} out={T.flash + 0.1} y={150}>
        THE US MARKET IS ONE TAP AWAY.
      </Caps>
      <Caps t={t} at={24.4} out={T.logo - 0.3} y={150}>
        5,000+ US STOCKS AND ETFS. FROM $1.*
      </Caps>
      <Caps t={t} at={25.0} out={T.logo - 0.3} y={985} size={15} dim>
        {FOOTNOTE}
      </Caps>

      <EndCard t={t} at={T.logo} />
      <Grain frame={frame} id="grainT" />
      <Sound
        cues={[
          ...HEROES.flatMap(([, , , at]) => [
            [at - 0.25, "tap", 0.55],
            [at + 0.05, "pop", 0.3],
          ] as [number, string, number][]),
          [2.35, "swish", 0.22],
          [4.75, "swish", 0.22],
          [7.1, "swish", 0.22],
          [9.35, "swish", 0.22],
          [T.mass, "rattle", 0.28],
          [T.mass + 0.2, "shimmer", 0.35],
          [T.river - 1.4, "riser", 0.4],
          [T.river + 0.3, "whoosh", 0.45],
          [18.2, "swish", 0.2],
          [T.flash - 0.3, "whoosh", 0.4],
          [T.wall, "impact", 0.6],
          [T.hit - 0.05, "tap", 0.6],
          [T.hit, "chime", 0.45],
          [T.hit + 0.3, "shimmer", 0.45],
          [T.logo - 0.45, "whoosh", 0.25],
          [T.logo, "sting", 0.7],
        ]}
      />
    </AbsoluteFill>
  );
};
