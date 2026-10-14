/**
 * Film 2 — "When India switches off".
 * Evening crosses India east → west and the country lights up city by city. The light lifts off as a
 * river of gold, travels the globe west, and lands on the US just as its market opens. Small type only
 * at the end, then the logo.
 */
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { geoContains } from "d3-geo";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FPS, inOut, tw } from "../theme";
import { countryFeature, GlowPoints, Globe, rng, Stars, Tex, useEarthTextures } from "./Earth";
import { CamKey, camPose, latLon } from "./cam";
import { arcPoint, CITIES, ll, sunDir } from "./geo";
import { Caps, EndCard, FOOTNOTE, Grain, Sound, Vignette } from "./ui";

const T = { lift: 12.3, land: 20.6, open: 20.8, wide: 24.0, logo: 27.6 };

/* ---------------------------------------------------------------- sun */
const SUN_LAT = -8; // mid-October
const sunLon = (t: number) => tw(t, 0, 11.5, 26, -24, inOut) - tw(t, 11.5, 27, 0, 4, (x) => x);
const sunAt = (t: number) => sunDir(SUN_LAT, sunLon(t));

/* ---------------------------------------------------------------- camera: smooth path through keys */
const NYC = ll(40.7, -74);
const BOM = ll(19.1, 72.9);
const SPINE_A = ll(22, 79).normalize();
const SPINE_B = ll(39, -88).normalize();
/** Camera over the river at s (0..1), set back south of it so the river crosses the frame. */
const pathKey = (t: number, s: number, r: number): CamKey => {
  const [lat, lon] = latLon(arcPoint(BOM, NYC, s, 0));
  return { t, eye: [lat - 8, lon, r], at: [lat - 2, lon, 0.3] };
};
const KEYS: CamKey[] = [
  // low orbit over the Bay of Bengal looking west into the evening: the night arrives from behind us
  { t: -1, eye: [21, 101, 1.11], at: [22, 88, 1.0] },
  { t: 0, eye: [21, 100, 1.11], at: [22, 87, 1.0] },
  { t: 5.5, eye: [20.5, 92, 1.125], at: [21.5, 79, 1.0] },
  { t: 10.4, eye: [20, 85, 1.15], at: [21, 73, 1.0] },
  { t: 12.8, eye: [22, 77, 2.35], at: [23, 73, 0.3] },
  pathKey(15, 0.22, 2.75),
  pathKey(17, 0.5, 2.85),
  pathKey(19, 0.78, 2.7),
  { t: 21, eye: [25, -80, 2.15], at: [50, -84, 0.35] },
  { t: 23.6, eye: [26, -86, 2.05], at: [51, -88, 0.4] },
  { t: 26.6, eye: [44, -8, 4.3], at: [44, -8, 0] },
  { t: 28, eye: [45, -4, 4.45], at: [45, -4, 0] },
];

/* ---------------------------------------------------------------- data */
const usFeature = () => countryFeature("840");
const useData = () =>
  useMemo(() => {
    const r = rng(42);
    // 5,000 points over the contiguous US
    const us = usFeature();
    const usPts: { v: THREE.Vector3; lat: number; lon: number; on: number; tw: number }[] = [];
    while (usPts.length < 5000) {
      const lon = -124.5 + r() * 57.5;
      const lat = 25 + r() * 24.5;
      if (!geoContains(us, [lon, lat])) continue;
      const v = ll(lat, lon, 1.002);
      const ang = (v.clone().normalize().angleTo(NYC) * 180) / Math.PI;
      usPts.push({ v, lat, lon, on: T.open + ang * 0.045 + r() * 0.35, tw: r() * 6.28 });
    }
    // the river: particles leave from Indian cities, land on east-coast-weighted US points
    const N = 1500;
    const river = Array.from({ length: N }, (_, i) => {
      const c = CITIES[Math.floor(r() * CITIES.length)];
      const a = ll(c[1] + (r() - 0.5) * 1.6, c[2] + (r() - 0.5) * 1.6).normalize();
      let target = usPts[Math.floor(r() * usPts.length)];
      for (let k = 0; k < 2; k++) {
        const o = usPts[Math.floor(r() * usPts.length)];
        if (o.lon > target.lon) target = o; // bias east
      }
      const east = (c[2] - 70.8) / (93.94 - 70.8); // eastern cities leave first
      const dep = T.lift + (1 - east) * 1.4 + r() * 1.2;
      const dur = 6.6 + r() * 1.0 - (dep - T.lift) * 0.35;
      return { a, b: target.v.clone().normalize(), dep, dur, h: 0.05 + r() * 0.07, w: r(), i };
    });
    // the moment each city's evening arrives (sun-terminator crossing)
    const cities = CITIES.map(([, lat, lon]) => {
      const v = ll(lat, lon).normalize();
      let on = 11;
      for (let t = 0; t < 12; t += 0.02) {
        if (v.dot(sunAt(t)) < -0.02) {
          on = t;
          break;
        }
      }
      return { v: ll(lat, lon, 1.003), on };
    });
    return { usPts, river, cities };
  }, []);

/* ---------------------------------------------------------------- scene */
const TRAIL = 6;
const Scene: React.FC<{ t: number; tex: Tex }> = ({ t, tex }) => {
  const { camera, invalidate } = useThree();
  const D = useData();
  const sun = sunAt(t);

  useLayoutEffect(() => {
    const { eye, at } = camPose(KEYS, t);
    camera.position.copy(eye);
    const far = Math.max(0, Math.min(1, (eye.length() - 1.25) / 0.5));
    camera.up.copy(eye).normalize().lerp(new THREE.Vector3(0, 1, 0), far).normalize();
    camera.lookAt(at);
    invalidate();
  }, [t, camera, invalidate]);

  const india = tw(t, 1.5, 11.5, 0.15, 1.6, (x) => x) * (1 + 0.25 * Math.exp(-Math.pow((t - 12.2) / 0.5, 2))) - tw(t, T.lift, T.lift + 4, 0, 0.45);

  const cityFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      D.cities.forEach((c, i) => {
        pos.set([c.v.x, c.v.y, c.v.z], i * 3);
        const k = t - c.on;
        const flare = k < 0 ? 0 : Math.exp(-k * 1.6) * 1.0 + 0.32 * Math.min(1, k * 2);
        const lifted = 1 - tw(t, T.lift + 0.5, T.lift + 3.5, 0, 0.8);
        size[i] = 0.01 + 0.022 * Math.exp(-Math.max(0, k) * 1.4) * (k > 0 ? 1 : 0);
        alpha[i] = flare * lifted;
        tint.set([1, 0.72, 0.38], i * 3);
      });
    },
    [D, t],
  );

  const riverFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      const p = new THREE.Vector3();
      const sp = new THREE.Vector3();
      D.river.forEach((q, i) => {
        const s0 = (t - q.dep) / q.dur;
        for (let k = 0; k < TRAIL; k++) {
          const j = i * TRAIL + k;
          const s = s0 - k * 0.012;
          if (s <= 0 || s0 >= 1.04) {
            alpha[j] = 0;
            size[j] = 0;
            pos.set([0, 0, 0], j * 3);
            continue;
          }
          const se = Math.min(1, s);
          const eased = se < 0.5 ? 2 * se * se : 1 - Math.pow(-2 * se + 2, 2) / 2;
          arcPoint(q.a, q.b, eased, 0, p);
          arcPoint(SPINE_A, SPINE_B, eased, 0, sp);
          const w = 0.88 * Math.pow(Math.sin(Math.PI * eased), 0.6);
          p.lerp(sp, w).normalize().multiplyScalar(1.004 + q.h * Math.sin(Math.PI * eased));
          // a little lateral swirl so the ribbon breathes
          p.addScaledVector(sp.set(Math.sin(i * 1.7), Math.cos(i * 2.3), Math.sin(i * 0.9)), 0.012 * Math.sin(Math.PI * eased) * Math.sin(t * 2 + i));
          pos.set([p.x, p.y, p.z], j * 3);
          const head = k === 0 ? 1 : 0.55 * Math.pow(1 - k / TRAIL, 1.5);
          const fadeIn = Math.min(1, s * 12);
          const land = s0 > 1 ? Math.max(0, 1 - (s0 - 1) * 25) : 1;
          alpha[j] = head * fadeIn * land * (0.65 + 0.35 * q.w);
          size[j] = (k === 0 ? 0.013 : 0.009) * (0.7 + 0.6 * q.w);
          const warm = q.w > 0.8 ? [1, 0.55, 0.16] : [1, 0.76, 0.42];
          tint.set(warm, j * 3);
        }
      });
    },
    [D, t],
  );

  const usFill = useMemo(
    () => (pos: Float32Array, size: Float32Array, alpha: Float32Array, tint: Float32Array) => {
      D.usPts.forEach((u, i) => {
        pos.set([u.v.x, u.v.y, u.v.z], i * 3);
        const k = t - u.on;
        const on = k < 0 ? 0 : Math.min(1, k * 4);
        const pop = k < 0 ? 0 : Math.exp(-k * 3) * 1.6;
        const fadeWide = 1 - tw(t, T.logo - 0.4, T.logo + 0.3, 0, 1);
        size[i] = 0.005 + 0.004 * pop;
        alpha[i] = (on * (0.55 + 0.12 * Math.sin(t * 3 + u.tw)) + pop * 0.35) * fadeWide;
        tint.set([1, 0.74, 0.4], i * 3);
      });
    },
    [D, t],
  );

  return (
    <>
      <Stars t={t} gain={0.8} />
      <Globe
        tex={tex}
        sun={sun}
        maskLights={india}
        worldLights={0.22}
        lightsGain={2.6}
        clouds={0.42}
        cloudSpin={t * 0.004}
        dayGain={1.5}
        atmo={1}
      />
      <GlowPoints count={D.cities.length} fill={cityFill} t={t} maxPx={22} />
      <GlowPoints count={D.river.length * TRAIL} fill={riverFill} t={t} />
      <GlowPoints count={D.usPts.length} fill={usFill} t={t} />
    </>
  );
};

export const IndiaFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const tex = useEarthTextures(["356"]);
  const fadeIn = tw(t, 0, 1.4, 0, 1, (x) => x);

  return (
    <AbsoluteFill style={{ background: "#02040a" }}>
      {tex ? (
        <ThreeCanvas
          width={1920}
          height={1080}
          dpr={1}
          camera={{ fov: 35, near: 0.01, far: 200, position: [0, 0, 3] }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Scene t={t} tex={tex} />
        </ThreeCanvas>
      ) : null}

      <Vignette />
      <AbsoluteFill style={{ background: "#000", opacity: 1 - fadeIn }} />

      <Caps t={t} at={T.open + 0.1} out={T.wide - 0.1} y={150}>
        WHEN INDIA&apos;S DAY ENDS,
      </Caps>
      <Caps t={t} at={T.open + 0.9} out={T.wide - 0.1} y={200}>
        THE US MARKET OPENS.
      </Caps>
      <Caps t={t} at={T.wide + 0.3} out={T.logo - 0.3} y={150}>
        5,000+ US STOCKS AND ETFS. FROM $1.*
      </Caps>
      <Caps t={t} at={T.wide + 0.9} out={T.logo - 0.3} y={985} size={15} dim>
        {FOOTNOTE}
      </Caps>

      <EndCard t={t} at={T.logo} />
      <Grain frame={frame} id="grainE" />
      <Sound
        cues={[
          [0.2, "shimmer", 0.3],
          [4.1, "swish", 0.18],
          [8.1, "swish", 0.18],
          [T.lift - 1.6, "riser", 0.45],
          [T.lift, "whoosh", 0.5],
          [T.lift + 0.15, "shimmer", 0.35],
          [16.4, "swish", 0.25],
          [T.land - 0.5, "whoosh", 0.35],
          [T.open, "impact", 0.8],
          [T.open + 0.3, "shimmer", 0.4],
          [T.wide + 0.3, "chime", 0.45],
          [T.logo - 0.45, "whoosh", 0.25],
          [T.logo, "sting", 0.7],
        ]}
      />
    </AbsoluteFill>
  );
};
