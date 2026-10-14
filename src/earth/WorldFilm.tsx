/**
 * Film 1 — "4% of the world".
 * One long rise: from the night lights of Surat to the whole planet. Around it, a ring of 100 lights — the world's
 * stock market, one light per percent. Four are India's and they are lit. Then the other 96 light up, west from India,
 * while the camera travels with them toward the morning over the Americas.
 *
 * [C] The 4% / 96% split has no confirmed source yet; this film cannot air until compliance supplies one.
 */
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FPS, tw } from "../theme";
import { CamKey, camPose } from "./cam";
import { GlowPoints, Globe, Stars, Tex, useEarthTextures } from "./Earth";
import { ll, sunDir } from "./geo";
import { Caps, EndCard, FOOTNOTE, Grain, Sound, Vignette } from "./ui";

const T = { ring: 7.2, india: 8.4, open: 15.4, full: 21.0, logo: 27.6 };
const INDIA_SHARE = 4; // [C] unsourced — see films/US-STOCKS-FOUR-FILMS.md
const SUN = sunDir(-8, -22);
const R = 1.42;
const TILT = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0.35).normalize(), 0.42);
const STEP = 360 / 100;
const LON0 = 84; // India's four lights sit over India
const beadPos = (i: number, out = new THREE.Vector3()) => out.copy(ll(0, LON0 + (i - (INDIA_SHARE - 1)) * STEP, R)).applyMatrix4(TILT);
/** Order in which the other 96 light: westward from India, all the way round. */
const lightAt = (i: number) => {
  if (i < INDIA_SHARE) return T.india + i * 0.18;
  const k = (100 - i) % 100; // i = 99 is just west of India
  const u = k / 96;
  return T.open + 0.2 + 5.2 * Math.pow(u, 0.85);
};

const KEYS: CamKey[] = [
  { t: -1, eye: [17.6, 79.2, 1.11], at: [21.3, 72.4, 1.0] },
  { t: 0, eye: [17.5, 79.0, 1.115], at: [21.2, 72.5, 1.0] },
  { t: 3.0, eye: [16.5, 80, 1.4], at: [20.5, 73.5, 0.85] },
  { t: 6.0, eye: [16, 82, 2.5], at: [18, 78, 0.2] },
  { t: 9.5, eye: [24, 82, 3.9], at: [8, 80, 0] },
  { t: 13, eye: [26, 70, 4.0], at: [8, 68, 0] },
  { t: 16.5, eye: [27, 42, 4.1], at: [8, 40, 0] },
  { t: 20, eye: [28, -3, 4.2], at: [8, -5, 0] },
  { t: 23.5, eye: [29, -48, 4.3], at: [8, -50, 0] },
  { t: 27, eye: [30, -80, 4.45], at: [8, -82, 0] },
  { t: 29, eye: [30, -90, 4.5], at: [8, -92, 0] },
];

const Scene: React.FC<{ t: number; tex: Tex }> = ({ t, tex }) => {
  const { camera, invalidate } = useThree();
  useLayoutEffect(() => {
    const { eye, at } = camPose(KEYS, t);
    camera.position.copy(eye);
    const far = Math.max(0, Math.min(1, (eye.length() - 1.25) / 0.5));
    camera.up.copy(eye).normalize().lerp(new THREE.Vector3(0, 1, 0), far).normalize();
    camera.lookAt(at);
    invalidate();
  }, [t, camera, invalidate]);

  const ringA = tw(t, T.ring, T.ring + 1.6);
  const beadFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      const p = new THREE.Vector3();
      for (let i = 0; i < 100; i++) {
        beadPos(i, p);
        pos.set([p.x, p.y, p.z], i * 3);
        const k = t - lightAt(i);
        const on = k < 0 ? 0 : Math.min(1, k * 5);
        const pop = k < 0 ? 0 : Math.exp(-k * 3);
        const india = i < INDIA_SHARE;
        // unlit beads are ghosts: present, countable, dark
        size[i] = (india ? 0.05 : 0.04) + 0.035 * pop;
        alpha[i] = ringA * (0.16 + on * (india ? 1.25 + 0.15 * Math.sin(t * 4 + i) : 0.95) + pop * 0.8);
        tint.set(india || on > 0 ? [1, 0.68, 0.32] : [0.6, 0.72, 0.95], i * 3);
      }
    },
    [t, ringA],
  );
  // the faint orbit the beads sit on
  const N_LINE = 1400;
  const lineFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      const p = new THREE.Vector3();
      const head = tw(t, T.open + 0.2, T.full, 0, 1, (x) => x);
      for (let j = 0; j < N_LINE; j++) {
        const lon = LON0 - (INDIA_SHARE - 1) * STEP + (j / N_LINE) * 360;
        p.copy(ll(0, lon, R)).applyMatrix4(TILT);
        pos.set([p.x, p.y, p.z], j * 3);
        size[j] = 0.006;
        // westward fill (lon decreasing from India) warms as the 96 light
        const west = ((LON0 + 12 - lon + 720) % 360) / 360;
        const warm = west < head ? 1 : 0;
        alpha[j] = ringA * (0.12 + 0.35 * warm);
        tint.set(warm ? [1, 0.6, 0.25] : [0.55, 0.68, 0.95], j * 3);
      }
    },
    [t, ringA],
  );

  return (
    <>
      <Stars t={t} gain={0.75} />
      <Globe tex={tex} sun={SUN} maskLights={1.5} worldLights={0.45} lightsGain={2.4} clouds={0.5} cloudSpin={t * 0.003} dayGain={1.4} />
      <GlowPoints count={N_LINE} fill={lineFill} t={t} maxPx={4} />
      <GlowPoints count={100} fill={beadFill} t={t} maxPx={40} />
    </>
  );
};

export const WorldFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tex = useEarthTextures(["356"]);
  const fadeIn = tw(t, 0, 1.2, 0, 1, (x) => x);
  return (
    <AbsoluteFill style={{ background: "#02040a" }}>
      {tex ? (
        <ThreeCanvas
          width={1920}
          height={1080}
          dpr={1}
          camera={{ fov: 35, near: 0.005, far: 200, position: [0, 0, 3] }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Scene t={t} tex={tex} />
        </ThreeCanvas>
      ) : null}
      <Vignette />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeIn }} />

      <Caps t={t} at={9.6} out={14.9} y={120}>
        INDIAN INVESTORS HAVE BEEN INVESTING
      </Caps>
      <Caps t={t} at={10.4} out={14.9} y={170}>
        IN {INDIA_SHARE}% OF THE WORLD.*
      </Caps>
      <Caps t={t} at={T.open} out={20.8} y={120}>
        NOW OPEN THE OTHER {100 - INDIA_SHARE}%.
      </Caps>
      <Caps t={t} at={21.6} out={T.logo - 0.3} y={120}>
        5,000+ US STOCKS AND ETFS. FROM $1.*
      </Caps>
      <Caps t={t} at={10.4} out={T.logo - 0.3} y={985} size={15} dim>
        *SHARE OF WORLD STOCK MARKET VALUE · SOURCE AND DATE TO BE CONFIRMED · {FOOTNOTE.replace("*", "")}
      </Caps>

      <EndCard t={t} at={T.logo} />
      <Grain frame={frame} id="grainW" />
      <Sound
        cues={[
          [0.2, "shimmer", 0.3],
          [3.0, "whoosh", 0.3],
          [6.0, "swish", 0.25],
          [T.ring, "shimmer", 0.35],
          ...[0, 1, 2, 3].map((i) => [lightAt(i), "tick", 0.5] as [number, string, number]),
          [T.open - 1.4, "riser", 0.4],
          [T.open + 0.2, "impact", 0.6],
          [T.open + 0.3, "rattle", 0.3],
          [17.4, "flap", 0.25],
          [19.4, "rattle", 0.25],
          [T.full - 0.1, "chime", 0.45],
          [21.6, "swish", 0.25],
          [T.logo - 0.45, "whoosh", 0.25],
          [T.logo, "sting", 0.7],
        ]}
      />
    </AbsoluteFill>
  );
};
