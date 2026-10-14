import React, { useLayoutEffect, useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COLS, N, ROWS, hash } from "./field";
import { DOOR, SEGS, T, VERB_AT, delayFor, ease, segAt } from "./board";
import { C } from "./theme";

const FACE: Record<number, string> = {
  1: C.navy,
  2: C.orange,
  3: "#AEB9C7",
  4: "#FFFFFF",
  5: "#F8C79A",
  6: "#C3CDD9",
};
const EXTRA = 400;
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
// critically damped flip with a hair of settle, like a magnetic flip-dot
const flipEase = (p: number) => {
  const x = clamp(p);
  return 1 - Math.pow(1 - x, 3) * (1 + 2.2 * x);
};

const roundedSquare = (s: number, r: number) => {
  const h = s / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-h + r, -h);
  sh.lineTo(h - r, -h);
  sh.quadraticCurveTo(h, -h, h, -h + r);
  sh.lineTo(h, h - r);
  sh.quadraticCurveTo(h, h, h - r, h);
  sh.lineTo(-h + r, h);
  sh.quadraticCurveTo(-h, h, -h, h - r);
  sh.lineTo(-h, -h + r);
  sh.quadraticCurveTo(-h, -h, -h + r, -h);
  return sh;
};

const pos = (i: number) => {
  const c = i % COLS;
  const r = Math.floor(i / COLS);
  return [(c - (COLS - 1) / 2) * 1, ((ROWS - 1) / 2 - r) * 1] as const;
};

export const cam3d = (t: number) => {
  // slow drift and a gentle tilt; push toward the doorway before US STOCKS
  let x = Math.sin(t * 0.21) * 3.2;
  let y = -7 + Math.sin(t * 0.17) * 1.2;
  let z = 92 - t * 0.25;
  let tx = 0;
  let ty = 0;
  if (t >= T.push && t < T.orange + 0.2) {
    const u = clamp((t - T.push) / (T.orange - T.push));
    const k = Math.pow(u, 2.2);
    const [dx, dy] = pos(DOOR.cy * COLS + DOOR.cx);
    tx = lerp(0, dx, k);
    ty = lerp(0, dy - 1, k);
    x = lerp(x, dx, k);
    y = lerp(y, dy - 2, k);
    z = lerp(z, 6, k);
  }
  return { x, y, z, tx, ty };
};

const Scene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, invalidate } = useThree();
  const front = useRef<THREE.InstancedMesh>(null);
  const back = useRef<THREE.InstancedMesh>(null);
  const edge = useRef<THREE.InstancedMesh>(null);
  const warm = useRef<THREE.PointLight>(null);

  const geo = useMemo(() => {
    const shape = roundedSquare(0.78, 0.2);
    const f = new THREE.ShapeGeometry(shape, 6);
    f.translate(0, 0, 0.041);
    const b = new THREE.ShapeGeometry(shape, 6);
    b.rotateY(Math.PI);
    b.translate(0, 0, -0.041);
    const e = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false, curveSegments: 6 });
    e.translate(0, 0, -0.04);
    return { f, b, e };
  }, []);
  const mats = useMemo(
    () => ({
      f: new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.32, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
      b: new THREE.MeshStandardMaterial({ color: "#E4E9EF", roughness: 0.75 }),
      e: new THREE.MeshStandardMaterial({ color: "#C9D2DC", roughness: 0.6 }),
    }),
    [],
  );

  useLayoutEffect(() => {
    const k = segAt(t);
    const seg = SEGS[k];
    const prev = k > 0 && SEGS[k].at !== T.zero ? SEGS[k - 1].mask(seg.at) : new Uint8Array(N);
    const cur = seg.mask(t);
    const dl = delayFor(k);
    const flip = Math.min(0.3, (seg.flip ?? 0.16) * 1.7);
    const grey = t >= T.game && t < T.unflood ? ease((t - T.game) / 0.5) : 0;
    const swirl = t >= T.swirl && t < T.zero;
    const swirlSrc = SEGS[VERB_AT.length].mask(T.swirl);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    const greyC = new THREE.Color("#AEB9C7");
    const appear = ease(t / 0.5);

    for (let i = 0; i < N; i++) {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const [x, y] = pos(i);

      // solid fields: every tile flips to navy (Not anymore) or orange (the room behind the door)
      const navy = clamp((t - T.flood - (c / COLS) * 0.3) / 0.18) * (1 - clamp((t - T.unflood - (c / COLS) * 0.3) / 0.18));
      const orange = t >= T.orange ? 1 - clamp((t - T.unorange - (1 - c / COLS) * 0.35) / 0.2) : 0;

      let code = 0;
      let angle = Math.PI; // back face to camera = "off"
      let z = 0;
      const pr = clamp((t - seg.at - dl[i]) / flip);
      const a = prev[i];
      const b = cur[i];
      if (a === b) {
        code = a;
        angle = a ? 0 : Math.PI;
      } else if (!a && b) {
        code = b;
        angle = Math.PI * (1 - flipEase(pr));
      } else if (a && !b) {
        code = a;
        angle = Math.PI * flipEase(pr);
      } else {
        code = pr < 0.5 ? a : b;
        angle = Math.PI * 2 * flipEase(pr);
      }
      if (swirl && swirlSrc[i]) {
        code = 0;
        angle = Math.PI * flipEase((t - T.swirl) / 0.2);
      }
      if (navy > 0) {
        code = 1;
        angle = Math.PI * (1 - flipEase(navy));
      }
      if (orange > 0) {
        code = 2;
        angle = Math.PI * (1 - flipEase(orange));
      }
      // tiles lift a touch while they turn, so the edge catches the light
      z = Math.sin(((angle % Math.PI) / Math.PI) * Math.PI) * 0.35;
      e.set(angle, 0, 0);
      q.setFromEuler(e);
      const sc = appear * (t < 0.5 ? 0.6 + 0.4 * ease((t - Math.hypot(c - 40, r - 22) * 0.008) / 0.3) : 1);
      s.set(sc, sc, sc);
      p.set(x, y, z);
      m.compose(p, q, s);
      front.current!.setMatrixAt(i, m);
      back.current!.setMatrixAt(i, m);
      edge.current!.setMatrixAt(i, m);
      col.set(FACE[code] ?? "#E4E9EF");
      if (grey > 0 && (code === 1 || code === 2)) col.lerp(greyC, grey);
      front.current!.setColorAt(i, col);
    }

    // tiles from the last verb, released into a vortex before landing as the zero
    if (swirl) {
      const u = (t - T.swirl) / (T.zero - T.swirl);
      let j = 0;
      for (let i = 0; i < N && j < 400; i++) {
        if (!swirlSrc[i]) continue;
        const [x0, y0] = pos(i);
        const a0 = Math.atan2(y0, x0);
        const r0 = Math.hypot(x0, y0);
        const orbit = 10 + hash(i) * 9;
        const ang = a0 + u * u * 6 + u * 1.5;
        let rad = lerp(r0, orbit, ease(u / 0.35));
        if (u > 0.78) rad *= 1 - ease((u - 0.78) / 0.22);
        p.set(Math.cos(ang) * rad * 1.35, Math.sin(ang) * rad, 2 + Math.sin(u * 9 + i) * 3 * (1 - u));
        e.set(u * 9 + hash(i, 2) * 6, u * 5, u * 3);
        q.setFromEuler(e);
        s.set(1, 1, 1);
        m.compose(p, q, s);
        front.current!.setMatrixAt(N + j, m);
        back.current!.setMatrixAt(N + j, m);
        edge.current!.setMatrixAt(N + j, m);
        front.current!.setColorAt(N + j, col.set(FACE[swirlSrc[i]]));
        j++;
      }
    }

    // park unused swirl slots out of view
    m.makeScale(0, 0, 0);
    const used = swirl ? Math.min(400, swirlSrc.reduce((a, v) => a + (v ? 1 : 0), 0)) : 0;
    for (let j = used; j < EXTRA; j++) {
      front.current!.setMatrixAt(N + j, m);
      back.current!.setMatrixAt(N + j, m);
      edge.current!.setMatrixAt(N + j, m);
    }
    for (const ref of [front, back, edge]) ref.current!.instanceMatrix.needsUpdate = true;
    if (front.current!.instanceColor) front.current!.instanceColor.needsUpdate = true;

    const light = t >= T.swing && t < T.unorange ? ease((t - T.swing) / 0.7) : 0;
    warm.current!.intensity = light * 900;

    const cm = cam3d(t);
    camera.position.set(cm.x, cm.y, cm.z);
    camera.lookAt(cm.tx, cm.ty, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [t, camera, invalidate]);

  const [dx, dy] = pos(DOOR.cy * COLS + DOOR.cx);
  return (
    <>
      <color attach="background" args={["#F2F4F7"]} />
      <hemisphereLight args={["#ffffff", "#DDE3EA", 1.6]} />
      <directionalLight
        position={[-40, 55, 70]}
        intensity={2.3}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0015}
        shadow-normalBias={0.04}
        shadow-radius={4}
      />
      <directionalLight position={[50, -20, 60]} intensity={0.5} color="#EAF1FF" />
      <pointLight ref={warm} position={[dx, dy - 2, 4]} color="#FF9A3C" distance={40} decay={1.6} intensity={0} />
      <mesh position={[0, 0, -0.35]} receiveShadow>
        <planeGeometry args={[COLS + 40, ROWS + 30]} />
        <meshStandardMaterial color="#F1F3F6" roughness={0.9} />
      </mesh>
      <instancedMesh ref={front} args={[geo.f, mats.f, N + EXTRA]} castShadow={false} />
      <instancedMesh ref={back} args={[geo.b, mats.b, N + EXTRA]} castShadow={false} />
      <instancedMesh ref={edge} args={[geo.e, mats.e, N + EXTRA]} castShadow receiveShadow />
    </>
  );
};

export const Board3D: React.FC<{ t: number }> = ({ t }) => (
  <ThreeCanvas
    width={1920}
    height={1080}
    shadows
    dpr={1}
    camera={{ fov: 30, near: 0.5, far: 400, position: [0, -7, 92] }}
    gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
    style={{ position: "absolute", inset: 0 }}
  >
    <Scene t={t} />
  </ThreeCanvas>
);
